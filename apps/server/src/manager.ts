import { AgentController, AgentRuntime } from "@grail/agent-controller";
import { BotController } from "@grail/bot-controller";
import {
  HTTPProvider,
  LLMGateway,
  providerConfigSchema,
  type ProviderConfig,
} from "@grail/llm";
import {
  MatchManager as CoreMatchManager,
  type AgentSupport,
} from "@grail/match-runtime";
import { LocalStorage } from "./storage.js";

/** Liga jogadores AGENT às conexões configuradas; sem conexão, o Bot assume. */
function agentSupport(providers: Map<string, ProviderConfig>): AgentSupport {
  return {
    create(p, config, engine) {
      const settings = p.providerId ? providers.get(p.providerId) : undefined;
      const gateway = new LLMGateway(
        settings
          ? new HTTPProvider(settings)
          : {
              id: "unconfigured",
              model: "fallback",
              generate: async () => {
                throw new Error("PROVIDER_UNAVAILABLE");
              },
            },
      );
      const runtime = new AgentRuntime(
        gateway,
        {
          ...settings?.limits,
          inputPricePerMillion: settings?.inputPricePerMillion,
          outputPricePerMillion: settings?.outputPricePerMillion,
        },
        new BotController(p.profile, config.seed),
      );
      return new AgentController(runtime, (input) =>
        engine.validateIntent(p.id, input),
      );
    },
    exportState: (c) =>
      c instanceof AgentController ? c.runtime.exportState() : undefined,
    restoreState: (c, state) => {
      if (c instanceof AgentController) c.runtime.restoreState(state);
    },
    metrics: (c) => (c instanceof AgentController ? c.runtime.metrics() : []),
  };
}

export class MatchManager extends CoreMatchManager {
  declare readonly storage: LocalStorage;
  #providers: Map<string, ProviderConfig>;
  constructor(storage = new LocalStorage()) {
    const providers = new Map<string, ProviderConfig>();
    super(storage, agentSupport(providers));
    this.#providers = providers;
  }
  async restoreProviders() {
    for (const config of await this.storage.providers()) {
      try {
        new HTTPProvider(config);
        this.#providers.set(config.id, config);
      } catch {
        /* Configurações obsoletas não bloqueiam o jogo offline. */
      }
    }
  }
  async addProvider(input: unknown) {
    const config = providerConfigSchema.parse(input);
    new HTTPProvider(config);
    this.#providers.set(config.id, config);
    await this.storage.setProviders([...this.#providers.values()]);
    return this.providers();
  }
  async removeProvider(id: string) {
    if (!this.#providers.delete(id)) throw new Error("PROVIDER_NOT_FOUND");
    await this.storage.setProviders([...this.#providers.values()]);
    return this.providers();
  }
  providers() {
    return [...this.#providers.values()].map(({ apiKey: _key, ...p }) => ({
      ...p,
      configured: true,
    }));
  }
  async testProvider(id: string) {
    const config = this.#providers.get(id);
    if (!config) throw new Error("PROVIDER_NOT_FOUND");
    const provider = new HTTPProvider(config);
    await provider.generate({
      prompt: 'Return JSON {"ok":true}.',
      schema: {
        type: "object",
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
      },
      // Folga para modelos que raciocinam antes da resposta e serviços
      // remotos mais lentos que um Ollama local.
      maxOutputTokens: Math.max(256, config.limits?.maxOutputTokens ?? 0),
      signal: AbortSignal.timeout(config.limits?.timeoutMs ?? 30000),
    });
    return { ok: true };
  }
}
