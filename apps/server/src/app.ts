import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { z, ZodError } from "zod";
import { idSchema, summoningSchema } from "@grail/shared";
import { summoningProbabilities, bestSummoningRituals } from "@grail/game-core";
import { descriptions } from "../../../data/servants/descriptions.js";
import { descriptionsEn } from "../../../data/servants/descriptions.en.js";
import { MatchManager } from "./manager.js";
import { TutorialSession } from "./tutorial.js";
import { servants } from "../../../data/servants/index.js";

export async function createApp(manager = new MatchManager()) {
  await manager.restoreProviders();
  const app = Fastify({ logger: false, bodyLimit: 1000000 });
  const session = randomBytes(32).toString("hex");
  let tutorial: TutorialSession | null = null;
  let bestRituals: ReturnType<typeof bestSummoningRituals> | undefined;
  const allowedHost = (value: string) => {
    try {
      const u = new URL(`http://${value}`);
      return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
    } catch {
      return false;
    }
  };
  app.addHook("onRequest", async (req, reply) => {
    if (!allowedHost(req.headers.host ?? ""))
      return reply.code(403).send({ error: "INVALID_HOST" });
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (!allowedHost(new URL(origin).host))
          return reply.code(403).send({ error: "INVALID_ORIGIN" });
      } catch {
        return reply.code(403).send({ error: "INVALID_ORIGIN" });
      }
    }
    if (!req.url.startsWith("/api/") || req.url === "/api/session") return;
    const cookie =
      req.headers.cookie
        ?.split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("grail_session="))
        ?.slice(14) ?? "";
    if (
      cookie.length !== session.length ||
      !timingSafeEqual(Buffer.from(cookie), Buffer.from(session))
    )
      return reply.code(401).send({ error: "SESSION_REQUIRED" });
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers["x-grail-request"] !== "1"
    )
      return reply.code(403).send({ error: "INVALID_REQUEST" });
  });
  app.setErrorHandler((error, _req, reply) => {
    const known = /^[A-Z][A-Z0-9_]+$/;
    const message = error instanceof Error ? error.message : "";
    reply
      .code(
        message === "MATCH_NOT_FOUND"
          ? 404
          : message === "MATCH_BUSY"
            ? 409
            : 400,
      )
      .send({
        error:
          error instanceof ZodError
            ? "INVALID_INPUT"
            : known.test(message)
              ? message
              : "REQUEST_FAILED",
      });
  });
  await app.register(websocket, { options: { maxPayload: 4096 } });
  app.get("/api/session", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header(
      "Set-Cookie",
      `grail_session=${session}; HttpOnly; SameSite=Strict; Path=/`,
    );
    return { ok: true };
  });
  app.get("/api/settings", async () => manager.storage.settings());
  app.get("/api/servants", async () =>
    servants.map((servant) => ({
      servant,
      description: descriptions[servant.id],
      descriptionEn: descriptionsEn[servant.id],
    })),
  );
  app.get("/api/servants/:id/rituals", async (req) => {
    const servantId = z.object({ id: idSchema }).parse(req.params).id;
    if (!servants.some((s) => s.id === servantId))
      throw new Error("SERVANT_NOT_FOUND");
    bestRituals ??= bestSummoningRituals(
      servants,
      () => new Promise((resolve) => setImmediate(resolve)),
    );
    return (await bestRituals)[servantId];
  });
  app.post("/api/summoning/simulate", async (req) => {
    const decision = summoningSchema.parse(req.body);
    const probabilities = summoningProbabilities(decision);
    const top = probabilities.slice(0, 5);
    return {
      top,
      remainingProbability: probabilities
        .slice(5)
        .reduce((sum, p) => sum + p.probability, 0),
    };
  });
  app.get("/api/catalog", async () => ({
    count: servants.length,
    rosterVersion: 2,
  }));
  app.post("/api/tutorial", async () => {
    tutorial = new TutorialSession();
    return tutorial.snapshot();
  });
  app.get("/api/tutorial", async () => {
    if (!tutorial) throw new Error("TUTORIAL_NOT_STARTED");
    return tutorial.snapshot();
  });
  app.post("/api/tutorial/advance", async (req) => {
    if (!tutorial) throw new Error("TUTORIAL_NOT_STARTED");
    return tutorial.advance(req.body);
  });
  app.put("/api/settings", async (req) =>
    manager.storage.setSettings(req.body),
  );
  app.get("/api/providers", async () => manager.providers());
  app.post("/api/providers", async (req) => manager.addProvider(req.body));
  app.delete("/api/providers/:id", async (req) =>
    manager.removeProvider(z.object({ id: idSchema }).parse(req.params).id),
  );
  app.post("/api/providers/:id/test", async (req) =>
    manager.testProvider(z.object({ id: idSchema }).parse(req.params).id),
  );
  app.get("/api/saves", async () => manager.storage.list());
  app.post("/api/matches", async (req) => manager.create(req.body));
  const id = (params: unknown) => z.object({ id: idSchema }).parse(params).id;
  app.get("/api/matches/:id", async (req) => manager.view(id(req.params)));
  app.post("/api/matches/:id/combat/continue", async (req) => {
    const body = z
      .strictObject({ day: z.number().int().positive() })
      .parse(req.body);
    return manager.acknowledgeCombat(id(req.params), body.day);
  });
  app.post("/api/matches/:id/advance", async (req) => {
    const body = z
      .strictObject({ intent: z.unknown().optional() })
      .parse(req.body ?? {});
    return manager.advance(id(req.params), body.intent);
  });
  app.post("/api/matches/:id/save", async (req) =>
    manager.save(id(req.params)),
  );
  app.post("/api/matches/:id/load", async (req) =>
    manager.load(id(req.params)),
  );
  app.get("/api/matches/:id/replay", async (req) =>
    manager.replay(id(req.params)),
  );
  app.get("/api/matches/:id/replay/:step", async (req) => {
    const params = z
      .object({
        id: idSchema,
        step: z.coerce.number().int().min(0).max(100000),
      })
      .parse(req.params);
    return manager.replayFrame(params.id, params.step);
  });
  app.get("/api/matches/:id/events", { websocket: true }, (socket, req) => {
    let unsubscribe = () => {};
    socket.on("error", () => unsubscribe());
    socket.on("close", () => unsubscribe());
    try {
      const matchId = id(req.params);
      const send = () => {
        if (socket.readyState === 1)
          socket.send(
            JSON.stringify({ type: "MATCH_UPDATED", ...manager.view(matchId) }),
          );
      };
      unsubscribe = manager.subscribe(matchId, send);
      send();
    } catch {
      socket.close(1008, "INVALID_MATCH");
    }
  });
  return app;
}
