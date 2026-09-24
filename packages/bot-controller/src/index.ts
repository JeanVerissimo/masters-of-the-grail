import {
  type PlayerController,
  type PlayerView,
  type Intent,
  type BotProfile,
  type SummoningDecision,
} from "@grail/shared";
import { RandomService } from "@grail/game-core";
import { balance } from "../../../data/balance/index.js";

const weights: Record<
  BotProfile,
  { attack: number; heal: number; investigate: number; hide: number }
> = {
  Balanced: { attack: 1, heal: 1, investigate: 1, hide: 1 },
  Aggressive: { attack: 1.5, heal: 0.65, investigate: 0.75, hide: 0.5 },
  Cautious: { attack: 0.8, heal: 1.4, investigate: 1.1, hide: 1.5 },
  Investigator: { attack: 0.9, heal: 1, investigate: 1.8, hide: 0.8 },
  Survivalist: { attack: 0.8, heal: 1.8, investigate: 0.8, hide: 1.7 },
};
const rituals: Record<BotProfile, Partial<SummoningDecision>> = {
  Balanced: { desiredTrait: "LOYALTY", grailWish: "PROTECTION" },
  Aggressive: {
    desiredTrait: "POWER",
    grailWish: "RECOGNITION",
    alignment: "CHAOTIC_NEUTRAL",
    catalyst: "WARRIOR_RELIC",
    classFocus: "BERSERKER",
    manaOffering: "HIGH",
  },
  Cautious: {
    desiredTrait: "RESILIENCE",
    grailWish: "PROTECTION",
    alignment: "LAWFUL_NEUTRAL",
    catalyst: "SACRED_RELIC",
    classFocus: "SABER",
  },
  Investigator: {
    desiredTrait: "KNOWLEDGE",
    grailWish: "KNOWLEDGE",
    catalyst: "OLD_MANUSCRIPT",
    classFocus: "CASTER",
  },
  Survivalist: {
    desiredTrait: "RESILIENCE",
    grailWish: "FREEDOM",
    manaOffering: "LOW",
  },
};
export class BotController implements PlayerController {
  constructor(
    readonly profile: BotProfile = "Balanced",
    readonly strategySeed = 0,
  ) {}
  scores(view: PlayerView) {
    const w = weights[this.profile],
      b = balance.bot,
      p = view.self;
    const hash = Array.from(`${p.id}:${view.day}:${view.phase}`).reduce(
      (n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0,
      (17 ^ this.strategySeed) >>> 0,
    );
    const random = new RandomService(hash);
    return view.legalIntents
      .map((intent) => {
        let utility = random.next() * b.jitter;
        if (intent.type === "LOCATION") utility += random.next();
        if (intent.type === "DAY_ACTION") {
          const a = intent.action;
          if (a.type === "TRANSFER_MANA")
            utility += (1 - p.hp / p.servant!.maxHp) * b.healingWeight * w.heal;
          if (a.type === "PREPARE_TERRAIN") utility += b.terrain * w.attack;
          if (a.type === "USE_LEYLINE")
            utility +=
              p.np < balance.np.max ? b.leyline * w.attack + p.np / 10 : 0;
          if (a.type === "HIDE") utility += b.hide * w.hide;
          if (a.type === "INVESTIGATE_SERVANT")
            utility +=
              (p.identity[a.target] ?? 0) < 100
                ? b.investigation * w.investigate
                : 0;
          if (a.type === "INVESTIGATE_MASTER")
            utility += b.masterInvestigation * w.investigate;
        }
        if (intent.type === "COMBAT") {
          if (intent.decision.useNP) utility += 2;
          else {
            const type = intent.decision.attacks[0]?.type;
            utility +=
              (type === "BUSTER"
                ? p.servant!.buster
                : type === "ARTS"
                  ? p.servant!.arts
                  : p.servant!.quick) / 300;
          }
        }
        return { intent, utility };
      })
      .sort((a, b) => b.utility - a.utility);
  }
  async decide(view: PlayerView): Promise<Intent> {
    if (!view.canAct) throw new Error("NO_LEGAL_ACTION");
    if (view.phase === "SUMMONING")
      return {
        type: "SUMMON",
        decision: {
          desiredTrait: "ANY",
          grailWish: "NO_WISH",
          alignment: "TRUE_NEUTRAL",
          catalyst: "NONE",
          classFocus: "NONE",
          manaOffering: "MEDIUM",
          ...rituals[this.profile],
        },
      };
    const selected = this.scores(view)[0];
    if (!selected) throw new Error("NO_LEGAL_ACTION");
    return selected.intent;
  }
}
