import type { AttackType, EnemyView } from "./index.js";
export interface CombatHit {
  actor: string;
  target: string;
  value: number;
  attackType: AttackType;
  opponentType: AttackType;
  matchup: number;
  terrainMultiplier: number;
  identityMultiplier: number;
  npMultiplier: number;
  useNP: boolean;
}
export interface CombatReport {
  day: number;
  location: string;
  hits: CombatHit[];
  self: {
    hpBefore: number;
    hpAfter: number;
    maxHp: number;
    npBefore: number;
    npAfter: number;
  };
  opponents: Pick<
    EnemyView,
    "id" | "name" | "alive" | "condition" | "trueName"
  >[];
  npUsers: string[];
  eliminated: string[];
  finished: boolean;
  winner: string | null;
}
