import type { ServantDefinition, SummoningDecision } from "./index.js";
export interface SummoningChance {
  servantId: string;
  probability: number;
}
export interface SummoningRecipe {
  decision: SummoningDecision;
  probability: number;
}
export interface CatalogEntry {
  servant: ServantDefinition;
  description: string;
  descriptionEn?: string;
}
export const themes = ["dark", "light", "parchment", "crimson"] as const;
export type Theme = (typeof themes)[number];
