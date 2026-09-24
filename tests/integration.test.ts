import { it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../apps/server/src/app.js";
import { LocalStorage } from "../apps/server/src/storage.js";
import { MatchManager } from "../apps/server/src/manager.js";
import { AgentRuntime, runViewTool } from "@grail/agent-controller";
import {
  LLMGateway,
  HTTPProvider,
  parseModelJSON,
  providerErrorCode,
  validateProviderURL,
  type LLMRequest,
} from "@grail/llm";
import { GameEngine } from "@grail/game-core";
import { BotController } from "@grail/bot-controller";
import { sanitize } from "@grail/telemetry";
const config = {
  seed: 91,
  locationCount: 4,
  players: [
    { id: "a", name: "A", kind: "HUMAN" },
    { id: "b", name: "B", kind: "BOT" },
  ],
};
it("runs authorized REST matches, saves, replay and settings without exposing other perspectives", async () => {
  const dir = await mkdtemp(join(tmpdir(), "grail-test-"));
  const storage = new LocalStorage(dir),
    manager = new MatchManager(storage),
    app = await createApp(manager);
  try {
    const denied = await app.inject({ method: "GET", url: "/api/saves" });
    expect(denied.statusCode).toBe(401);
    const evil = await app.inject({
      method: "GET",
      url: "/api/session",
      headers: { origin: "https://evil.example" },
    });
    expect(evil.statusCode).toBe(403);
    const session = await app.inject({ method: "GET", url: "/api/session" });
    const headers = {
      cookie: String(session.headers["set-cookie"]).split(";")[0],
      "x-grail-request": "1",
    };
    const created = await app.inject({
      method: "POST",
      url: "/api/matches",
      headers,
      payload: config,
    });
    expect(created.statusCode).toBe(200);
    const id = created.json().id;
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/matches/${id}/replay`,
          headers,
        })
      ).statusCode,
    ).toBe(400);
    const bot = new BotController();
    let data = created.json();
    let steps = 0;
    while (data.view.phase !== "FINISHED" && steps++ < 500) {
      if (data.combatResolution) {
        data = (
          await app.inject({
            method: "POST",
            url: `/api/matches/${id}/combat/continue`,
            headers,
            payload: { day: data.view.lastCombat.day },
          })
        ).json();
      }
      const intent = data.view.canAct ? await bot.decide(data.view) : undefined;
      const response = await app.inject({
        method: "POST",
        url: `/api/matches/${id}/advance`,
        headers,
        payload: intent ? { intent } : {},
      });
      expect(response.statusCode).toBe(200);
      data = response.json();
    }
    expect(data.view.phase).toBe("FINISHED");
    expect((await storage.list()).some((s) => s.id === id)).toBe(true);
    const resumed = await manager.load(id);
    expect(resumed.view).toEqual(data.view);
    const replay = await app.inject({
      method: "GET",
      url: `/api/matches/${id}/replay`,
      headers,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().events.length).toBeGreaterThan(10);
    await storage.setSettings({ locale: "en-US", reducedMotion: true });
    expect((await storage.settings()).locale).toBe("en-US");
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/matches/${id}?playerId=b`,
          headers,
        })
      ).json().view.self.id,
    ).toBe("a");
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
it("makes one LLM request for all six summoning choices", async () => {
  const engine = new GameEngine(config),
    view = engine.playerView("a"),
    decision = await new BotController().decide(view);
  let calls = 0;
  const runtime = new AgentRuntime(
    new LLMGateway({
      id: "mock",
      model: "test",
      generate: async (req: LLMRequest) => {
        calls++;
        expect(req.prompt).toContain("manaOffering");
        expect(req.prompt).toContain("grailWish");
        return {
          output: decision.type === "SUMMON" ? decision.decision : null,
          inputTokens: 20,
          outputTokens: 30,
        };
      },
    }),
  );
  const result = await runtime.decide(view, (i) =>
    engine.validateIntent("a", i),
  );
  expect(result).toEqual(decision);
  expect(calls).toBe(1);
  expect(runtime.metrics()[0].fallback).toBe(false);
});
it("bounds retries, invalid targets and timeout, then falls back", async () => {
  const engine = new GameEngine(config);
  let calls = 0;
  const runtime = new AgentRuntime(
    new LLMGateway({
      id: "offline",
      model: "test",
      generate: async () => {
        calls++;
        throw new Error("Authorization: sk-secret");
      },
    }),
    { retries: 1 },
  );
  const result = await runtime.decide(engine.playerView("a"), (i) =>
    engine.validateIntent("a", i),
  );
  expect(result.type).toBe("SUMMON");
  expect(calls).toBe(2);
  expect(JSON.stringify(runtime.metrics())).not.toContain("sk-secret");
  expect(runtime.metrics()[0].fallback).toBe(true);
  const timeout = new AgentRuntime(
    new LLMGateway({
      id: "hung",
      model: "test",
      generate: () => new Promise(() => {}),
    }),
    { timeoutMs: 20 },
  );
  expect(
    (
      await timeout.decide(engine.playerView("a"), (i) =>
        engine.validateIntent("a", i),
      )
    ).type,
  ).toBe("SUMMON");
});
it("enforces budget before calling and isolates tool views", async () => {
  const engine = new GameEngine(config);
  const runtime = new AgentRuntime(
    new LLMGateway({
      id: "budget",
      model: "test",
      generate: async () => {
        throw new Error("MUST_NOT_CALL");
      },
    }),
    { maxRequests: 0 },
  );
  await runtime.decide(engine.playerView("a"), (i) =>
    engine.validateIntent("a", i),
  );
  expect(runtime.metrics()[0].invalidAttempts).toBe(0);
  const enemies = runViewTool("get_known_enemies", engine.playerView("a"));
  expect(JSON.stringify(enemies)).not.toContain("mana");
  expect(() =>
    runViewTool("getGameState" as "get_locations", engine.playerView("a")),
  ).toThrow();
});
it("validates URLs, redacts secrets and parses real adapter wire formats", async () => {
  for (const url of [
    "file:///tmp/x",
    "http://example.com",
    "http://169.254.169.254",
    "https://user:pass@example.com",
    "https://example.com/#x",
  ])
    expect(() => validateProviderURL(url)).toThrow();
  expect(validateProviderURL("http://localhost:11434")).toBe(
    "http://localhost:11434",
  );
  expect(
    sanitize({
      apiKey: "abc",
      nested: { authorization: "foo" },
      message: "Bearer secret",
    }),
  ).toEqual({
    apiKey: "[REDACTED]",
    nested: { authorization: "[REDACTED]" },
    message: "Bearer [REDACTED]",
  });
  const provider = new HTTPProvider(
    {
      id: "test",
      kind: "openai-compatible",
      baseUrl: "http://localhost:9999/v1",
      model: "local",
    },
    async (_url, options) => {
      expect(JSON.parse(options!.body as string).response_format.type).toBe(
        "json_object",
      );
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' } }],
          usage: { prompt_tokens: 4, completion_tokens: 2 },
        }),
      );
    },
  );
  expect(
    (
      await provider.generate({
        prompt: "JSON",
        schema: {},
        maxOutputTokens: 32,
        signal: new AbortController().signal,
      })
    ).output,
  ).toEqual({ ok: true });

  const cloud = new HTTPProvider(
    {
      id: "ollama-cloud",
      kind: "ollama-cloud",
      baseUrl: "https://ollama.com",
      model: "example-cloud-model",
      apiKey: "test-secret",
    },
    async (url, options) => {
      expect(url).toBe("https://ollama.com/api/chat");
      expect(new Headers(options!.headers).get("authorization")).toBe(
        "Bearer test-secret",
      );
      const body = JSON.parse(options!.body as string);
      expect(body.format).toBeUndefined();
      expect(body.response_format).toBeUndefined();
      expect(body.think).toBe(false);
      return new Response(
        JSON.stringify({
          message: { content: '```json\n{"ok":true}\n```' },
        }),
      );
    },
  );
  expect(
    (
      await cloud.generate({
        prompt: 'Return JSON {"ok":true}.',
        schema: {
          type: "object",
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
        },
        maxOutputTokens: 32,
        signal: new AbortController().signal,
      })
    ).output,
  ).toEqual({ ok: true });
});

it("extracts model JSON and reports clear provider errors", async () => {
  expect(parseModelJSON('Aqui está: {"ok":true}')).toEqual({ ok: true });
  expect(() => parseModelJSON("sem json")).toThrow(SyntaxError);
  const request = { prompt: "JSON", schema: {}, maxOutputTokens: 32 };
  const provider = (reply: () => Promise<Response>) =>
    new HTTPProvider(
      {
        id: "cloud",
        kind: "ollama-cloud",
        baseUrl: "http://localhost:11434",
        model: "deepseek-v4.1-flash:cloud",
      },
      reply,
    );
  await expect(
    provider(async () =>
      Response.json({ message: { content: "" }, done_reason: "length" }),
    ).generate({ ...request, signal: new AbortController().signal }),
  ).rejects.toThrow("PROVIDER_OUTPUT_TRUNCATED");
  await expect(
    provider(async () => {
      throw new TypeError("fetch failed");
    }).generate({ ...request, signal: new AbortController().signal }),
  ).rejects.toThrow("PROVIDER_UNREACHABLE");
  await expect(
    provider(async () => new Response("<html>")).generate({
      ...request,
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow("PROVIDER_INVALID_RESPONSE");
});

it("maps OpenAI errors and uses max_completion_tokens on api.openai.com", async () => {
  expect(
    providerErrorCode(
      429,
      JSON.stringify({
        error: {
          message: "You exceeded your current quota.",
          type: "insufficient_quota",
          code: "insufficient_quota",
        },
      }),
    ),
  ).toBe("PROVIDER_NO_CREDIT");
  expect(
    providerErrorCode(
      401,
      JSON.stringify({ error: { code: "invalid_api_key", message: "x" } }),
    ),
  ).toBe("PROVIDER_INVALID_KEY");
  expect(
    providerErrorCode(404, JSON.stringify({ error: "model 'x' not found" })),
  ).toBe("PROVIDER_MODEL_NOT_FOUND");
  expect(providerErrorCode(429, "{}")).toBe("PROVIDER_RATE_LIMIT");
  expect(providerErrorCode(500, "<html>")).toBe("PROVIDER_HTTP_500");
  const openai = new HTTPProvider(
    {
      id: "openai",
      kind: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-test",
      apiKey: "sk-test",
    },
    async (url, options) => {
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      const body = JSON.parse(options!.body as string);
      expect(body.max_completion_tokens).toBe(32);
      expect(body.max_tokens).toBeUndefined();
      return Response.json(
        { error: { type: "insufficient_quota", code: "insufficient_quota" } },
        { status: 429 },
      );
    },
  );
  await expect(
    openai.generate({
      prompt: "JSON",
      schema: {},
      maxOutputTokens: 32,
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow("PROVIDER_NO_CREDIT");
});
