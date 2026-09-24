import { describe, it, expect } from "vitest";
import {
  GameEngine,
  RandomService,
  summon,
  candidateWeights,
} from "@grail/game-core";
import { BotController } from "@grail/bot-controller";
import { servants } from "../data/servants/index.js";
import { runMatch } from "../scripts/simulate.js";
import type { SummoningDecision, Intent } from "@grail/shared";
const ritual: SummoningDecision = {
  desiredTrait: "ANY",
  grailWish: "NO_WISH",
  alignment: "TRUE_NEUTRAL",
  catalyst: "NONE",
  classFocus: "NONE",
  manaOffering: "LOW",
};
function create() {
  return new GameEngine({
    seed: 42,
    locationCount: 4,
    players: [
      { id: "a", name: "A", kind: "BOT" },
      { id: "b", name: "B", kind: "BOT" },
      { id: "c", name: "C", kind: "BOT" },
    ],
  });
}
function all(e: GameEngine, intent: Intent) {
  for (const id of e.playerIds)
    if (e.playerView(id).canAct) e.submitIntent(id, intent);
  e.resolvePhase();
}
function summoned() {
  const e = create();
  all(e, { type: "SUMMON", decision: ritual });
  return e;
}
describe("authoritative engine", () => {
  it("has 63 distinct servants and a positive probabilistic pool", () => {
    expect(servants).toHaveLength(63);
    expect(new Set(servants.map((s) => s.id)).size).toBe(63);
    for (let r = 1; r <= 5; r++) {
      const pool = servants.filter((s) => s.rarity === r);
      expect(pool).toHaveLength(r >= 4 ? 21 : 7);
      expect(candidateWeights(ritual, pool).every((w) => w.weight > 0)).toBe(
        true,
      );
    }
  });
  it("uses deterministic two-stage summoning", () => {
    expect(summon(ritual, new RandomService(32))).toEqual(
      summon(ritual, new RandomService(32)),
    );
    const rng = new RandomService(4);
    expect(
      new Set(Array.from({ length: 100 }, () => summon(ritual, rng).servant.id))
        .size,
    ).toBeGreaterThan(10);
  });
  it("locks locations and rejects hostile input", () => {
    const e = summoned();
    expect(() =>
      e.submitIntent("a", { type: "DAY_ACTION", action: { type: "HIDE" } }),
    ).toThrow("WRONG_PHASE");
    e.submitIntent("a", { type: "LOCATION", location: "location-1" });
    expect(() =>
      e.submitIntent("a", { type: "LOCATION", location: "location-2" }),
    ).toThrow("ALREADY_LOCKED");
    for (const id of ["b", "c"])
      e.submitIntent(id, { type: "LOCATION", location: "location-2" });
    e.resolvePhase();
    expect(() =>
      e.submitIntent("a", {
        type: "DAY_ACTION",
        action: { type: "TRANSFER_MANA", amount: -5 },
      }),
    ).toThrow();
    expect(() =>
      e.submitIntent("a", {
        type: "DAY_ACTION",
        action: { type: "INVESTIGATE_MASTER", target: "missing" },
      }),
    ).toThrow("INVALID_TARGET");
  });
  it("does not leak enemy private fields or mutable state", () => {
    const e = summoned();
    e.submitIntent("b", { type: "LOCATION", location: "location-3" });
    const v = e.playerView("a"),
      b = v.enemies.find((p) => p.id === "b")!;
    for (const key of ["mana", "np", "servant", "hp", "location", "prepared"])
      expect(b).not.toHaveProperty(key);
    expect(b.identity).toBe(0);
    expect(
      v.events.some((ev) => ev.actor === "b" && ev.type === "SUMMONED"),
    ).toBe(false);
    v.self.mana = 9999;
    v.self.servant!.buster = 99999;
    expect(e.playerView("a").self.mana).toBe(90);
    expect(e.playerView("a").self.servant!.buster).not.toBe(99999);
    expect(Object.keys(e)).toEqual([]);
  });
  it("resolves Hide simultaneously", () => {
    const e = summoned();
    all(e, { type: "LOCATION", location: "location-1" });
    e.submitIntent("a", {
      type: "DAY_ACTION",
      action: { type: "INVESTIGATE_SERVANT", target: "b" },
    });
    e.submitIntent("b", { type: "DAY_ACTION", action: { type: "HIDE" } });
    e.submitIntent("c", {
      type: "DAY_ACTION",
      action: { type: "INVESTIGATE_MASTER", target: "b" },
    });
    e.resolvePhase();
    expect(e.playerView("a").self.identity.b ?? 0).toBe(0);
    expect(
      e
        .playerView("c")
        .events.some((ev) => ev.type === "INVESTIGATION_BLOCKED"),
    ).toBe(true);
    expect(e.playerView("a").enemies[0].location).toBe("location-1");
  });
  it("provides two possible locations containing exactly the destination", () => {
    const e = summoned();
    all(e, { type: "LOCATION", location: "location-1" });
    e.submitIntent("a", {
      type: "DAY_ACTION",
      action: { type: "INVESTIGATE_MASTER", target: "b" },
    });
    for (const id of ["b", "c"])
      e.submitIntent(id, {
        type: "DAY_ACTION",
        action: { type: "USE_LEYLINE" },
      });
    e.resolvePhase();
    const clue = e
      .playerView("a")
      .events.find((ev) => ev.type === "LOCATION_CLUE")!
      .detail!.split("|");
    expect(clue).toHaveLength(2);
    expect(new Set(clue).size).toBe(2);
    expect(clue).toContain("location-1");
    expect(
      e.playerView("b").events.some((ev) => ev.type === "LOCATION_CLUE"),
    ).toBe(false);
  });
  it("resolves every directed attack in a three-way fight", () => {
    const e = summoned();
    all(e, { type: "LOCATION", location: "location-1" });
    all(e, { type: "DAY_ACTION", action: { type: "PREPARE_TERRAIN" } });
    for (const id of e.playerIds)
      e.submitIntent(id, {
        type: "COMBAT",
        decision: {
          useNP: false,
          attacks: e
            .playerView(id)
            .combatTargets.map((target) => ({ target, type: "BUSTER" })),
        },
      });
    e.resolvePhase();
    expect(
      e.playerView("a").events.filter((ev) => ev.type === "DAMAGE_RESOLVED"),
    ).toHaveLength(6);
    expect(e.playerView("a").self.prepared).toBe(false);
  });
  it("finishes headless matches and reconstructs exact replay", async () => {
    for (let seed = 0; seed < 12; seed++) {
      const { engine, complete } = await runMatch(seed);
      expect(complete).toBe(true);
      const replay = GameEngine.fromReplay(engine.exportReplay());
      for (const id of engine.playerIds)
        expect(replay.playerView(id)).toEqual(engine.playerView(id));
    }
  });
  it("bots only need PlayerView", async () => {
    const e = create();
    const bot = new BotController("Investigator");
    const action = await bot.decide(e.playerView("a"));
    expect(() => e.submitIntent("a", action)).not.toThrow();
  });
});
