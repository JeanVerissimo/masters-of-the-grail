import { RandomService, summon } from "@grail/game-core";
import type { SummoningDecision } from "@grail/shared";
const runs = Number(process.argv[process.argv.indexOf("--runs") + 1]) || 10000;
const decision: SummoningDecision = {
  desiredTrait: "CUNNING",
  grailWish: "KNOWLEDGE",
  alignment: "TRUE_NEUTRAL",
  catalyst: "MYSTIC_ARTIFACT",
  classFocus: "CASTER",
  manaOffering: "MEDIUM",
};
const rng = new RandomService(42),
  rarities: Record<string, number> = {},
  classes: Record<string, number> = {},
  servants: Record<string, number> = {};
for (let i = 0; i < runs; i++) {
  const { servant: s } = summon(decision, rng);
  rarities[s.rarity] = (rarities[s.rarity] ?? 0) + 1;
  classes[s.class] = (classes[s.class] ?? 0) + 1;
  servants[s.trueName] = (servants[s.trueName] ?? 0) + 1;
}
console.log(
  JSON.stringify(
    { runs, decision, rarities, classes, servants, averageManaCost: 25 },
    null,
    2,
  ),
);
