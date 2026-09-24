import { GameEngine } from "@grail/game-core";
import { BotController } from "@grail/bot-controller";
import { HumanController } from "@grail/human-controller";
import {
  matchConfigSchema,
  type PlayerController,
  type MatchConfig,
  type Replay,
} from "@grail/shared";
import { aggregateMetrics } from "@grail/telemetry";
import { PlayerViewService } from "@grail/player-core";

/** Persistência de partidas: disco no servidor, localStorage no navegador. */
export interface MatchStorage {
  save(id: string, replay: Replay): Promise<void>;
  load(id: string): Promise<Replay>;
}

/**
 * Integração opcional de Agents. Sem ela, jogadores AGENT decidem como Bot e
 * nenhum código de LLM é carregado.
 */
export interface AgentSupport {
  create(
    player: MatchConfig["players"][number],
    config: MatchConfig,
    engine: GameEngine,
  ): PlayerController;
  exportState(controller: PlayerController): ControllerState | undefined;
  restoreState(controller: PlayerController, state: unknown): void;
  metrics(controller: PlayerController): object[];
}

type ControllerState = NonNullable<Replay["controllerStates"]>[string];
interface Match {
  id: string;
  engine: GameEngine;
  views: PlayerViewService;
  config: MatchConfig;
  controllers: Map<string, PlayerController>;
  viewer: string;
  busy: boolean;
  acknowledgedCombatDay: number;
  listeners: Set<() => void>;
}
export class MatchManager {
  #matches = new Map<string, Match>();
  constructor(
    readonly storage: MatchStorage,
    private readonly agents?: AgentSupport,
  ) {}
  #build(id: string, config: MatchConfig, engine: GameEngine) {
    const match: Match = {
      id,
      config,
      engine,
      views: new PlayerViewService(engine),
      controllers: new Map(),
      viewer:
        config.players.find((p) => p.kind === "HUMAN")?.id ??
        config.players[0].id,
      busy: false,
      acknowledgedCombatDay: 0,
      listeners: this.#matches.get(id)?.listeners ?? new Set(),
    };
    for (const p of config.players) {
      let controller: PlayerController = new BotController(
        p.profile,
        config.seed,
      );
      if (p.kind === "HUMAN") controller = new HumanController();
      if (p.kind === "AGENT" && this.agents)
        controller = this.agents.create(p, config, engine);
      match.controllers.set(p.id, controller);
    }
    this.#matches.set(id, match);
    return match;
  }
  create(input: unknown) {
    const config = matchConfigSchema.parse(input),
      match = this.#build(
        globalThis.crypto.randomUUID(),
        config,
        new GameEngine(config),
      );
    return this.view(match.id);
  }
  #get(id: string) {
    const match = this.#matches.get(id);
    if (!match) throw new Error("MATCH_NOT_FOUND");
    return match;
  }
  view(id: string) {
    const m = this.#get(id);
    return {
      id: m.id,
      view: m.views.forPlayer(m.viewer),
      busy: m.busy,
      combatResolution:
        (m.views.forPlayer(m.viewer).lastCombat?.day ?? 0) >
        m.acknowledgedCombatDay,
      human: m.config.players.some((p) => p.kind === "HUMAN"),
      controllers: m.config.players.map((p) => ({
        id: p.id,
        kind: p.kind,
        profile: p.profile,
      })),
      agentMetrics: this.agents
        ? [...m.controllers.entries()].flatMap(([id, c]) =>
            this.agents!.metrics(c).map((metric) => ({
              playerId: id,
              ...metric,
            })),
          )
        : [],
    };
  }
  subscribe(id: string, listener: () => void) {
    const match = this.#get(id);
    match.listeners.add(listener);
    return () => match.listeners.delete(listener);
  }
  #saveData(m: Match): Replay {
    const agents = this.agents;
    return {
      ...m.engine.exportReplay(),
      presentation: { acknowledgedCombatDay: m.acknowledgedCombatDay },
      controllerStates: agents
        ? Object.fromEntries(
            [...m.controllers.entries()].flatMap(([id, c]) => {
              const state = agents.exportState(c);
              return state === undefined ? [] : [[id, state]];
            }),
          )
        : {},
    };
  }
  async advance(id: string, input?: unknown) {
    const m = this.#get(id);
    if (m.busy) throw new Error("MATCH_BUSY");
    if (this.view(id).combatResolution)
      throw new Error("COMBAT_REVIEW_REQUIRED");
    m.busy = true;
    try {
      if (input !== undefined) {
        const controller = m.controllers.get(m.viewer);
        if (!(controller instanceof HumanController))
          throw new Error("NOT_HUMAN");
        m.engine.validateIntent(m.viewer, input);
        controller.submit(input);
        m.engine.submitIntent(
          m.viewer,
          await controller.decide(m.views.forPlayer(m.viewer)),
        );
      }
      for (const [playerId, controller] of m.controllers) {
        if (controller instanceof HumanController) continue;
        const view = m.views.forPlayer(playerId);
        if (view.canAct)
          m.engine.submitIntent(playerId, await controller.decide(view));
      }
      if (m.engine.isReady()) m.engine.resolvePhase();
      await this.storage.save(id, this.#saveData(m));
    } finally {
      m.busy = false;
      for (const listener of m.listeners) listener();
    }
    return this.view(id);
  }
  async save(id: string) {
    const m = this.#get(id);
    if (m.busy) throw new Error("MATCH_BUSY");
    await this.storage.save(id, this.#saveData(m));
    return { ok: true };
  }
  async acknowledgeCombat(id: string, day: number) {
    const m = this.#get(id);
    if (m.busy) throw new Error("MATCH_BUSY");
    if (m.views.forPlayer(m.viewer).lastCombat?.day !== day)
      throw new Error("INVALID_COMBAT_REPORT");
    m.busy = true;
    try {
      m.acknowledgedCombatDay = day;
      await this.storage.save(id, this.#saveData(m));
    } finally {
      m.busy = false;
      for (const listener of m.listeners) listener();
    }
    return this.view(id);
  }
  async load(id: string) {
    if (this.#matches.get(id)?.busy) throw new Error("MATCH_BUSY");
    const replay = await this.storage.load(id),
      engine = GameEngine.fromReplay(replay);
    const match = this.#build(id, replay.config, engine);
    match.acknowledgedCombatDay =
      replay.presentation?.acknowledgedCombatDay ?? 0;
    if (this.agents)
      for (const [playerId, state] of Object.entries(
        replay.controllerStates ?? {},
      )) {
        const c = match.controllers.get(playerId);
        if (c) this.agents.restoreState(c, state);
      }
    return this.view(id);
  }
  replay(id: string) {
    const m = this.#get(id);
    if (m.engine.phase !== "FINISHED")
      throw new Error("REPLAY_AVAILABLE_AFTER_MATCH");
    return {
      replay: this.#saveData(m),
      events: m.engine.auditEvents(),
      metrics: aggregateMetrics(m.engine.auditEvents()),
    };
  }
  replayFrame(id: string, step: number) {
    const m = this.#get(id);
    this.replay(id);
    const replay = m.engine.exportReplay();
    return GameEngine.fromReplay(replay, step).playerView(m.viewer);
  }
  importReplay(input: Replay) {
    const engine = GameEngine.fromReplay(input);
    return this.#build(globalThis.crypto.randomUUID(), input.config, engine).id;
  }
}
