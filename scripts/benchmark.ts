import { readFile } from "node:fs/promises";
import { GameEngine } from "@grail/game-core";
import { BotController } from "@grail/bot-controller";
import { AgentRuntime, AgentController } from "@grail/agent-controller";
import { HTTPProvider, LLMGateway, providerConfigSchema } from "@grail/llm";
import { aggregateMetrics } from "@grail/telemetry";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : process.argv[i + 1];
};
const matches = Number(arg("--matches", "1"));
const file = arg("--provider", "");
const settings = file
  ? providerConfigSchema.parse(JSON.parse(await readFile(file, "utf8")))
  : null;
const results = [];
for (let seed = 0; seed < matches; seed++) {
  const engine = new GameEngine({
    seed,
    locationCount: 4,
    players: [
      { id: "agent", name: "Agent", kind: "AGENT" },
      { id: "bot", name: "Bot", kind: "BOT" },
    ],
  });
  const gateway = new LLMGateway(
    settings
      ? new HTTPProvider(settings)
      : {
          id: "offline",
          model: "fallback",
          generate: async () => {
            throw new Error("OFFLINE");
          },
        },
  );
  const runtime = new AgentRuntime(gateway, {
    ...settings?.limits,
    inputPricePerMillion: settings?.inputPricePerMillion,
    outputPricePerMillion: settings?.outputPricePerMillion,
  });
  const controllers = [
    new AgentController(runtime, (i) => engine.validateIntent("agent", i)),
    new BotController("Aggressive"),
  ];
  let steps = 0;
  while (engine.phase !== "FINISHED" && steps++ < 4000) {
    for (const [i, id] of engine.playerIds.entries()) {
      const v = engine.playerView(id);
      if (v.canAct) engine.submitIntent(id, await controllers[i].decide(v));
    }
    engine.resolvePhase();
  }
  const metrics = runtime.metrics();
  const failures = metrics
    .flatMap((m) => m.failureReasons)
    .reduce<Record<string, number>>((counts, reason) => {
      counts[reason] = (counts[reason] ?? 0) + 1;
      return counts;
    }, {});
  results.push({
    seed,
    complete: engine.phase === "FINISHED",
    days: engine.day,
    winner: engine.playerView("agent").winner,
    decisions: metrics.length,
    failures,
    successfulPhases: [
      ...new Set(metrics.filter((m) => !m.fallback).map((m) => m.phase)),
    ],
    fallbacks: metrics.filter((m) => m.fallback).length,
    invalidAttempts: metrics.reduce((n, m) => n + m.invalidAttempts, 0),
    inputTokens: metrics.reduce((n, m) => n + m.inputTokens, 0),
    outputTokens: metrics.reduce((n, m) => n + m.outputTokens, 0),
    averageLatencyMs:
      metrics.reduce((n, m) => n + m.latencyMs, 0) /
      Math.max(1, metrics.length),
    estimatedCost: metrics.every((m) => m.estimatedCost !== null)
      ? metrics.reduce((n, m) => n + (m.estimatedCost ?? 0), 0)
      : null,
    players:
      engine.phase === "FINISHED"
        ? aggregateMetrics(engine.auditEvents())
        : null,
  });
}
console.log(
  JSON.stringify(
    {
      provider: settings?.id ?? "offline",
      model: settings?.model ?? "fallback",
      matches,
      results,
    },
    null,
    2,
  ),
);
