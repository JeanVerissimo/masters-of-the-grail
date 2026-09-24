import { GameEngine } from "@grail/game-core";
import {
  intentSchema,
  type Intent,
  type PlayerView,
  type SummoningDecision,
} from "@grail/shared";
import type { TutorialSnapshot } from "../../shared/src/tutorial.js";
import { PlayerViewService } from "@grail/player-core";
import { z } from "zod";

const ritual: SummoningDecision = {
  desiredTrait: "LOYALTY",
  grailWish: "PROTECTION",
  alignment: "LAWFUL_GOOD",
  catalyst: "ROYAL_RELIC",
  classFocus: "SABER",
  manaOffering: "EXTREME",
};
const introductions = [
  "welcome",
  "trait",
  "wish",
  "alignment",
  "catalyst",
  "class",
  "offering",
];
const dayActions = [
  "PREPARE_TERRAIN",
  "TRANSFER_MANA",
  "INVESTIGATE_SERVANT",
  "INVESTIGATE_MASTER",
  "HIDE",
  "USE_LEYLINE",
  "USE_LEYLINE",
  "USE_LEYLINE",
  "USE_LEYLINE",
  "USE_LEYLINE",
  "PREPARE_TERRAIN",
] as const;

/** Igualdade estrutural de valores JSON, sem depender de node:util. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null ||
    Array.isArray(a) !== Array.isArray(b)
  )
    return false;
  const keysA = Object.keys(a),
    keysB = Object.keys(b);
  return (
    keysA.length === keysB.length &&
    keysA.every(
      (key) =>
        Object.hasOwn(b, key) &&
        deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
    )
  );
}

// O roteiro recebe somente PlayerView. Nenhum estado privado é alterado para ensinar regras.
function opponentDecision(view: PlayerView): Intent {
  if (view.phase === "SUMMONING")
    return {
      type: "SUMMON",
      decision: {
        ...ritual,
        manaOffering: "LOW",
        classFocus: "NONE",
        catalyst: "NONE",
      },
    };
  if (view.phase === "LOCATION")
    return {
      type: "LOCATION",
      location: view.day === 1 || view.day >= 11 ? "location-1" : "location-2",
    };
  if (view.phase === "DAY_ACTION")
    return {
      type: "DAY_ACTION",
      action:
        view.day === 5
          ? { type: "INVESTIGATE_SERVANT", target: "student" }
          : { type: "USE_LEYLINE" },
    };
  return {
    type: "COMBAT",
    decision: {
      useNP: view.self.np >= 5,
      attacks:
        view.self.np >= 5
          ? []
          : view.combatTargets.map((target) => ({ target, type: "ARTS" })),
    },
  };
}

export class TutorialSession {
  #engine: GameEngine;
  #views: PlayerViewService;
  #intro = 0;
  #revision = 0;
  #review = false;
  #lastLesson = "welcome";
  #lastChapter = 1;
  // Seed e catálogo fixos preservam Artoria e o roteiro sem forçar o sorteio.
  constructor(seed = 2) {
    this.#engine = new GameEngine({
      seed,
      rosterVersion: 1,
      summoningVersion: 1,
      discoveryVersion: 2,
      locationCount: 3,
      players: [
        { id: "student", name: "Aprendiz", kind: "HUMAN" },
        { id: "mentor", name: "Mentor", kind: "BOT" },
      ],
    });
    this.#views = new PlayerViewService(this.#engine);
  }
  snapshot(): TutorialSnapshot {
    const view = this.#views.forPlayer("student");
    let lesson: string;
    let expectedIntent: Intent | null = null;
    if (this.#intro < introductions.length) lesson = introductions[this.#intro];
    else if (view.phase === "SUMMONING") {
      lesson = "summon";
      expectedIntent = { type: "SUMMON", decision: ritual };
    } else if (view.phase === "LOCATION") {
      lesson =
        view.day === 1 ? "destination" : view.day === 11 ? "return" : "travel";
      expectedIntent = { type: "LOCATION", location: "location-1" };
    } else if (view.phase === "DAY_ACTION") {
      const action = dayActions[view.day - 1] ?? "PREPARE_TERRAIN";
      lesson = action;
      expectedIntent = {
        type: "DAY_ACTION",
        action:
          action === "TRANSFER_MANA"
            ? { type: action, amount: 10 }
            : action === "INVESTIGATE_MASTER" ||
                action === "INVESTIGATE_SERVANT"
              ? { type: action, target: "mentor" }
              : { type: action },
      };
    } else if (view.phase === "COMBAT") {
      const useNP = view.self.np >= 5;
      lesson = useNP ? "np" : view.day === 1 ? "combat" : "finish";
      expectedIntent = {
        type: "COMBAT",
        decision: {
          useNP,
          attacks: useNP
            ? []
            : view.combatTargets.map((target) => ({ target, type: "BUSTER" })),
        },
      };
    } else lesson = "complete";
    if (this.#review) {
      lesson = this.#lastLesson;
      expectedIntent = null;
    }
    const chapter =
      this.#intro < introductions.length
        ? 1
        : view.phase === "SUMMONING"
          ? 2
          : view.phase === "FINISHED"
            ? 6
            : view.day === 1
              ? 3
              : view.day <= 5
                ? 4
                : view.day <= 10
                  ? 5
                  : 6;
    return {
      revision: this.#revision,
      lesson,
      chapter: this.#review ? this.#lastChapter : chapter,
      chapters: 6,
      review: this.#review,
      complete: view.phase === "FINISHED" && !this.#review,
      expectedIntent: structuredClone(expectedIntent),
      view,
    };
  }
  advance(input: unknown): TutorialSnapshot {
    const request = z
      .strictObject({
        revision: z.number().int().nonnegative(),
        intent: intentSchema.optional(),
      })
      .parse(input);
    if (request.revision !== this.#revision)
      throw new Error("TUTORIAL_STALE_STEP");
    const current = this.snapshot();
    if (current.complete) throw new Error("TUTORIAL_COMPLETE");
    if (current.expectedIntent) {
      if (!deepEqual(request.intent, current.expectedIntent))
        throw new Error("TUTORIAL_FOLLOW_GUIDE");
      // Validação antes de gravar qualquer decisão, inclusive a do adversário.
      this.#engine.validateIntent("student", request.intent);
      const enemyView = this.#views.forPlayer("mentor");
      const enemyIntent = enemyView.canAct ? opponentDecision(enemyView) : null;
      if (enemyIntent) this.#engine.validateIntent("mentor", enemyIntent);
      this.#engine.submitIntent("student", request.intent);
      if (enemyIntent) this.#engine.submitIntent("mentor", enemyIntent);
      this.#engine.resolvePhase();
      this.#lastLesson = current.lesson;
      this.#lastChapter = current.chapter;
      this.#review = true;
    } else {
      if (request.intent) throw new Error("TUTORIAL_FOLLOW_GUIDE");
      if (this.#review) this.#review = false;
      else this.#intro++;
    }
    this.#revision++;
    return this.snapshot();
  }
}
