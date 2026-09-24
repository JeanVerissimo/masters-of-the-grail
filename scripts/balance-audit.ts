import { writeFile } from "node:fs/promises";
import { GameEngine } from "@grail/game-core";
import { BotController } from "@grail/bot-controller";
import { profiles } from "@grail/shared";

const count =
  Number(process.argv[process.argv.indexOf("--matches") + 1]) || 1000;
type Tally = { games: number; wins: number };
async function audit(
  discoveryVersion: 1 | 2,
  seeded: boolean,
  identical = false,
) {
  const result = {
    matches: count,
    discoveryVersion,
    seeded,
    identical,
    completed: 0,
    draws: 0,
    incomplete: 0,
    averageDays: 0,
    seats: [0, 0, 0],
    profiles: {} as Record<string, Tally>,
    classes: {} as Record<string, Tally>,
    rarities: {} as Record<string, Tally>,
    investigations: 0,
    discoveriesBeforeNP: 0,
    npUses: 0,
  };
  for (let seed = 0; seed < count; seed++) {
    const selected = Array.from({ length: 3 }, (_, i) =>
      identical
        ? ("Balanced" as const)
        : profiles[(seed + i) % profiles.length],
    );
    const bots = selected.map((p) => new BotController(p, seeded ? seed : 0));
    const engine = new GameEngine({
      seed,
      discoveryVersion,
      locationCount: 4,
      players: selected.map((profile, i) => ({
        id: `p${i}`,
        name: `Master ${i}`,
        kind: "BOT",
        profile,
      })),
    });
    let steps = 0;
    while (engine.phase !== "FINISHED" && steps++ < 4000) {
      for (const [i, id] of engine.playerIds.entries()) {
        const view = engine.playerView(id);
        if (view.canAct) engine.submitIntent(id, await bots[i].decide(view));
      }
      engine.resolvePhase();
    }
    if (engine.phase !== "FINISHED") {
      result.incomplete++;
      continue;
    }
    result.completed++;
    result.averageDays += engine.day;
    const winner = engine.playerView("p0").winner;
    if (!winner) result.draws++;
    else result.seats[Number(winner.slice(1))]++;
    for (const [i, id] of engine.playerIds.entries()) {
      const servant = engine.playerView(id).self.servant!;
      for (const [table, key] of [
        [result.profiles, selected[i]],
        [result.classes, servant.class],
        [result.rarities, String(servant.rarity)],
      ] as const) {
        const tally = (table[key] ??= { games: 0, wins: 0 });
        tally.games++;
        if (winner === id) tally.wins++;
      }
    }
    const npUsers = new Set<string>();
    for (const event of engine.auditEvents()) {
      if (event.type === "NP_USED") {
        result.npUses++;
        npUsers.add(event.actor!);
      }
      if (event.type === "DAY_ACTION" && event.detail === "INVESTIGATE_SERVANT")
        result.investigations++;
      if (event.type === "IDENTITY_DISCOVERED" && !npUsers.has(event.target!))
        result.discoveriesBeforeNP++;
    }
  }
  result.averageDays /= Math.max(1, result.completed);
  return result;
}
const results = [];
for (const [version, seeded, identical] of [
  [1, false, false],
  [2, true, false],
  [2, true, true],
] as const) {
  results.push(await audit(version, seeded, identical));
  console.error(
    `Concluído: descoberta ${version}, movimento ${seeded ? "variável" : "anterior"}, perfis ${identical ? "iguais" : "mistos"}`,
  );
}
const report = {
  date: new Date().toISOString(),
  method:
    "3 jogadores, 4 locais, seeds sequenciais; perfis em rotação uniforme. Taxas por classe/raridade são observacionais, confundidas com perfil e ritual.",
  results,
};
await writeFile(
  "docs/balance-audit.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
