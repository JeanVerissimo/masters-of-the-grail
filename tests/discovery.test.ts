import { it, expect } from "vitest";
import { GameEngine } from "@grail/game-core";
import { BotController } from "@grail/bot-controller";
import { servants } from "../data/servants/index.js";
import type { Intent } from "@grail/shared";

function create(discoveryVersion = 2, count = 3) {
  const engine = new GameEngine({
    seed: 48,
    discoveryVersion,
    locationCount: 4,
    players: Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      kind: "BOT",
    })),
  });
  all(engine, () => ({
    type: "SUMMON",
    decision: {
      desiredTrait: "ANY",
      grailWish: "NO_WISH",
      alignment: "TRUE_NEUTRAL",
      catalyst: "NONE",
      classFocus: "NONE",
      manaOffering: "LOW",
    },
  }));
  return engine;
}
function all(engine: GameEngine, intent: (id: string) => Intent) {
  for (const id of engine.playerIds)
    if (engine.playerView(id).canAct) engine.submitIntent(id, intent(id));
  engine.resolvePhase();
}
it("reveals defeated servants to remote observers and all survivors only at the end", () => {
  const original = structuredClone(servants);
  try {
    for (const s of servants) {
      s.maxHp = 100;
      s.buster = 200;
    }
    const engine = create(2, 4);
    expect(engine.playerView("p3").enemies.every((e) => !e.trueName)).toBe(
      true,
    );
    all(engine, (id) => ({
      type: "LOCATION",
      location:
        id === "p0" || id === "p1"
          ? "location-1"
          : id === "p2"
            ? "location-2"
            : "location-3",
    }));
    all(engine, () => ({ type: "DAY_ACTION", action: { type: "HIDE" } }));
    all(engine, (id) => ({
      type: "COMBAT",
      decision: {
        useNP: false,
        attacks: engine
          .playerView(id)
          .combatTargets.map((target) => ({ target, type: "BUSTER" })),
      },
    }));
    expect(engine.phase).toBe("LOCATION");
    const remote = engine.playerView("p3");
    for (const id of ["p0", "p1"]) {
      expect(remote.enemies.find((e) => e.id === id)).toMatchObject({
        alive: false,
        identity: 100,
        trueName: engine.playerView(id).self.servant!.trueName,
      });
      expect(
        remote.events.find(
          (e) => e.type === "PLAYER_ELIMINATED" && e.actor === id,
        )?.detail,
      ).toBe(engine.playerView(id).self.servant!.trueName);
    }
    expect(remote.enemies.find((e) => e.id === "p2")?.trueName).toBeUndefined();
    expect(
      engine.playerView("p0").lastCombat!.opponents[0].trueName,
    ).toBeTruthy();
    expect(
      engine
        .playerView("p0")
        .lastCombat!.hits.every((h) => h.identityMultiplier === 1),
    ).toBe(true);
    all(engine, () => ({ type: "LOCATION", location: "location-1" }));
    all(engine, () => ({ type: "DAY_ACTION", action: { type: "HIDE" } }));
    all(engine, (id) => ({
      type: "COMBAT",
      decision: {
        useNP: false,
        attacks: engine
          .playerView(id)
          .combatTargets.map((target) => ({ target, type: "BUSTER" })),
      },
    }));
    expect(engine.phase).toBe("FINISHED");
    for (const id of engine.playerIds) {
      const view = engine.playerView(id);
      expect(
        view.enemies.every(
          (e) => e.trueName && e.class && e.rarity && e.identity === 100,
        ),
      ).toBe(true);
      for (const enemy of view.enemies)
        for (const key of ["hp", "mana", "np", "servant"])
          expect(enemy).not.toHaveProperty(key);
      expect(
        GameEngine.fromReplay(engine.exportReplay()).playerView(id),
      ).toEqual(view);
    }
  } finally {
    servants.splice(0, servants.length, ...original);
  }
});
it("reveals the surviving winner to already defeated observers", async () => {
  const engine = create(2, 3);
  const bots = engine.playerIds.map(() => new BotController("Balanced", 48));
  for (let step = 0; step < 4000 && engine.phase !== "FINISHED"; step++) {
    for (const [i, id] of engine.playerIds.entries())
      if (engine.playerView(id).canAct)
        engine.submitIntent(id, await bots[i].decide(engine.playerView(id)));
    engine.resolvePhase();
  }
  expect(engine.phase).toBe("FINISHED");
  expect(engine.playerView("p0").winner).toBeTruthy();
  expect(engine.playerView("p0").enemies.every((e) => e.trueName)).toBe(true);
});
it("raises investigation to 25 base, preserves old saves and keeps Hide effective", () => {
  for (const version of [1, 2]) {
    const engine = create(version);
    all(engine, (id) => ({
      type: "LOCATION",
      location: `location-${Number(id.slice(1)) + 1}`,
    }));
    all(engine, (id) => ({
      type: "DAY_ACTION",
      action:
        id === "p0"
          ? { type: "INVESTIGATE_SERVANT", target: "p1" }
          : { type: "USE_LEYLINE" },
    }));
    const mystery = engine.playerView("p1").self.servant!.mystery;
    expect(engine.playerView("p0").self.identity.p1).toBeCloseTo(
      Math.round(((version === 1 ? 10 : 25) / (1 + mystery / 100)) * 100) / 100,
      2,
    );
    const before = engine.playerView("p0").self.identity.p1;
    all(engine, (id) => ({
      type: "LOCATION",
      location: `location-${Number(id.slice(1)) + 1}`,
    }));
    all(engine, (id) => ({
      type: "DAY_ACTION",
      action:
        id === "p0"
          ? { type: "INVESTIGATE_SERVANT", target: "p1" }
          : { type: "HIDE" },
    }));
    expect(engine.playerView("p0").self.identity.p1).toBe(before);
    const file = JSON.parse(JSON.stringify(engine.exportReplay()));
    if (version === 1) delete file.config.discoveryVersion;
    expect(GameEngine.fromReplay(file).playerView("p0")).toEqual(
      engine.playerView("p0"),
    );
  }
});
it("varies Bot movement across game seeds while keeping each decision reproducible", async () => {
  const view = create().playerView("p0");
  const destinations = new Set<string>();
  for (let seed = 0; seed < 20; seed++) {
    const bot = new BotController("Balanced", seed);
    const action = await bot.decide(view);
    expect(await new BotController("Balanced", seed).decide(view)).toEqual(
      action,
    );
    if (action.type === "LOCATION") destinations.add(action.location);
  }
  expect(destinations.size).toBeGreaterThan(1);
});
