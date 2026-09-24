import { it, expect } from "vitest";
import { TutorialSession } from "../apps/server/src/tutorial.js";
import {
  GameEngine,
  RandomService,
  summon,
  candidateWeights,
} from "@grail/game-core";
import { classes, type Intent, type SummoningDecision } from "@grail/shared";
import { servants, legacyServants } from "../data/servants/index.js";
import { additions } from "../data/servants/additions.js";
import { balance } from "../data/balance/index.js";
import { tutorialPt } from "../packages/localization/src/tutorial.js";
import { createApp } from "../apps/server/src/app.js";
import { MatchManager } from "../apps/server/src/manager.js";
import { LocalStorage } from "../apps/server/src/storage.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ritual: SummoningDecision = {
  desiredTrait: "LOYALTY",
  grailWish: "PROTECTION",
  alignment: "LAWFUL_GOOD",
  catalyst: "ROYAL_RELIC",
  classFocus: "SABER",
  manaOffering: "EXTREME",
};

it("adds exactly two servants per class and rarity, keeps Castoria and all original profiles", () => {
  expect(additions).toHaveLength(28);
  expect(servants.slice(0, 35)).toEqual(legacyServants);
  expect(servants.filter((s) => s.id === "castoria")).toHaveLength(1);
  expect(additions.find((s) => s.id === "francois-prelati")).toMatchObject({
    class: "CASTER",
    rarity: 5,
  });
  for (const servantClass of classes)
    for (const rarity of [4, 5]) {
      const pool = additions.filter(
        (s) => s.class === servantClass && s.rarity === rarity,
      );
      expect(pool).toHaveLength(2);
      expect(candidateWeights(ritual, pool).every((w) => w.weight > 0)).toBe(
        true,
      );
    }
  for (const s of additions) {
    const range = balance.rarityRanges[s.rarity - 1];
    expect(s.maxHp).toBeGreaterThanOrEqual(range.hp[0]);
    expect(s.maxHp).toBeLessThanOrEqual(range.hp[1]);
    expect(s.buster + s.arts + s.quick).toBeGreaterThanOrEqual(range.baq[0]);
    expect(s.buster + s.arts + s.quick).toBeLessThanOrEqual(range.baq[1]);
  }
  const rng = new RandomService(2026);
  const sampled = new Set(
    Array.from(
      { length: 10000 },
      () => summon(ritual, rng, servants, 1).servant.id,
    ),
  );
  expect(additions.every((s) => sampled.has(s.id))).toBe(true);
});

it("restores unversioned saves with the original roster and pins new replays to the expanded roster", () => {
  const config = {
    seed: 0,
    locationCount: 3,
    players: [
      { id: "student", name: "A", kind: "HUMAN" },
      { id: "mentor", name: "B", kind: "BOT" },
    ],
  };
  const original = new GameEngine({
    ...config,
    rosterVersion: 1,
    summoningVersion: 1,
  });
  for (const id of original.playerIds)
    original.submitIntent(id, { type: "SUMMON", decision: ritual });
  original.resolvePhase();
  expect(original.playerView("student").self.servant?.trueName).toBe(
    "Barghest",
  );
  const oldFile = JSON.parse(JSON.stringify(original.exportReplay()));
  delete oldFile.config.rosterVersion;
  delete oldFile.config.summoningVersion;
  expect(GameEngine.fromReplay(oldFile).playerView("student")).toEqual(
    original.playerView("student"),
  );
  expect(
    GameEngine.fromReplay(oldFile).exportReplay().config.rosterVersion,
  ).toBe(1);
  const modern = new GameEngine(config);
  expect(modern.exportReplay().config.rosterVersion).toBe(2);
  for (const id of modern.playerIds)
    modern.submitIntent(id, { type: "SUMMON", decision: ritual });
  modern.resolvePhase();
  expect(
    GameEngine.fromReplay(modern.exportReplay()).playerView("student"),
  ).toEqual(modern.playerView("student"));
  const outcomes = new Set<string>();
  for (let seed = 0; seed < 50; seed++) {
    const expanded = new GameEngine({ ...config, seed });
    for (const id of expanded.playerIds)
      expanded.submitIntent(id, { type: "SUMMON", decision: ritual });
    expanded.resolvePhase();
    outcomes.add(expanded.playerView("student").self.servant!.id);
  }
  expect(additions.some((s) => outcomes.has(s.id))).toBe(true);
});

it("teaches every day action with Artoria Saber, healing, clues, Excalibur and deterministic victory", () => {
  const session = new TutorialSession(),
    duplicate = new TutorialSession();
  let frame = session.snapshot();
  const actions = new Set<string>();
  for (let step = 0; step < 100 && !frame.complete; step++) {
    expect(
      tutorialPt[
        `tutorial.${frame.lesson}.${frame.review ? "result" : "body"}`
      ],
    ).toBeTruthy();
    expect(tutorialPt[`tutorial.${frame.lesson}.title`]).toBeTruthy();
    for (const enemy of frame.view.enemies)
      for (const field of ["hp", "mana", "np", "servant", "prepared"])
        expect(enemy).not.toHaveProperty(field);
    if (frame.view.phase !== "COMBAT" && frame.view.phase !== "FINISHED")
      expect(frame.view.enemies[0]).not.toHaveProperty("location");
    const intent = frame.expectedIntent;
    if (frame.view.self.servant)
      expect(frame.view.self.servant).toMatchObject({
        id: "artoria",
        class: "SABER",
        rarity: 5,
        noblePhantasm: { name: "Excalibur", type: "BUSTER", power: 1.9 },
      });
    if (frame.lesson === "TRANSFER_MANA" && frame.review)
      expect(frame.view.self.hp).toBe(frame.view.self.servant!.maxHp);
    if (intent?.type === "DAY_ACTION") actions.add(intent.action.type);
    const request = { revision: frame.revision, ...(intent ? { intent } : {}) };
    frame = session.advance(request);
    expect(duplicate.advance(request)).toEqual(frame);
  }
  expect(frame.complete).toBe(true);
  expect(frame.revision).toBe(57);
  expect(actions.size).toBe(6);
  expect(frame.view.winner).toBe("student");
  expect(frame.view.day).toBe(11);
  expect(frame.view.self).toMatchObject({ mana: 25, np: 1, hp: 807 });
  expect(frame.view.enemies[0]).toMatchObject({
    trueName: "Diomedes",
    alive: false,
  });
  expect(frame.view.enemies[0].identity).toBe(100);
  expect(frame.view.events.find((e) => e.type === "HEALED")).toMatchObject({
    value: 96,
  });
  expect(
    frame.view.events
      .find((e) => e.type === "LOCATION_CLUE")
      ?.detail?.split("|"),
  ).toContain("location-2");
  expect(frame.view.events.filter((e) => e.type === "NP_USED")).toHaveLength(2);
  expect(() => session.advance({ revision: frame.revision })).toThrow(
    "TUTORIAL_COMPLETE",
  );
});

it("rejects out-of-step actions and repeated requests without changing the tutorial", () => {
  const session = new TutorialSession();
  expect(() =>
    session.advance({
      revision: 0,
      intent: { type: "LOCATION", location: "location-1" },
    }),
  ).toThrow("TUTORIAL_FOLLOW_GUIDE");
  expect(session.snapshot().revision).toBe(0);
  session.advance({ revision: 0 });
  expect(() => session.advance({ revision: 0 })).toThrow("TUTORIAL_STALE_STEP");
  let frame = session.snapshot();
  while (!frame.expectedIntent)
    frame = session.advance({ revision: frame.revision });
  const before = structuredClone(frame);
  const wrong: Intent = {
    type: "SUMMON",
    decision: { ...ritual, manaOffering: "LOW" },
  };
  expect(() =>
    session.advance({ revision: frame.revision, intent: wrong }),
  ).toThrow("TUTORIAL_FOLLOW_GUIDE");
  expect(session.snapshot()).toEqual(before);
});

it("serves an authenticated resumable tutorial without creating saves or disturbing ordinary matches", async () => {
  const dir = await mkdtemp(join(tmpdir(), "grail-tutorial-"));
  const app = await createApp(new MatchManager(new LocalStorage(dir)));
  try {
    expect(
      (await app.inject({ method: "POST", url: "/api/tutorial" })).statusCode,
    ).toBe(401);
    const session = await app.inject({ method: "GET", url: "/api/session" });
    const headers = {
      cookie: String(session.headers["set-cookie"]).split(";")[0],
      "x-grail-request": "1",
    };
    expect(
      (await app.inject({ method: "GET", url: "/api/catalog", headers })).json()
        .count,
    ).toBe(63);
    const normal = (
      await app.inject({
        method: "POST",
        url: "/api/matches",
        headers,
        payload: {
          seed: 8,
          players: [
            { id: "a", name: "A", kind: "HUMAN" },
            { id: "b", name: "B", kind: "BOT" },
          ],
        },
      })
    ).json();
    const savesBefore = (
      await app.inject({ method: "GET", url: "/api/saves", headers })
    ).json();
    expect(
      (
        await app.inject({ method: "POST", url: "/api/tutorial", headers })
      ).json().revision,
    ).toBe(0);
    let frame = (
      await app.inject({ method: "GET", url: "/api/tutorial", headers })
    ).json();
    for (let step = 0; step < 100 && !frame.complete; step++) {
      const response = await app.inject({
        method: "POST",
        url: "/api/tutorial/advance",
        headers,
        payload: {
          revision: frame.revision,
          ...(frame.expectedIntent ? { intent: frame.expectedIntent } : {}),
        },
      });
      expect(response.statusCode).toBe(200);
      frame = response.json();
    }
    expect(frame.complete).toBe(true);
    expect(frame.view.self.servant.id).toBe("artoria");
    expect(frame.view.winner).toBe("student");
    expect(
      (
        await app.inject({ method: "GET", url: "/api/tutorial", headers })
      ).json(),
    ).toEqual(frame);
    expect(
      (await app.inject({ method: "GET", url: "/api/saves", headers })).json(),
    ).toEqual(savesBefore);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/matches/${normal.id}`,
          headers,
        })
      ).json(),
    ).toEqual(normal);
    expect(
      (
        await app.inject({ method: "POST", url: "/api/tutorial", headers })
      ).json().revision,
    ).toBe(0);
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
