import { z } from "zod";
import type { CombatReport } from "./combat-report.js";

export const classes = [
  "SABER",
  "ARCHER",
  "LANCER",
  "RIDER",
  "CASTER",
  "ASSASSIN",
  "BERSERKER",
] as const;
export const attackTypes = ["BUSTER", "ARTS", "QUICK"] as const;
export const traits = [
  "POWER",
  "LOYALTY",
  "CUNNING",
  "KNOWLEDGE",
  "CHAOS",
  "RESILIENCE",
  "ANY",
] as const;
export const wishes = [
  "POWER",
  "PROTECTION",
  "KNOWLEDGE",
  "REDEMPTION",
  "FREEDOM",
  "RECOGNITION",
  "CHANGE_THE_WORLD",
  "NO_WISH",
] as const;
export const alignments = [
  "LAWFUL_GOOD",
  "LAWFUL_NEUTRAL",
  "LAWFUL_EVIL",
  "NEUTRAL_GOOD",
  "TRUE_NEUTRAL",
  "NEUTRAL_EVIL",
  "CHAOTIC_GOOD",
  "CHAOTIC_NEUTRAL",
  "CHAOTIC_EVIL",
] as const;
export const catalysts = [
  "ROYAL_RELIC",
  "ANCIENT_WEAPON",
  "SACRED_RELIC",
  "MYSTIC_ARTIFACT",
  "WARRIOR_RELIC",
  "OLD_MANUSCRIPT",
  "CRIMINAL_RELIC",
  "NONE",
] as const;
export const offerings = ["LOW", "MEDIUM", "HIGH", "EXTREME"] as const;
export const profiles = [
  "Balanced",
  "Aggressive",
  "Cautious",
  "Investigator",
  "Survivalist",
] as const;
export const phases = [
  "SUMMONING",
  "LOCATION",
  "DAY_ACTION",
  "COMBAT",
  "FINISHED",
] as const;
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
export const summoningSchema = z.strictObject({
  desiredTrait: z.enum(traits),
  grailWish: z.enum(wishes),
  alignment: z.enum(alignments),
  catalyst: z.enum(catalysts),
  classFocus: z.enum(["NONE", ...classes]),
  manaOffering: z.enum(offerings),
});
export const dayActionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("INVESTIGATE_SERVANT"), target: idSchema }),
  z.strictObject({ type: z.literal("INVESTIGATE_MASTER"), target: idSchema }),
  z.strictObject({
    type: z.literal("TRANSFER_MANA"),
    amount: z.number().int().positive().max(10000),
  }),
  z.strictObject({ type: z.literal("PREPARE_TERRAIN") }),
  z.strictObject({ type: z.literal("HIDE") }),
  z.strictObject({ type: z.literal("USE_LEYLINE") }),
]);
export const combatSchema = z.strictObject({
  useNP: z.boolean(),
  attacks: z
    .array(z.strictObject({ target: idSchema, type: z.enum(attackTypes) }))
    .max(15),
});
export const intentSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("SUMMON"), decision: summoningSchema }),
  z.strictObject({ type: z.literal("LOCATION"), location: idSchema }),
  z.strictObject({ type: z.literal("DAY_ACTION"), action: dayActionSchema }),
  z.strictObject({ type: z.literal("COMBAT"), decision: combatSchema }),
]);
export const playerConfigSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(40),
  kind: z.enum(["HUMAN", "BOT", "AGENT"]),
  profile: z.enum(profiles).default("Balanced"),
  providerId: idSchema.optional(),
});
export const matchConfigSchema = z
  .strictObject({
    seed: z.number().int().min(0).max(4294967295),
    rosterVersion: z.union([z.literal(1), z.literal(2)]).optional(),
    summoningVersion: z.union([z.literal(1), z.literal(2)]).optional(),
    discoveryVersion: z.union([z.literal(1), z.literal(2)]).optional(),
    players: z.array(playerConfigSchema).min(2).max(8),
    locationCount: z.number().int().min(2).max(8).default(4),
  })
  .superRefine((v, c) => {
    if (new Set(v.players.map((p) => p.id)).size !== v.players.length)
      c.addIssue({ code: "custom", message: "Duplicate players" });
    if (v.players.filter((p) => p.kind === "HUMAN").length > 1)
      c.addIssue({ code: "custom", message: "One local human maximum" });
  });
export type PlayerId = string;
export type LocationId = string;
export type ServantClass = (typeof classes)[number];
export type AttackType = (typeof attackTypes)[number];
export type Phase = (typeof phases)[number];
export type BotProfile = (typeof profiles)[number];
export type SummoningDecision = z.infer<typeof summoningSchema>;
export type SummoningVersion = 1 | 2;
export type DayAction = z.infer<typeof dayActionSchema>;
export type CombatDecision = z.infer<typeof combatSchema>;
export type Intent = z.infer<typeof intentSchema>;
export type MatchConfig = z.infer<typeof matchConfigSchema>;
export interface ServantDefinition {
  id: string;
  trueName: string;
  class: ServantClass;
  rarity: number;
  maxHp: number;
  buster: number;
  arts: number;
  quick: number;
  manaEfficiency: number;
  mystery: number;
  noblePhantasm: { name: string; type: AttackType; power: number };
  summoning: {
    tags: string[];
    desiredTraits: string[];
    wishAffinities: string[];
    alignment: (typeof alignments)[number];
  };
}
export interface GameEvent {
  sequence: number;
  day: number;
  type: string;
  actor?: string;
  target?: string;
  value?: number;
  detail?: string;
  audience: "PUBLIC" | string[];
}
export interface OwnPlayer {
  id: string;
  name: string;
  alive: boolean;
  servant: ServantDefinition | null;
  hp: number;
  mana: number;
  np: number;
  location: string | null;
  prepared: boolean;
  identity: Record<string, number>;
}
export interface EnemyView {
  id: string;
  name: string;
  alive: boolean;
  condition: "UNKNOWN" | "HEALTHY" | "WOUNDED" | "CRITICAL" | "DEFEATED";
  identity: number;
  trueName?: string;
  class?: ServantClass;
  rarity?: number;
  location?: string;
}
export interface PlayerView {
  lastCombat?: CombatReport;
  day: number;
  phase: Phase;
  self: OwnPlayer;
  enemies: EnemyView[];
  locations: string[];
  events: GameEvent[];
  ready: boolean;
  canAct: boolean;
  combatTargets: string[];
  winner: string | null;
  legalIntents: Intent[];
  summoningOptions: {
    traits: typeof traits;
    wishes: typeof wishes;
    alignments: typeof alignments;
    catalysts: typeof catalysts;
    classes: readonly string[];
    offerings: typeof offerings;
  };
}
export type CombatView = PlayerView;
export type SummoningView = PlayerView;
export interface PlayerController {
  decide(view: PlayerView): Promise<Intent>;
}
export interface DecisionRecord {
  playerId: string;
  intent: Intent;
}
export const agentMetricSchema = z.strictObject({
  provider: z.string().max(120),
  model: z.string().max(120),
  latencyMs: z.number().nonnegative(),
  inputTokens: z.number().nonnegative(),
  outputTokens: z.number().nonnegative(),
  toolCalls: z.number().int().nonnegative(),
  invalidAttempts: z.number().int().nonnegative(),
  fallback: z.boolean(),
  phase: z.string().max(30),
  failureReasons: z.array(z.string().max(60)).max(20),
  estimatedCost: z.number().nonnegative().nullable(),
});
export type AgentMetric = z.infer<typeof agentMetricSchema>;
export const controllerStateSchema = z.strictObject({
  requests: z.number().int().nonnegative(),
  tokens: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  agentNotes: z.array(z.string().max(200)).max(8),
  metrics: z.array(agentMetricSchema).max(10000).default([]),
});
export const replaySchema = z.strictObject({
  saveVersion: z.literal(1),
  config: matchConfigSchema.transform((config) => ({
    ...config,
    rosterVersion: config.rosterVersion ?? 1,
    summoningVersion: config.summoningVersion ?? 1,
    discoveryVersion: config.discoveryVersion ?? 1,
  })),
  decisions: z
    .array(z.strictObject({ playerId: idSchema, intent: intentSchema }))
    .max(100000),
  controllerStates: z.record(idSchema, controllerStateSchema).optional(),
  presentation: z
    .strictObject({ acknowledgedCombatDay: z.number().int().nonnegative() })
    .optional(),
});
export type Replay = z.infer<typeof replaySchema>;
