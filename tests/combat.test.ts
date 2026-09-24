import { it, expect } from "vitest";
import { GameEngine } from "@grail/game-core";
import { servants } from "../data/servants/index.js";
import { balance } from "../data/balance/index.js";
import type { Intent } from "@grail/shared";
function create(count = 3) {
  const e = new GameEngine({
    seed: 9,
    locationCount: 4,
    players: Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      kind: "BOT",
    })),
  });
  for (const id of e.playerIds)
    e.submitIntent(id, {
      type: "SUMMON",
      decision: {
        desiredTrait: "ANY",
        grailWish: "NO_WISH",
        alignment: "TRUE_NEUTRAL",
        catalyst: "NONE",
        classFocus: "NONE",
        manaOffering: "LOW",
      },
    });
  e.resolvePhase();
  return e;
}
function submit(e: GameEngine, make: (id: string) => Intent) {
  for (const id of e.playerIds)
    if (e.playerView(id).canAct) e.submitIntent(id, make(id));
  e.resolvePhase();
}
it("applies all lethal attacks before elimination, allowing a draw", () => {
  const original = structuredClone(servants);
  try {
    for (const s of servants) {
      s.maxHp = 1;
      s.buster = 200;
    }
    const e = create(2);
    submit(e, () => ({ type: "LOCATION", location: "location-1" }));
    submit(e, () => ({ type: "DAY_ACTION", action: { type: "HIDE" } }));
    submit(e, (id) => ({
      type: "COMBAT",
      decision: {
        useNP: false,
        attacks: e
          .playerView(id)
          .combatTargets.map((target) => ({ target, type: "BUSTER" })),
      },
    }));
    expect(e.phase).toBe("FINISHED");
    expect(e.playerView("p0").winner).toBe(null);
    expect(e.playerView("p0").lastCombat).toMatchObject({
      finished: true,
      winner: null,
      eliminated: ["p0", "p1"],
      self: { hpAfter: 0 },
    });
    expect(
      e.auditEvents().filter((e) => e.type === "DAMAGE_RESOLVED"),
    ).toHaveLength(2);
    expect(
      e.auditEvents().filter((e) => e.type === "PLAYER_ELIMINATED"),
    ).toHaveLength(2);
  } finally {
    servants.splice(0, servants.length, ...original);
  }
});
it("uses NP against all targets, resets charge and separates local from remote exposure", () => {
  const e = create();
  for (let day = 0; day < 5; day++) {
    submit(e, (id) => ({
      type: "LOCATION",
      location: `location-${Number(id.slice(1)) + 1}`,
    }));
    submit(e, () => ({ type: "DAY_ACTION", action: { type: "USE_LEYLINE" } }));
  }
  expect(e.playerView("p0").self.np).toBe(5);
  submit(e, (id) => ({
    type: "LOCATION",
    location: id === "p2" ? "location-2" : "location-1",
  }));
  submit(e, () => ({ type: "DAY_ACTION", action: { type: "HIDE" } }));
  e.submitIntent("p0", {
    type: "COMBAT",
    decision: { useNP: true, attacks: [] },
  });
  e.submitIntent("p1", {
    type: "COMBAT",
    decision: { useNP: false, attacks: [{ target: "p0", type: "ARTS" }] },
  });
  e.resolvePhase();
  expect(e.playerView("p0").self.np).toBe(0);
  expect(e.playerView("p1").self.identity.p0).toBe(100);
  expect(e.playerView("p2").self.identity.p0).toBeGreaterThan(0);
  expect(e.playerView("p2").self.identity.p0).toBeCloseTo(
    Math.round(
      (40 / (1 + e.playerView("p0").self.servant!.mystery / 100)) * 100,
    ) / 100,
    2,
  );
  expect(
    e.playerView("p2").events.filter((e) => e.type === "DAMAGE_RESOLVED"),
  ).toHaveLength(0);
  expect(e.playerView("p2").enemies[0].trueName).toBeUndefined();
  expect(e.playerView("p2").lastCombat).toBeUndefined();
  expect(e.playerView("p0").lastCombat?.npUsers).toEqual(["p0"]);
  expect(e.playerView("p0").lastCombat?.hits[0].useNP).toBe(true);
  for (const opponent of e.playerView("p0").lastCombat!.opponents) {
    for (const key of ["hp", "mana", "np", "servant", "mystery"])
      expect(opponent).not.toHaveProperty(key);
  }
  expect(
    e.playerView("p2").events.find((e) => e.type === "NP_USED"),
  ).not.toHaveProperty("detail");
});
it("rejects duplicate combat targets and early NP, clamps healing and never regenerates mana", () => {
  const e = create();
  submit(e, () => ({ type: "LOCATION", location: "location-1" }));
  const mana = e.playerView("p0").self.mana;
  submit(e, () => ({
    type: "DAY_ACTION",
    action: { type: "TRANSFER_MANA", amount: 1 },
  }));
  expect(e.playerView("p0").self.mana).toBe(mana - 1);
  expect(e.playerView("p0").self.hp).toBe(
    e.playerView("p0").self.servant!.maxHp,
  );
  expect(() =>
    e.submitIntent("p0", {
      type: "COMBAT",
      decision: { useNP: true, attacks: [] },
    }),
  ).toThrow("INVALID_NP");
  expect(() =>
    e.submitIntent("p0", {
      type: "COMBAT",
      decision: {
        useNP: false,
        attacks: [
          { target: "p1", type: "ARTS" },
          { target: "p1", type: "QUICK" },
        ],
      },
    }),
  ).toThrow("INVALID_COMBAT_TARGETS");
});
it("uses configured BAQ multipliers with prepared terrain", () => {
  const e = create(2);
  submit(e, () => ({ type: "LOCATION", location: "location-1" }));
  submit(e, () => ({
    type: "DAY_ACTION",
    action: { type: "PREPARE_TERRAIN" },
  }));
  const stat = e.playerView("p0").self.servant!.buster;
  e.submitIntent("p0", {
    type: "COMBAT",
    decision: { useNP: false, attacks: [{ target: "p1", type: "BUSTER" }] },
  });
  e.submitIntent("p1", {
    type: "COMBAT",
    decision: { useNP: false, attacks: [{ target: "p0", type: "ARTS" }] },
  });
  e.resolvePhase();
  expect(
    e
      .playerView("p0")
      .events.find((e) => e.type === "DAMAGE_RESOLVED" && e.actor === "p0")!
      .value,
  ).toBe(Math.round(stat * balance.damage.win * balance.damage.terrain));
  const report = e.playerView("p0").lastCombat!;
  expect(report.hits[0]).toMatchObject({
    attackType: "BUSTER",
    opponentType: "ARTS",
    matchup: 1.25,
    terrainMultiplier: 1.25,
    identityMultiplier: 1,
    npMultiplier: 1,
  });
  expect(report.self.hpAfter).toBe(
    report.self.hpBefore - report.hits.find((h) => h.target === "p0")!.value,
  );
  expect(
    GameEngine.fromReplay(e.exportReplay()).playerView("p0").lastCombat,
  ).toEqual(report);
});
