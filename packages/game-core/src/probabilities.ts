import {
  traits,
  wishes,
  alignments,
  catalysts,
  classes,
  offerings,
  type SummoningDecision,
  type ServantDefinition,
  type SummoningVersion,
} from "@grail/shared";
import type {
  SummoningChance,
  SummoningRecipe,
} from "../../shared/src/catalog.js";
import { servants } from "../../../data/servants/index.js";
import { balance } from "../../../data/balance/index.js";
import { candidateWeights, conditionalProbabilities } from "./summoning.js";

export function summoningProbabilities(
  decision: SummoningDecision,
  roster = servants,
  version: SummoningVersion = 2,
): SummoningChance[] {
  const rarityWeights = balance.rarityWeights[decision.manaOffering];
  const rarityTotal = rarityWeights.reduce((a, b) => a + b, 0);
  return [1, 2, 3, 4, 5]
    .flatMap((rarity) => {
      const pool = roster.filter((s) => s.rarity === rarity);
      const weights = candidateWeights(decision, pool, version);
      const rarityChance = rarityWeights[rarity - 1] / rarityTotal;
      const probabilities = conditionalProbabilities(
        weights.map((w) => w.weight),
        rarityChance,
        version,
      );
      return weights.map((w, i) => ({
        servantId: w.id,
        probability: rarityChance * probabilities[i],
      }));
    })
    .sort(
      (a, b) =>
        b.probability - a.probability || a.servantId.localeCompare(b.servantId),
    );
}

// Enumera as 129.024 combinações válidas. O yield permite ao servidor atender outras requisições.
export async function bestSummoningRituals(
  roster: ServantDefinition[] = servants,
  yieldWork: () => Promise<void> = async () => {},
  version: SummoningVersion = 2,
): Promise<Record<string, SummoningRecipe[]>> {
  const best: Record<string, SummoningRecipe[]> = Object.fromEntries(
    roster.map((s) => [s.id, []]),
  );
  const pools = [1, 2, 3, 4, 5].map((r) =>
    roster.filter((s) => s.rarity === r),
  );
  for (const desiredTrait of traits)
    for (const grailWish of wishes) {
      for (const alignment of alignments)
        for (const catalyst of catalysts)
          for (const classFocus of ["NONE", ...classes] as const) {
            const decision: SummoningDecision = {
              desiredTrait,
              grailWish,
              alignment,
              catalyst,
              classFocus,
              manaOffering: "LOW",
            };
            // A oferta altera somente a raridade; os pesos dentro do grupo são reutilizados.
            for (let r = 0; r < 5; r++) {
              const weights = candidateWeights(decision, pools[r], version);
              for (const manaOffering of offerings) {
                const rarityWeights = balance.rarityWeights[manaOffering];
                const rarityChance =
                  rarityWeights[r] / rarityWeights.reduce((a, b) => a + b, 0);
                const probabilities = conditionalProbabilities(
                  weights.map((w) => w.weight),
                  rarityChance,
                  version,
                );
                for (let i = 0; i < weights.length; i++) {
                  const w = weights[i];
                  const probability = rarityChance * probabilities[i];
                  const list = best[w.id];
                  if (list.length === 3 && probability <= list[2].probability)
                    continue;
                  list.push({
                    decision: { ...decision, manaOffering },
                    probability,
                  });
                  list.sort((a, b) => b.probability - a.probability);
                  if (list.length > 3) list.pop();
                }
              }
            }
          }
      await yieldWork();
    }
  return best;
}
