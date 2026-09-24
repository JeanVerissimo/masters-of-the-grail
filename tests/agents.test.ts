import { it, expect } from "vitest";
import { AgentRuntime } from "@grail/agent-controller";
import { LLMGateway, HTTPProvider } from "@grail/llm";
import { GameEngine } from "@grail/game-core";
import { BotController } from "@grail/bot-controller";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
const setup = () =>
  new GameEngine({
    seed: 77,
    locationCount: 2,
    players: [
      { id: "a", name: "A", kind: "AGENT" },
      { id: "b", name: "B", kind: "BOT" },
    ],
  });
it("finishes an entire Agent match through the actual HTTP adapter", async () => {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const prompt = JSON.parse(body.messages[0].content);
    const decision = await new BotController().decide(prompt.context);
    const output = decision.type === "SUMMON" ? decision.decision : decision;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(output) } }],
        usage: { prompt_tokens: 30, completion_tokens: 50 },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const engine = setup(),
      port = (server.address() as AddressInfo).port;
    const runtime = new AgentRuntime(
      new LLMGateway(
        new HTTPProvider({
          id: "http-test",
          kind: "openai-compatible",
          baseUrl: `http://127.0.0.1:${port}/v1`,
          model: "scripted-strategy",
        }),
      ),
      { maxTokens: 1000000, maxRequests: 1000 },
    );
    const bot = new BotController("Aggressive");
    let steps = 0;
    while (engine.phase !== "FINISHED" && steps++ < 500) {
      for (const id of engine.playerIds) {
        const v = engine.playerView(id);
        if (v.canAct)
          engine.submitIntent(
            id,
            id === "a"
              ? await runtime.decide(v, (i) => engine.validateIntent(id, i))
              : await bot.decide(v),
          );
      }
      engine.resolvePhase();
    }
    expect(engine.phase).toBe("FINISHED");
    expect(runtime.metrics().length).toBeGreaterThan(3);
    expect(runtime.metrics().every((m) => !m.fallback)).toBe(true);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
it("handles tools without state access and does not promote notes to facts", async () => {
  const engine = setup();
  for (const id of engine.playerIds)
    engine.submitIntent(
      id,
      await new BotController().decide(engine.playerView(id)),
    );
  engine.resolvePhase();
  let calls = 0;
  const runtime = new AgentRuntime(
    new LLMGateway({
      id: "tool-model",
      model: "test",
      generate: async (req) => {
        calls++;
        if (calls === 1) return { output: { tool: "get_my_resources" } };
        expect(req.prompt).toContain("get_my_resources");
        return {
          output: {
            intent: { type: "LOCATION", location: "location-1" },
            note: "Opponent may prefer the harbor.",
          },
        };
      },
    }),
  );
  await runtime.decide(engine.playerView("a"), (i) =>
    engine.validateIntent("a", i),
  );
  expect(runtime.metrics()[0].toolCalls).toBe(1);
  expect(runtime.memory().agentNotes).toHaveLength(1);
  expect(JSON.stringify(runtime.memory().verifiedFacts)).not.toContain(
    "harbor",
  );
  const state = runtime.exportState();
  const restored = new AgentRuntime(runtime.gateway);
  restored.restoreState(state);
  expect(restored.exportState()).toEqual(state);
});
it("rejects semantically impossible model output and falls back", async () => {
  const engine = setup();
  for (const id of engine.playerIds)
    engine.submitIntent(
      id,
      await new BotController().decide(engine.playerView(id)),
    );
  engine.resolvePhase();
  const runtime = new AgentRuntime(
    new LLMGateway({
      id: "hostile",
      model: "test",
      generate: async () => ({
        output: { type: "LOCATION", location: "nonexistent" },
      }),
    }),
    { retries: 1 },
  );
  const decision = await runtime.decide(engine.playerView("a"), (i) =>
    engine.validateIntent("a", i),
  );
  expect(decision.type).toBe("LOCATION");
  expect(runtime.metrics()[0].invalidAttempts).toBe(2);
  expect(runtime.metrics()[0].fallback).toBe(true);
});
