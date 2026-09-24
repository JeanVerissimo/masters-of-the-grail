import { GameEngine } from "@grail/game-core";
import { BotController } from "@grail/bot-controller";
import { profiles, type PlayerController } from "@grail/shared";

export async function runMatch(seed: number, controllers?: PlayerController[]) {
  const bots =
    controllers ??
    Array.from(
      { length: 3 },
      (_, i) => new BotController(profiles[(seed + i) % profiles.length], seed),
    );
  const engine = new GameEngine({
    seed,
    locationCount: 4,
    players: bots.map((_, i) => ({
      id: `p${i}`,
      name: `Master ${i + 1}`,
      kind: "BOT",
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
  return { engine, complete: engine.phase === "FINISHED" };
}
if (process.argv[1]?.endsWith("simulate.ts")) {
  const count =
    Number(process.argv[process.argv.indexOf("--matches") + 1]) || 100;
  let days = 0,
    draws = 0,
    incomplete = 0;
  const wins: Record<string, number> = {};
  for (let seed = 0; seed < count; seed++) {
    const { engine, complete } = await runMatch(seed);
    days += engine.day;
    if (!complete) {
      incomplete++;
      continue;
    }
    const winner = engine.playerView("p0").winner;
    if (winner) wins[winner] = (wins[winner] ?? 0) + 1;
    else draws++;
  }
  console.log(
    JSON.stringify(
      { matches: count, averageDays: days / count, wins, draws, incomplete },
      null,
      2,
    ),
  );
  if (incomplete) process.exitCode = 1;
}
