import { it, expect } from "vitest";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalStorage } from "../apps/server/src/storage.js";
import { MatchManager } from "../apps/server/src/manager.js";
import { GameEngine } from "@grail/game-core";

it("keeps frameworks, providers and controllers out of game-core", async () => {
  for (const file of await readdir("packages/game-core/src")) {
    const source = await readFile(join("packages/game-core/src", file), "utf8");
    expect(source).not.toMatch(
      /from ["'](?:react|fastify|@grail\/(?:llm|agent-controller|bot-controller|human-controller))/,
    );
    expect(source).not.toContain("Math.random(");
  }
});
it("persists provider settings without credentials and rejects unsupported save versions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "grail-secrets-"));
  try {
    const storage = new LocalStorage(dir),
      manager = new MatchManager(storage);
    const result = await manager.addProvider({
      id: "private",
      kind: "ollama",
      baseUrl: "http://localhost:11434",
      model: "test",
      apiKey: "never-persist-this-value",
      limits: { maxRequests: 4 },
    });
    expect(JSON.stringify(result)).not.toContain("never-persist-this-value");
    expect(await readFile(join(dir, "providers.json"), "utf8")).not.toContain(
      "never-persist-this-value",
    );
    const restored = new MatchManager(storage);
    await restored.restoreProviders();
    expect(restored.providers()[0].model).toBe("test");
    expect(() => GameEngine.fromReplay({ saveVersion: 99 })).toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
