import {
  alignments,
  type SummoningDecision,
  type ServantDefinition,
  type SummoningVersion,
} from "@grail/shared";
import {
  balance,
  catalystTags,
  wishAffinities,
} from "../../../data/balance/index.js";
import { servants } from "../../../data/servants/index.js";
import { RandomService } from "./random.js";

function alignmentDistance(a: string, b: string): number {
  const x = alignments.indexOf(a as (typeof alignments)[number]),
    y = alignments.indexOf(b as (typeof alignments)[number]);
  return (
    Math.abs(Math.floor(x / 3) - Math.floor(y / 3)) +
    Math.abs((x % 3) - (y % 3))
  );
}
export function candidateWeights(
  decision: SummoningDecision,
  pool: ServantDefinition[],
  version: SummoningVersion = 2,
) {
  return pool.map((servant) => {
    const profile = servant.summoning;
    const classModifier =
      servant.class === decision.classFocus ? balance.summoning.classFocus : 1;
    const catalystModifier = Math.max(
      1,
      ...profile.tags.map((tag) => catalystTags[decision.catalyst][tag] ?? 1),
    );
    const exponent =
      decision.catalyst === "NONE" ? balance.summoning.noCatalystExponent : 1;
    const desiredTraitModifier = Math.pow(
      profile.desiredTraits.includes(decision.desiredTrait)
        ? balance.summoning.trait
        : 1,
      exponent,
    );
    const wishModifier = Math.pow(
      wishAffinities[decision.grailWish].some((a) =>
        profile.wishAffinities.includes(a),
      )
        ? balance.summoning.wish
        : 1,
      exponent,
    );
    const alignmentModifier = Math.pow(
      balance.summoning.alignment[
        alignmentDistance(decision.alignment, profile.alignment)
      ],
      exponent,
    );
    return {
      id: servant.id,
      classModifier,
      catalystModifier,
      desiredTraitModifier,
      wishModifier,
      alignmentModifier,
      weight: Math.pow(
        classModifier *
          catalystModifier *
          desiredTraitModifier *
          wishModifier *
          alignmentModifier,
        version === 1 ? 1 : balance.focusedSummoning.affinityExponent,
      ),
    };
  });
}

// Distribui a massa da raridade sem ultrapassar o limite absoluto por Servo.
// O excedente é redistribuído proporcionalmente entre os candidatos não limitados.
export function conditionalProbabilities(
  weights: number[],
  rarityChance: number,
  version: SummoningVersion = 2,
): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!weights.length || weights.some((w) => !Number.isFinite(w) || w <= 0))
    throw new Error("INVALID_SUMMONING_POOL");
  const cap =
    version === 1 || rarityChance === 0
      ? 1
      : Math.min(1, balance.focusedSummoning.maxProbability / rarityChance);
  if (weights.length * cap < 1) throw new Error("SUMMONING_CAP_INFEASIBLE");
  const probabilities = weights.map(() => 0);
  let remaining = weights.map((_, index) => index);
  let mass = 1,
    remainingWeight = total;
  while (remaining.length) {
    const capped = remaining.filter(
      (i) => (mass * weights[i]) / remainingWeight > cap,
    );
    if (!capped.length) {
      for (const i of remaining)
        probabilities[i] = (mass * weights[i]) / remainingWeight;
      break;
    }
    for (const i of capped) probabilities[i] = cap;
    remaining = remaining.filter((i) => !capped.includes(i));
    mass = 1 - probabilities.reduce((sum, probability) => sum + probability, 0);
    remainingWeight = remaining.reduce((sum, i) => sum + weights[i], 0);
  }
  return probabilities;
}
export function summon(
  decision: SummoningDecision,
  random: RandomService,
  roster: ServantDefinition[] = servants,
  version: SummoningVersion = 2,
) {
  const rarity = random.weighted(
    [1, 2, 3, 4, 5],
    balance.rarityWeights[decision.manaOffering],
  );
  const pool = roster.filter((s) => s.rarity === rarity),
    weights = candidateWeights(decision, pool, version);
  const rawWeights = weights.map((w) => w.weight);
  const rarityWeights = balance.rarityWeights[decision.manaOffering];
  const servant = random.weighted(
    pool,
    version === 1
      ? rawWeights
      : conditionalProbabilities(
          rawWeights,
          rarityWeights[rarity - 1] / rarityWeights.reduce((a, b) => a + b, 0),
          version,
        ),
  );
  return {
    servant: structuredClone(servant),
    rarity,
    weights,
    manaCost: balance.offeringCost[decision.manaOffering],
  };
}
