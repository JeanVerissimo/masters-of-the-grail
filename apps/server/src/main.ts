import { resolve } from "node:path";
import { existsSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import { createApp } from "./app.js";
const app = await createApp();
const root = resolve("dist/web");
if (existsSync(root))
  await app.register(fastifyStatic, { root, index: "index.html", list: false });
await app.listen({ host: "127.0.0.1", port: Number(process.env.PORT ?? 3001) });
console.log(`Holy Grail War: http://127.0.0.1:${process.env.PORT ?? 3001}`);
