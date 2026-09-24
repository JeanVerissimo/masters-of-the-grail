import {
  matchConfigSchema,
  intentSchema,
  replaySchema,
  traits,
  wishes,
  alignments,
  catalysts,
  classes,
  offerings,
  type MatchConfig,
  type Intent,
  type OwnPlayer,
  type Phase,
  type GameEvent,
  type PlayerView,
  type Replay,
  type DayAction,
  type CombatDecision,
} from "@grail/shared";
import { balance } from "../../../data/balance/index.js";
import { RandomService } from "./random.js";
import { summon } from "./summoning.js";
import { legacyServants } from "../../../data/servants/index.js";
import type {
  CombatHit,
  CombatReport,
} from "../../shared/src/combat-report.js";

interface PlayerState extends OwnPlayer {
  hidden: boolean;
}
export class GameEngine {
  #config: MatchConfig;
  #random: RandomService;
  #players: PlayerState[];
  #pending = new Map<string, Intent>();
  #phase: Phase = "SUMMONING";
  #day = 0;
  #events: GameEvent[] = [];
  #decisions: Replay["decisions"] = [];
  #winner: string | null = null;
  #combatReports = new Map<string, CombatReport>();
  constructor(input: unknown) {
    this.#config = matchConfigSchema.parse(input);
    this.#config.rosterVersion ??= 2;
    this.#config.summoningVersion ??= 2;
    this.#config.discoveryVersion ??= 2;
    this.#random = new RandomService(this.#config.seed);
    this.#players = this.#config.players.map((p) => ({
      id: p.id,
      name: p.name,
      alive: true,
      servant: null,
      hp: 0,
      mana: balance.initialMana,
      np: 0,
      location: null,
      prepared: false,
      hidden: false,
      identity: {},
    }));
  }
  get phase() {
    return this.#phase;
  }
  get day() {
    return this.#day;
  }
  get playerIds() {
    return this.#players.map((p) => p.id);
  }
  get locations() {
    return Array.from(
      { length: this.#config.locationCount },
      (_, i) => `location-${i + 1}`,
    );
  }
  #player(id: string) {
    const p = this.#players.find((p) => p.id === id);
    if (!p) throw new Error("INVALID_PLAYER");
    return p;
  }
  #emit(
    type: string,
    fields: Partial<Omit<GameEvent, "type" | "sequence" | "day">> = {},
  ) {
    this.#events.push({
      sequence: this.#events.length,
      day: this.#day,
      type,
      audience: "PUBLIC",
      ...fields,
    });
  }
  #targets(p: PlayerState) {
    return this.#players.filter(
      (t) => t.alive && t.id !== p.id && t.location === p.location,
    );
  }
  #participants() {
    return this.#players.filter(
      (p) =>
        p.alive && (this.#phase !== "COMBAT" || this.#targets(p).length > 0),
    );
  }
  validateIntent(playerId: string, input: unknown): Intent {
    const intent = intentSchema.parse(input),
      p = this.#player(playerId);
    if (!p.alive || this.#phase === "FINISHED")
      throw new Error("PLAYER_CANNOT_ACT");
    if (this.#pending.has(playerId)) throw new Error("ALREADY_LOCKED");
    const required = this.#phase === "SUMMONING" ? "SUMMON" : this.#phase;
    if (intent.type !== required) throw new Error("WRONG_PHASE");
    if (
      intent.type === "SUMMON" &&
      balance.offeringCost[intent.decision.manaOffering] > p.mana
    )
      throw new Error("INSUFFICIENT_MANA");
    if (intent.type === "LOCATION" && !this.locations.includes(intent.location))
      throw new Error("INVALID_LOCATION");
    if (intent.type === "DAY_ACTION") {
      const a = intent.action;
      if ("target" in a) {
        const target = this.#players.find((t) => t.id === a.target);
        if (!target?.alive || target.id === p.id)
          throw new Error("INVALID_TARGET");
      }
      if (a.type === "TRANSFER_MANA" && a.amount > p.mana)
        throw new Error("INSUFFICIENT_MANA");
    }
    if (intent.type === "COMBAT") {
      const targets = this.#targets(p).map((t) => t.id),
        d = intent.decision;
      if (!targets.length) throw new Error("NO_BATTLE");
      if (d.useNP) {
        if (p.np < balance.np.max || d.attacks.length)
          throw new Error("INVALID_NP");
      } else if (
        d.attacks.length !== targets.length ||
        new Set(d.attacks.map((a) => a.target)).size !== targets.length ||
        d.attacks.some((a) => !targets.includes(a.target))
      )
        throw new Error("INVALID_COMBAT_TARGETS");
    }
    return intent;
  }
  submitIntent(playerId: string, input: unknown) {
    const intent = this.validateIntent(playerId, input);
    this.#pending.set(playerId, structuredClone(intent));
    this.#decisions.push({ playerId, intent: structuredClone(intent) });
    if (intent.type === "LOCATION")
      this.#player(playerId).location = intent.location;
  }
  isReady() {
    return (
      this.#phase !== "FINISHED" &&
      this.#participants().every((p) => this.#pending.has(p.id))
    );
  }
  resolvePhase() {
    if (!this.isReady()) throw new Error("PHASE_NOT_READY");
    if (this.#phase === "SUMMONING") {
      for (const p of this.#players) {
        const i = this.#pending.get(p.id)!;
        if (i.type !== "SUMMON") throw new Error("INTERNAL_INTENT");
        const result = summon(
          i.decision,
          this.#random,
          this.#config.rosterVersion === 1 ? legacyServants : undefined,
          this.#config.summoningVersion,
        );
        p.servant = result.servant;
        p.hp = result.servant.maxHp;
        p.mana -= result.manaCost;
        this.#emit("MANA_SPENT", {
          actor: p.id,
          value: result.manaCost,
          audience: [p.id],
        });
        this.#emit("SUMMONED", {
          actor: p.id,
          detail: p.servant.trueName,
          audience: [p.id],
        });
      }
      this.#startDay();
    } else if (this.#phase === "LOCATION") {
      this.#phase = "DAY_ACTION";
    } else if (this.#phase === "DAY_ACTION") {
      this.#resolveDay();
      this.#phase = "COMBAT";
    } else if (this.#phase === "COMBAT") {
      this.#resolveCombat();
    }
    this.#pending.clear();
    if (this.#phase === "COMBAT" && this.#participants().length === 0) {
      this.#resolveCombat();
    }
  }
  #startDay() {
    this.#day++;
    this.#phase = "LOCATION";
    for (const p of this.#players) {
      p.location = null;
      p.prepared = false;
      p.hidden = false;
    }
    this.#emit("DAY_STARTED");
  }
  #gainIdentity(
    observer: PlayerState,
    target: PlayerState,
    base: number,
    absolute = false,
  ) {
    const previous = observer.identity[target.id] ?? 0;
    const gain = base / (1 + target.servant!.mystery / balance.mysteryDivisor);
    const next = absolute
      ? 100
      : Math.min(100, Math.round((previous + gain) * 100) / 100);
    observer.identity[target.id] = next;
    this.#emit("IDENTITY_GAINED", {
      actor: observer.id,
      target: target.id,
      value: next - previous,
      audience: [observer.id],
    });
    if (previous < 100 && next === 100)
      this.#emit("IDENTITY_DISCOVERED", {
        actor: observer.id,
        target: target.id,
        detail: target.servant!.trueName,
        audience: [observer.id],
      });
  }
  #resolveDay() {
    const identity =
      this.#config.discoveryVersion === 1
        ? balance.identity
        : balance.discovery;
    const actions = new Map<string, DayAction>();
    for (const p of this.#players.filter((p) => p.alive)) {
      const i = this.#pending.get(p.id)!;
      if (i.type === "DAY_ACTION") actions.set(p.id, i.action);
    }
    // Hide vale para toda a resolução, independentemente da ordem dos jogadores.
    for (const [id, a] of actions)
      if (a.type === "HIDE") this.#player(id).hidden = true;
    for (const [id, a] of actions) {
      const p = this.#player(id);
      this.#emit("DAY_ACTION", { actor: id, detail: a.type, audience: [id] });
      switch (a.type) {
        case "TRANSFER_MANA": {
          const healed = Math.min(
            p.servant!.maxHp - p.hp,
            Math.round(
              a.amount *
                p.servant!.manaEfficiency *
                balance.healingPerEfficiency,
            ),
          );
          p.mana -= a.amount;
          p.hp += healed;
          this.#emit("MANA_SPENT", {
            actor: id,
            value: a.amount,
            audience: [id],
          });
          this.#emit("HEALED", { actor: id, value: healed, audience: [id] });
          break;
        }
        case "PREPARE_TERRAIN":
          p.prepared = true;
          break;
        case "USE_LEYLINE":
          p.np = Math.min(balance.np.max, p.np + balance.np.leyline);
          break;
        case "HIDE":
          break;
        default: {
          const target = this.#player(a.target);
          if (target.hidden) {
            this.#emit("INVESTIGATION_BLOCKED", {
              actor: id,
              target: target.id,
              audience: [id],
            });
            break;
          }
          if (a.type === "INVESTIGATE_SERVANT")
            this.#gainIdentity(p, target, identity.investigate);
          else {
            const falseLocation = this.#random.pick(
              this.locations.filter((l) => l !== target.location),
            );
            const pair = [target.location!, falseLocation];
            if (this.#random.next() < 0.5) pair.reverse();
            this.#emit("LOCATION_CLUE", {
              actor: id,
              target: target.id,
              detail: pair.join("|"),
              audience: [id],
            });
          }
        }
      }
    }
    this.#emit("NIGHT_STARTED");
    for (const p of this.#players.filter((p) => p.alive))
      this.#emit("LOCATION_REVEALED", { actor: p.id, detail: p.location! });
  }
  #resolveCombat() {
    const identity =
      this.#config.discoveryVersion === 1
        ? balance.identity
        : balance.discovery;
    const combatDay = this.#day;
    const before = new Map(
      this.#players.map((p) => [
        p.id,
        { hp: p.hp, np: p.np, location: p.location },
      ]),
    );
    const living = this.#players.filter((p) => p.alive),
      damage = new Map<string, number>();
    const hits: CombatHit[] = [];
    const npUsers: PlayerState[] = [];
    const decision = (p: PlayerState): CombatDecision => {
      const i = this.#pending.get(p.id);
      if (i?.type !== "COMBAT") throw new Error("MISSING_COMBAT");
      return i.decision;
    };
    const attackType = (p: PlayerState, target: string) => {
      const d = decision(p);
      return d.useNP
        ? p.servant!.noblePhantasm.type
        : d.attacks.find((a) => a.target === target)!.type;
    };
    const beats = { BUSTER: "ARTS", ARTS: "QUICK", QUICK: "BUSTER" };
    for (const p of living) {
      const targets = this.#targets(p);
      if (!targets.length) continue;
      const d = decision(p);
      if (d.useNP) npUsers.push(p);
      for (const target of targets) {
        const own = attackType(p, target.id),
          enemy = attackType(target, p.id);
        const s = p.servant!;
        const base =
          own === "BUSTER" ? s.buster : own === "ARTS" ? s.arts : s.quick;
        const matchup =
          own === enemy
            ? balance.damage.tie
            : beats[own] === enemy
              ? balance.damage.win
              : balance.damage.lose;
        const value = Math[balance.damage.rounding](
          base *
            matchup *
            ((p.identity[target.id] ?? 0) >= 100
              ? balance.damage.trueName
              : 1) *
            (p.prepared ? balance.damage.terrain : 1) *
            (d.useNP ? s.noblePhantasm.power : 1),
        );
        hits.push({
          actor: p.id,
          target: target.id,
          value,
          attackType: own,
          opponentType: enemy,
          matchup,
          terrainMultiplier: p.prepared ? balance.damage.terrain : 1,
          identityMultiplier:
            (p.identity[target.id] ?? 0) >= 100 ? balance.damage.trueName : 1,
          npMultiplier: d.useNP ? s.noblePhantasm.power : 1,
          useNP: d.useNP,
        });
        damage.set(target.id, (damage.get(target.id) ?? 0) + value);
      }
    }
    for (const hit of hits)
      this.#emit("DAMAGE_RESOLVED", {
        actor: hit.actor,
        target: hit.target,
        value: hit.value,
        audience: living
          .filter((p) => p.location === this.#player(hit.actor).location)
          .map((p) => p.id),
      });
    for (const p of npUsers) {
      p.np = 0;
      this.#emit("NP_USED", { actor: p.id });
    }
    for (const p of living) {
      for (const target of this.#targets(p))
        this.#gainIdentity(p, target, identity.battle);
      for (const target of npUsers.filter((t) => t.id !== p.id))
        this.#gainIdentity(
          p,
          target,
          identity.remoteNP,
          p.location === target.location,
        );
    }
    for (const p of living) {
      p.hp = Math.max(0, p.hp - (damage.get(p.id) ?? 0));
      if (p.hp === 0) {
        p.alive = false;
        this.#emit("PLAYER_ELIMINATED", {
          actor: p.id,
          detail: p.servant!.trueName,
        });
      }
    }
    for (const p of living) {
      const eliminatedTargets = hits.filter(
        (h) => h.actor === p.id && !this.#player(h.target).alive,
      );
      for (const hit of eliminatedTargets)
        this.#emit("ELIMINATION_CREDIT", {
          actor: p.id,
          target: hit.target,
          audience: [p.id],
        });
      if (p.alive)
        p.np = Math.min(
          balance.np.max,
          p.np + eliminatedTargets.length * balance.np.kill,
        );
    }
    const survivors = this.#players.filter((p) => p.alive);
    if (survivors.length <= 1) {
      this.#phase = "FINISHED";
      this.#winner = survivors[0]?.id ?? null;
      this.#emit("MATCH_FINISHED", { actor: this.#winner ?? undefined });
    } else this.#startDay();
    for (const p of living) {
      const ownBefore = before.get(p.id)!;
      const localHits = hits.filter(
        (h) => before.get(h.actor)?.location === ownBefore.location,
      );
      if (!localHits.length) continue;
      const opponentIds = living
        .filter(
          (other) =>
            other.id !== p.id &&
            before.get(other.id)?.location === ownBefore.location,
        )
        .map((other) => other.id);
      const visible = this.playerView(p.id);
      this.#combatReports.set(p.id, {
        day: combatDay,
        location: ownBefore.location!,
        hits: structuredClone(localHits),
        self: {
          hpBefore: ownBefore.hp,
          hpAfter: p.hp,
          maxHp: p.servant!.maxHp,
          npBefore: ownBefore.np,
          npAfter: p.np,
        },
        opponents: visible.enemies
          .filter((e) => opponentIds.includes(e.id))
          .map(({ id, name, alive, condition, trueName }) => ({
            id,
            name,
            alive,
            condition,
            ...(trueName ? { trueName } : {}),
          })),
        npUsers: npUsers
          .filter(
            (other) => before.get(other.id)?.location === ownBefore.location,
          )
          .map((other) => other.id),
        eliminated: living
          .filter(
            (other) =>
              !other.alive &&
              before.get(other.id)?.location === ownBefore.location,
          )
          .map((other) => other.id),
        finished: this.#phase === "FINISHED",
        winner: this.#winner,
      });
    }
  }
  playerView(playerId: string): PlayerView {
    const p = this.#player(playerId),
      night = this.#phase === "COMBAT" || this.#phase === "FINISHED";
    const enemies = this.#players
      .filter((t) => t.id !== p.id)
      .map((t) => {
        const publicIdentity = !t.alive || this.#phase === "FINISHED";
        const known = publicIdentity || (p.identity[t.id] ?? 0) >= 100;
        return {
          id: t.id,
          name: t.name,
          alive: t.alive,
          identity: publicIdentity ? 100 : (p.identity[t.id] ?? 0),
          condition: (!t.alive
            ? "DEFEATED"
            : !t.servant
              ? "UNKNOWN"
              : t.hp / t.servant.maxHp > 0.65
                ? "HEALTHY"
                : t.hp / t.servant.maxHp > 0.3
                  ? "WOUNDED"
                  : "CRITICAL") as PlayerView["enemies"][number]["condition"],
          ...(known && t.servant
            ? {
                trueName: t.servant.trueName,
                class: t.servant.class,
                rarity: t.servant.rarity,
              }
            : {}),
          ...(night && t.location ? { location: t.location } : {}),
        };
      });
    const { hidden: _hidden, ...self } = p;
    const canAct =
      p.alive &&
      this.#phase !== "FINISHED" &&
      !this.#pending.has(p.id) &&
      (this.#phase !== "COMBAT" || this.#targets(p).length > 0);
    return structuredClone({
      day: this.#day,
      ...(this.#combatReports.has(playerId)
        ? { lastCombat: this.#combatReports.get(playerId) }
        : {}),
      phase: this.#phase,
      self,
      enemies,
      locations: this.locations,
      events: this.#events.filter(
        (e) => e.audience === "PUBLIC" || e.audience.includes(playerId),
      ),
      ready: this.#pending.has(p.id),
      canAct,
      combatTargets:
        this.#phase === "COMBAT" ? this.#targets(p).map((t) => t.id) : [],
      winner: this.#winner,
      legalIntents: canAct ? this.#legalIntents(p) : [],
      summoningOptions: {
        traits,
        wishes,
        alignments,
        catalysts,
        classes: ["NONE", ...classes],
        offerings,
      },
    });
  }
  #legalIntents(p: PlayerState): Intent[] {
    if (this.#phase === "SUMMONING")
      return offerings
        .filter((o) => balance.offeringCost[o] <= p.mana)
        .map((manaOffering) => ({
          type: "SUMMON",
          decision: {
            desiredTrait: "ANY",
            grailWish: "NO_WISH",
            alignment: "TRUE_NEUTRAL",
            catalyst: "NONE",
            classFocus: "NONE",
            manaOffering,
          },
        }));
    if (this.#phase === "LOCATION")
      return this.locations.map((location) => ({ type: "LOCATION", location }));
    if (this.#phase === "DAY_ACTION") {
      const actions: DayAction[] = [
        { type: "PREPARE_TERRAIN" },
        { type: "HIDE" },
        { type: "USE_LEYLINE" },
      ];
      if (p.mana > 0)
        actions.push({
          type: "TRANSFER_MANA",
          amount: Math.min(p.mana, balance.bot.healingAmount),
        });
      for (const t of this.#players.filter((t) => t.alive && t.id !== p.id))
        actions.push(
          { type: "INVESTIGATE_SERVANT", target: t.id },
          { type: "INVESTIGATE_MASTER", target: t.id },
        );
      return actions.map((action) => ({ type: "DAY_ACTION", action }));
    }
    if (this.#phase === "COMBAT") {
      const result: Intent[] = (["BUSTER", "ARTS", "QUICK"] as const).map(
        (type) => ({
          type: "COMBAT",
          decision: {
            useNP: false,
            attacks: this.#targets(p).map((t) => ({ target: t.id, type })),
          },
        }),
      );
      if (p.np >= balance.np.max)
        result.push({ type: "COMBAT", decision: { useNP: true, attacks: [] } });
      return result;
    }
    return [];
  }
  exportReplay(): Replay {
    return structuredClone({
      saveVersion: 1,
      config: {
        ...this.#config,
        rosterVersion: this.#config.rosterVersion ?? 2,
        summoningVersion: this.#config.summoningVersion ?? 2,
        discoveryVersion: this.#config.discoveryVersion ?? 2,
      },
      decisions: this.#decisions,
    });
  }
  auditEvents() {
    if (this.#phase !== "FINISHED")
      throw new Error("REPLAY_AVAILABLE_AFTER_MATCH");
    return structuredClone(this.#events);
  }
  static fromReplay(input: unknown, limit?: number): GameEngine {
    const replay = replaySchema.parse(input),
      engine = new GameEngine(replay.config);
    for (const record of replay.decisions.slice(0, limit)) {
      engine.submitIntent(record.playerId, record.intent);
      if (engine.isReady()) engine.resolvePhase();
    }
    return engine;
  }
}
