import { z } from "zod";
import { idSchema } from "@grail/shared";

export const providerConfigSchema = z.strictObject({
  id: idSchema,
  kind: z.enum(["openai-compatible", "ollama", "ollama-cloud"]),
  baseUrl: z.string().url().max(300),
  model: z.string().trim().min(1).max(120),
  apiKey: z.string().max(500).optional(),
  inputPricePerMillion: z.number().nonnegative().optional(),
  outputPricePerMillion: z.number().nonnegative().optional(),
  limits: z
    .strictObject({
      timeoutMs: z.number().int().min(10).max(120000).optional(),
      retries: z.number().int().min(0).max(3).optional(),
      maxToolCalls: z.number().int().min(0).max(10).optional(),
      maxOutputTokens: z.number().int().min(32).max(8192).optional(),
      maxRequests: z.number().int().min(0).max(10000).optional(),
      maxTokens: z.number().int().nonnegative().optional(),
      maxCost: z.number().nonnegative().optional(),
    })
    .optional(),
});
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export interface LLMRequest {
  prompt: string;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  signal: AbortSignal;
}
export interface LLMResponse {
  output: unknown;
  inputTokens?: number;
  outputTokens?: number;
}
export interface LLMProvider {
  readonly id: string;
  readonly model: string;
  generate(request: LLMRequest): Promise<LLMResponse>;
}
export function validateProviderURL(value: string) {
  const u = new URL(value),
    local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (
    u.username ||
    u.password ||
    u.hash ||
    u.search ||
    !["http:", "https:"].includes(u.protocol)
  )
    throw new Error("INVALID_PROVIDER_URL");
  if (u.protocol === "http:" && !local)
    throw new Error("HTTPS_REQUIRED_FOR_REMOTE_PROVIDER");
  if (
    /^(169\.254\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
      u.hostname,
    ) ||
    u.hostname === "metadata.google.internal"
  )
    throw new Error("PROVIDER_ADDRESS_NOT_ALLOWED");
  return u.toString().replace(/\/$/, "");
}
const responseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable() }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .optional(),
  usage: z
    .object({
      prompt_tokens: z.number().nonnegative().optional(),
      completion_tokens: z.number().nonnegative().optional(),
    })
    .optional(),
  message: z.object({ content: z.string().nullable().optional() }).optional(),
  done_reason: z.string().optional(),
  prompt_eval_count: z.number().nonnegative().optional(),
  eval_count: z.number().nonnegative().optional(),
});
/**
 * Extrai o objeto JSON da resposta do modelo. Sem saída estruturada (Ollama
 * Cloud), modelos às vezes envolvem o JSON em cercas markdown ou texto curto.
 * Lança SyntaxError para que o runtime continue classificando como INVALID_JSON.
 */
export function parseModelJSON(content: string): unknown {
  const trimmed = content.trim();
  const candidates = [trimmed];
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fence) candidates.push(fence[1].trim());
  const start = trimmed.search(/[{[]/),
    end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (start >= 0 && end > start) candidates.push(trimmed.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* Tenta o próximo formato. */
    }
  }
  throw new SyntaxError("PROVIDER_INVALID_JSON");
}
/**
 * Traduz o corpo de erro do serviço num código estável. OpenAI sem créditos
 * responde 429 com code "insufficient_quota", diferente de limite de taxa.
 */
export function providerErrorCode(status: number, body: string) {
  let code = "",
    message = "";
  try {
    const parsed = JSON.parse(body) as {
      error?: string | { code?: unknown; type?: unknown; message?: unknown };
    };
    if (typeof parsed.error === "string") message = parsed.error;
    else if (parsed.error) {
      code = [parsed.error.code, parsed.error.type]
        .filter((v) => typeof v === "string")
        .join(" ");
      message =
        typeof parsed.error.message === "string" ? parsed.error.message : "";
    }
  } catch {
    /* Corpo não JSON: usa só o status. */
  }
  const text = `${code} ${message}`.toLowerCase();
  if (text.includes("insufficient_quota") || text.includes("billing"))
    return "PROVIDER_NO_CREDIT";
  if (
    text.includes("invalid_api_key") ||
    (status === 401 && text.includes("api key"))
  )
    return "PROVIDER_INVALID_KEY";
  if (text.includes("model_not_found") || /model .*not found/.test(text))
    return "PROVIDER_MODEL_NOT_FOUND";
  if (status === 429) return "PROVIDER_RATE_LIMIT";
  return `PROVIDER_HTTP_${status}`;
}
const isOpenAI = (value: string) =>
  new URL(value).hostname === "api.openai.com";
const isLocalHost = (value: string) =>
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname);
export class HTTPProvider implements LLMProvider {
  readonly id: string;
  readonly model: string;
  #config: ProviderConfig;
  #base: string;
  #apiKey: string | undefined;
  constructor(
    config: ProviderConfig,
    private readonly request: typeof fetch = fetch,
  ) {
    this.#config = providerConfigSchema.parse(config);
    this.#base = validateProviderURL(config.baseUrl);
    // Ollama Cloud direto (https://ollama.com) aceita a chave do ambiente, que
    // sobrevive a reinícios sem gravar segredo em disco. Via Ollama local
    // autenticado (modelos ":cloud") nenhuma chave é necessária.
    this.#apiKey =
      this.#config.apiKey ||
      (this.#config.kind === "ollama-cloud" && !isLocalHost(this.#base)
        ? process.env.OLLAMA_API_KEY || undefined
        : undefined);
    this.id = config.id;
    this.model = config.model;
  }
  async generate(input: LLMRequest): Promise<LLMResponse> {
    const ollama = this.#config.kind === "ollama";
    const ollamaCloud = this.#config.kind === "ollama-cloud";
    const body =
      ollama || ollamaCloud
        ? {
            model: this.model,
            stream: false,
            messages: [{ role: "user", content: input.prompt }],
            // Cloud não aceita saída estruturada; desligar o raciocínio evita que
            // o "thinking" consuma num_predict e deixe o conteúdo vazio.
            ...(ollamaCloud ? { think: false } : { format: input.schema }),
            options: { num_predict: input.maxOutputTokens },
          }
        : {
            model: this.model,
            messages: [{ role: "user", content: input.prompt }],
            response_format: { type: "json_object" },
            // A OpenAI rejeita max_tokens nos modelos de raciocínio; outros
            // servidores compatíveis (LM Studio etc.) ainda esperam max_tokens.
            ...(isOpenAI(this.#base)
              ? { max_completion_tokens: input.maxOutputTokens }
              : { max_tokens: input.maxOutputTokens }),
          };
    let response: Response;
    try {
      response = await this.request(
        `${this.#base}${ollama || ollamaCloud ? "/api/chat" : "/chat/completions"}`,
        {
          method: "POST",
          redirect: "error",
          headers: {
            "Content-Type": "application/json",
            ...(this.#apiKey
              ? { Authorization: `Bearer ${this.#apiKey}` }
              : {}),
          },
          body: JSON.stringify(body),
          signal: input.signal,
        },
      );
    } catch {
      throw new Error(
        input.signal.aborted ? "PROVIDER_TIMEOUT" : "PROVIDER_UNREACHABLE",
      );
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        providerErrorCode(response.status, detail.slice(0, 20000)),
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("EMPTY_PROVIDER_RESPONSE");
    let text = "",
      size = 0;
    const decoder = new TextDecoder();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 1000000) {
        await reader.cancel();
        throw new Error("PROVIDER_RESPONSE_TOO_LARGE");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    let envelope: unknown;
    try {
      envelope = JSON.parse(text);
    } catch {
      throw new Error("PROVIDER_INVALID_RESPONSE");
    }
    const result = responseSchema.safeParse(envelope);
    if (!result.success) throw new Error("PROVIDER_INVALID_RESPONSE");
    const parsed = result.data;
    const content =
      (ollama || ollamaCloud
        ? parsed.message?.content
        : parsed.choices?.[0]?.message.content) ?? "";
    if (!content.trim())
      throw new Error(
        parsed.done_reason === "length" ||
          parsed.choices?.[0]?.finish_reason === "length"
          ? "PROVIDER_OUTPUT_TRUNCATED"
          : "EMPTY_PROVIDER_RESPONSE",
      );
    return {
      output: parseModelJSON(content),
      inputTokens:
        ollama || ollamaCloud
          ? parsed.prompt_eval_count
          : parsed.usage?.prompt_tokens,
      outputTokens:
        ollama || ollamaCloud
          ? parsed.eval_count
          : parsed.usage?.completion_tokens,
    };
  }
}
export class LLMGateway {
  constructor(readonly provider: LLMProvider) {}
  generate(request: LLMRequest) {
    return this.provider.generate(request);
  }
}
