import { z } from "zod";
import {
  intentSchema,
  summoningSchema,
  controllerStateSchema,
  type PlayerController,
  type PlayerView,
  type Intent,
} from "@grail/shared";
import { BotController } from "@grail/bot-controller";
import { LLMGateway } from "@grail/llm";
import { sanitize, type AgentMetric } from "@grail/telemetry";

export interface AgentMemory {
  verifiedFacts: Record<string, unknown>;
  agentNotes: string[];
  observations: unknown[];
}
export const agentLimitsSchema = z.strictObject({
  timeoutMs: z.number().int().min(10).max(120000).default(20000),
  retries: z.number().int().min(0).max(3).default(1),
  maxToolCalls: z.number().int().min(0).max(10).default(3),
  maxOutputTokens: z.number().int().min(32).max(8192).default(1000),
  maxRequests: z.number().int().min(0).max(10000).default(200),
  maxTokens: z.number().int().nonnegative().default(200000),
  maxCost: z.number().nonnegative().optional(),
  inputPricePerMillion: z.number().nonnegative().optional(),
  outputPricePerMillion: z.number().nonnegative().optional(),
});
type Limits = z.infer<typeof agentLimitsSchema>;
const toolNames = [
  "get_my_servant",
  "get_my_resources",
  "get_known_enemies",
  "get_locations",
  "get_investigation_results",
] as const;
const toolResponse = z.strictObject({ tool: z.enum(toolNames) });
export function runViewTool(
  name: (typeof toolNames)[number],
  view: PlayerView,
): unknown {
  const handlers = {
    get_my_servant: () => view.self.servant,
    get_my_resources: () => ({
      hp: view.self.hp,
      mana: view.self.mana,
      np: view.self.np,
    }),
    get_known_enemies: () => view.enemies,
    get_locations: () => view.locations,
    get_investigation_results: () =>
      view.events.filter((e) =>
        ["LOCATION_CLUE", "IDENTITY_GAINED", "INVESTIGATION_BLOCKED"].includes(
          e.type,
        ),
      ),
  };
  if (!Object.hasOwn(handlers, name)) throw new Error("UNKNOWN_TOOL");
  return structuredClone(handlers[name]());
}
export function actionTool(input: unknown): Intent {
  return intentSchema.parse(input);
}
export class AgentRuntime {
  #memory: AgentMemory = {
    verifiedFacts: {},
    agentNotes: [],
    observations: [],
  };
  #requests = 0;
  #tokens = 0;
  #cost = 0;
  #metrics: AgentMetric[] = [];
  readonly limits: Limits;
  constructor(
    readonly gateway: LLMGateway,
    limits: Partial<Limits> = {},
    private readonly fallback: PlayerController = new BotController(),
  ) {
    this.limits = agentLimitsSchema.parse(limits);
  }
  memory() {
    return structuredClone(this.#memory);
  }
  metrics() {
    return structuredClone(this.#metrics);
  }
  exportState() {
    return {
      requests: this.#requests,
      tokens: this.#tokens,
      cost: this.#cost,
      agentNotes: [...this.#memory.agentNotes],
      metrics: this.metrics(),
    };
  }
  restoreState(input: unknown) {
    const state = controllerStateSchema.parse(input);
    this.#requests = state.requests;
    this.#tokens = state.tokens;
    this.#cost = state.cost;
    this.#memory.agentNotes = [...state.agentNotes];
    this.#metrics = structuredClone(state.metrics);
  }
  async decide(
    view: PlayerView,
    validate: (intent: unknown) => Intent,
  ): Promise<Intent> {
    const started = Date.now();
    const failureReasons: string[] = [];
    let inputTokens = 0,
      outputTokens = 0,
      invalidAttempts = 0,
      toolCalls = 0,
      estimatedCost = 0;
    const priced =
      this.limits.inputPricePerMillion !== undefined &&
      this.limits.outputPricePerMillion !== undefined;
    const metric = (fallback: boolean) =>
      this.#metrics.push({
        provider: this.gateway.provider.id,
        model: this.gateway.provider.model,
        latencyMs: Date.now() - started,
        inputTokens,
        outputTokens,
        invalidAttempts,
        toolCalls,
        fallback,
        phase: view.phase,
        failureReasons,
        estimatedCost: priced ? estimatedCost : null,
      });
    this.#memory.verifiedFacts = {
      day: view.day,
      self: view.self.id,
      identity: structuredClone(view.self.identity),
    };
    this.#memory.observations = structuredClone(view.events.slice(-16));
    const context = { ...view, events: view.events.slice(-12) };
    const summoning = view.phase === "SUMMONING";
    const phaseSchema =
      intentSchema.options.find(
        (option) => option.shape.type.value === view.phase,
      ) ?? intentSchema;
    const schema = z.toJSONSchema(
      summoning
        ? summoningSchema
        : z.union([
            phaseSchema,
            toolResponse,
            z.strictObject({
              intent: phaseSchema,
              note: z.string().max(200).optional(),
            }),
          ]),
    );
    let prompt = JSON.stringify({
      instruction: summoning
        ? "Return one JSON object with all six summoning decisions in ONE response. No tools or reasoning."
        : 'Choose one legal intent as JSON. You may instead return {"tool":"name"} for a read-only tool, or {"intent":...,"note":"short hypothesis"}. Never output reasoning or hidden information.',
      rules:
        "Locations lock before daytime actions. Buster > Arts > Quick > Buster. Mana heals; leyline charges NP. Combat attacks every co-located enemy simultaneously. NP replaces all attacks and needs 5 charge. True name and terrain each multiply damage by 1.25.",
      context,
      memory: this.#memory,
      schema,
      tools: summoning ? [] : toolNames,
    });
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), this.limits.timeoutMs);
    try {
      for (
        let attempt = 0;
        attempt <= this.limits.retries + this.limits.maxToolCalls;
        attempt++
      ) {
        if (abort.signal.aborted || this.#requests >= this.limits.maxRequests)
          break;
        const reservedInput = Buffer.byteLength(prompt),
          reservedOutput = this.limits.maxOutputTokens;
        if (
          this.#tokens + reservedInput + reservedOutput >
          this.limits.maxTokens
        )
          break;
        const reservedCost = priced
          ? (reservedInput * this.limits.inputPricePerMillion! +
              reservedOutput * this.limits.outputPricePerMillion!) /
            1e6
          : 0;
        if (
          this.limits.maxCost !== undefined &&
          (!priced || this.#cost + reservedCost > this.limits.maxCost)
        )
          break;
        this.#requests++;
        // Reserva antes da chamada: falhas e uso não informado também consomem orçamento.
        this.#tokens += reservedInput + reservedOutput;
        this.#cost += reservedCost;
        try {
          let abortHandler: () => void = () => {};
          const cancelled = new Promise<never>((_, reject) => {
            abortHandler = () => reject(new Error("TIMEOUT"));
            abort.signal.addEventListener("abort", abortHandler, {
              once: true,
            });
          });
          let response;
          try {
            response = await Promise.race([
              this.gateway.generate({
                prompt,
                schema,
                maxOutputTokens: this.limits.maxOutputTokens,
                signal: abort.signal,
              }),
              cancelled,
            ]);
          } finally {
            abort.signal.removeEventListener("abort", abortHandler);
          }
          const actualInput = response.inputTokens ?? reservedInput,
            actualOutput = response.outputTokens ?? reservedOutput;
          this.#tokens +=
            actualInput + actualOutput - reservedInput - reservedOutput;
          inputTokens += actualInput;
          outputTokens += actualOutput;
          const cost = priced
            ? (actualInput * this.limits.inputPricePerMillion! +
                actualOutput * this.limits.outputPricePerMillion!) /
              1e6
            : 0;
          this.#cost += cost - reservedCost;
          estimatedCost += cost;
          const tool = toolResponse.safeParse(response.output);
          if (tool.success) {
            if (summoning || toolCalls >= this.limits.maxToolCalls)
              throw new Error("TOOL_LIMIT");
            toolCalls++;
            prompt += JSON.stringify({
              tool: tool.data.tool,
              result: runViewTool(tool.data.tool, view),
            });
            continue;
          }
          const envelope = z
            .strictObject({
              intent: intentSchema,
              note: z.string().max(200).optional(),
            })
            .safeParse(response.output);
          const raw = summoning
            ? {
                type: "SUMMON",
                decision: summoningSchema.parse(response.output),
              }
            : envelope.success
              ? envelope.data.intent
              : response.output;
          const intent = validate(actionTool(raw));
          if (envelope.success && envelope.data.note)
            this.#memory.agentNotes = [
              ...this.#memory.agentNotes,
              String(sanitize(envelope.data.note)),
            ].slice(-8);
          metric(false);
          return intent;
        } catch (error) {
          failureReasons.push(
            abort.signal.aborted
              ? "TIMEOUT"
              : error instanceof z.ZodError
                ? "INVALID_SCHEMA"
                : error instanceof SyntaxError
                  ? "INVALID_JSON"
                  : error instanceof Error &&
                      /^[A-Z][A-Z0-9_]{0,50}$/.test(error.message)
                    ? error.message
                    : "PROVIDER_FAILURE",
          );
          invalidAttempts++;
          if (invalidAttempts > this.limits.retries || abort.signal.aborted)
            break;
          prompt +=
            "\nInvalid response. Return only a valid decision matching the schema and legal game rules.";
        }
      }
    } finally {
      clearTimeout(timer);
    }
    metric(true);
    return validate(await this.fallback.decide(view));
  }
}
export class AgentController implements PlayerController {
  constructor(
    readonly runtime: AgentRuntime,
    private readonly validate: (intent: unknown) => Intent,
  ) {}
  decide(view: PlayerView) {
    return this.runtime.decide(view, this.validate);
  }
}
