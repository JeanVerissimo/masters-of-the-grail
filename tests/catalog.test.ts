import { it, expect, beforeAll } from "vitest";
import {
  summoningProbabilities,
  bestSummoningRituals,
  summon,
  RandomService,
  GameEngine,
} from "@grail/game-core";
import { servants } from "../data/servants/index.js";
import { descriptions } from "../data/servants/descriptions.js";
import { balance } from "../data/balance/index.js";
import {
  offerings,
  summoningSchema,
  type SummoningDecision,
  type Intent,
  type ServantDefinition,
} from "@grail/shared";
import type { SummoningRecipe } from "../packages/shared/src/catalog.js";
import { MatchManager } from "../apps/server/src/manager.js";
import { LocalStorage, settingsSchema } from "../apps/server/src/storage.js";
import { createApp } from "../apps/server/src/app.js";
import { conditionalProbabilities } from "../packages/game-core/src/summoning.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const decision: SummoningDecision = {
  desiredTrait: "LOYALTY",
  grailWish: "PROTECTION",
  alignment: "LAWFUL_GOOD",
  catalyst: "ROYAL_RELIC",
  classFocus: "SABER",
  manaOffering: "MEDIUM",
};
let best: Record<string, SummoningRecipe[]>;
let previousBest: Record<string, SummoningRecipe[]>;
beforeAll(async () => {
  best = await bestSummoningRituals();
  previousBest = await bestSummoningRituals(servants, async () => {}, 1);
}, 30000);
it("improves the best ritual for all 63 servants while keeping every maximum below 40%", () => {
  for (const servant of servants) {
    expect(best[servant.id][0].probability).toBeGreaterThan(
      previousBest[servant.id][0].probability,
    );
    expect(best[servant.id][0].probability).toBeLessThan(0.4);
    expect(best[servant.id][0].probability).toBeLessThanOrEqual(
      balance.focusedSummoning.maxProbability,
    );
  }
  expect(best.artoria[0].probability).toBeCloseTo(0.3250474401609195, 12);
  expect(previousBest.artoria[0].probability).toBeCloseTo(
    0.1332522112961428,
    12,
  );
});
it("redistributes capped probability without losing mass or changing the rarity odds", () => {
  const chances = conditionalProbabilities([1000000, 1, 2, 3], 0.4);
  expect(chances[0] * 0.4).toBeCloseTo(0.399, 12);
  expect(chances.reduce((sum, p) => sum + p, 0)).toBeCloseTo(1, 12);
  expect(chances[2] / chances[1]).toBeCloseTo(2, 12);
  expect(chances[3] / chances[1]).toBeCloseTo(3, 12);
  const multiple = conditionalProbabilities([1000000, 100000, 1, 2], 1);
  expect(multiple.every((p) => p <= 0.399)).toBe(true);
  expect(multiple.reduce((sum, p) => sum + p, 0)).toBeCloseTo(1, 12);
  expect(() => conditionalProbabilities([1], 0.4)).toThrow(
    "SUMMONING_CAP_INFEASIBLE",
  );
});
it("samples the same capped distribution used by the simulator", () => {
  const roster: ServantDefinition[] = servants.map((s) => ({
    ...s,
    summoning: {
      ...s.summoning,
      tags: [],
      desiredTraits: [],
      wishAffinities: [],
      alignment: "CHAOTIC_EVIL" as const,
    },
  }));
  const target = roster.find((s) => s.id === "jason")!;
  target.summoning = {
    tags: ["ROYAL"],
    desiredTraits: ["LOYALTY"],
    wishAffinities: ["LOYALTY"],
    alignment: "LAWFUL_GOOD",
  };
  const ritual = { ...decision, manaOffering: "LOW" as const };
  const expected = summoningProbabilities(ritual, roster).find(
    (p) => p.servantId === target.id,
  )!.probability;
  expect(expected).toBeCloseTo(0.399, 12);
  const rng = new RandomService(4099);
  let count = 0;
  for (let i = 0; i < 30000; i++)
    if (summon(ritual, rng, roster).servant.id === target.id) count++;
  expect(Math.abs(count / 30000 - expected)).toBeLessThan(0.01);
});
it("preserves both old rosters' unversioned summoning saves and versions new games", () => {
  const config = {
    seed: 2026,
    players: [
      { id: "a", name: "A", kind: "HUMAN" },
      { id: "b", name: "B", kind: "BOT" },
    ],
  };
  for (const rosterVersion of [1, 2]) {
    const legacy = new GameEngine({
      ...config,
      rosterVersion,
      summoningVersion: 1,
    });
    for (const id of legacy.playerIds)
      legacy.submitIntent(id, { type: "SUMMON", decision });
    legacy.resolvePhase();
    const oldFile = JSON.parse(JSON.stringify(legacy.exportReplay()));
    delete oldFile.config.summoningVersion;
    const restored = GameEngine.fromReplay(oldFile);
    expect(restored.exportReplay().config.summoningVersion).toBe(1);
    for (const id of legacy.playerIds)
      expect(restored.playerView(id)).toEqual(legacy.playerView(id));
  }
  const modern = new GameEngine(config);
  expect(modern.exportReplay().config.summoningVersion).toBe(2);
  for (const id of modern.playerIds)
    modern.submitIntent(id, { type: "SUMMON", decision });
  modern.resolvePhase();
  expect(GameEngine.fromReplay(modern.exportReplay()).playerView("a")).toEqual(
    modern.playerView("a"),
  );
  expect(() => new GameEngine({ ...config, summoningVersion: 3 })).toThrow();
});
it("provides descriptions for every servant and absolute probabilities summing to one", () => {
  for (const servant of servants)
    expect(descriptions[servant.id]?.length).toBeGreaterThan(40);
  for (const manaOffering of offerings) {
    const chances = summoningProbabilities({ ...decision, manaOffering });
    expect(chances).toHaveLength(63);
    expect(chances.reduce((sum, c) => sum + c.probability, 0)).toBeCloseTo(
      1,
      12,
    );
    for (let rarity = 1; rarity <= 5; rarity++) {
      const ids = servants.filter((s) => s.rarity === rarity).map((s) => s.id);
      expect(
        chances
          .filter((c) => ids.includes(c.servantId))
          .reduce((sum, c) => sum + c.probability, 0),
      ).toBeCloseTo(balance.rarityWeights[manaOffering][rarity - 1] / 100, 12);
    }
  }
});
it("matches empirical summons and never renormalizes the top five to 100%", () => {
  const chances = summoningProbabilities(decision),
    rng = new RandomService(719),
    counts: Record<string, number> = {};
  for (let i = 0; i < 30000; i++) {
    const id = summon(decision, rng).servant.id;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  for (const chance of chances)
    expect(
      Math.abs((counts[chance.servantId] ?? 0) / 30000 - chance.probability),
    ).toBeLessThan(0.012);
  expect(
    chances.slice(0, 5).reduce((sum, c) => sum + c.probability, 0),
  ).toBeLessThan(1);
});
it("finds three distinct complete recipes per servant using the same exact probabilities", () => {
  for (const servant of servants) {
    const recipes = best[servant.id];
    expect(recipes).toHaveLength(3);
    expect(new Set(recipes.map((r) => JSON.stringify(r.decision))).size).toBe(
      3,
    );
    for (const recipe of recipes) {
      expect(() => summoningSchema.parse(recipe.decision)).not.toThrow();
      expect(recipe.probability).toBeCloseTo(
        summoningProbabilities(recipe.decision).find(
          (p) => p.servantId === servant.id,
        )!.probability,
        12,
      );
    }
    expect(recipes[0].probability).toBeGreaterThanOrEqual(
      recipes[1].probability,
    );
    expect(recipes[1].probability).toBeGreaterThanOrEqual(
      recipes[2].probability,
    );
    const maxRarity = Math.max(
      ...offerings.map((o) => balance.rarityWeights[o][servant.rarity - 1]),
    );
    expect(
      balance.rarityWeights[recipes[0].decision.manaOffering][
        servant.rarity - 1
      ],
    ).toBe(maxRarity);
  }
});
it("keeps combat review pending across save/load and requires an explicit acknowledgement", async () => {
  const dir = await mkdtemp(join(tmpdir(), "grail-report-"));
  try {
    const manager = new MatchManager(new LocalStorage(dir));
    const engine = new GameEngine({
      seed: 0,
      rosterVersion: 1,
      players: [
        { id: "a", name: "A", kind: "HUMAN" },
        { id: "b", name: "B", kind: "BOT" },
      ],
    });
    function submit(intent: Intent) {
      for (const id of engine.playerIds) engine.submitIntent(id, intent);
      engine.resolvePhase();
    }
    submit({ type: "SUMMON", decision });
    submit({ type: "LOCATION", location: "location-1" });
    submit({ type: "DAY_ACTION", action: { type: "PREPARE_TERRAIN" } });
    for (const id of engine.playerIds)
      engine.submitIntent(id, {
        type: "COMBAT",
        decision: {
          useNP: false,
          attacks: [{ target: id === "a" ? "b" : "a", type: "ARTS" }],
        },
      });
    engine.resolvePhase();
    const id = manager.importReplay(engine.exportReplay());
    expect(manager.view(id).combatResolution).toBe(true);
    await expect(manager.advance(id)).rejects.toThrow("COMBAT_REVIEW_REQUIRED");
    await manager.save(id);
    expect((await manager.load(id)).combatResolution).toBe(true);
    await expect(manager.acknowledgeCombat(id, 99)).rejects.toThrow(
      "INVALID_COMBAT_REPORT",
    );
    expect((await manager.acknowledgeCombat(id, 1)).combatResolution).toBe(
      false,
    );
    expect((await manager.load(id)).combatResolution).toBe(false);
    expect(manager.view(id).view.day).toBe(2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("validates simulator requests, returns public catalog data and persists all four themes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "grail-catalog-"));
  const storage = new LocalStorage(dir),
    app = await createApp(new MatchManager(storage));
  try {
    expect(settingsSchema.parse({}).theme).toBe("dark");
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/summoning/simulate",
          payload: decision,
        })
      ).statusCode,
    ).toBe(401);
    const session = await app.inject({ method: "GET", url: "/api/session" });
    const headers = {
      cookie: String(session.headers["set-cookie"]).split(";")[0],
      "x-grail-request": "1",
    };
    const catalog = await app.inject({
      method: "GET",
      url: "/api/servants",
      headers,
    });
    expect(catalog.json()).toHaveLength(63);
    const result = await app.inject({
      method: "POST",
      url: "/api/summoning/simulate",
      headers,
      payload: decision,
    });
    expect(result.statusCode).toBe(200);
    expect(result.json().top).toHaveLength(5);
    expect(
      result
        .json()
        .top.reduce(
          (sum: number, row: { probability: number }) => sum + row.probability,
          0,
        ) + result.json().remainingProbability,
    ).toBeCloseTo(1, 12);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/summoning/simulate",
          headers,
          payload: { ...decision, manaOffering: "IMPOSSIBLE" },
        })
      ).statusCode,
    ).toBe(400);
    for (const theme of ["dark", "light", "parchment", "crimson"]) {
      expect(
        (
          await app.inject({
            method: "PUT",
            url: "/api/settings",
            headers,
            payload: { theme, locale: "pt-BR", reducedMotion: true },
          })
        ).statusCode,
      ).toBe(200);
      expect((await new LocalStorage(dir).settings()).theme).toBe(theme);
    }
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/settings",
          headers,
          payload: { theme: "invalid" },
        })
      ).statusCode,
    ).toBe(400);
    const recipe = await app.inject({
      method: "GET",
      url: "/api/servants/artoria/rituals",
      headers,
    });
    expect(recipe.statusCode).toBe(200);
    expect(recipe.json()).toEqual(best.artoria);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/servants/unknown/rituals",
          headers,
        })
      ).statusCode,
    ).toBe(400);
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
}, 30000);
