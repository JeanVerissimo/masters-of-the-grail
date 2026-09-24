import { z } from "zod";
import { replaySchema, type Replay } from "@grail/shared";
import { themes } from "../../shared/src/catalog.js";

export const settingsSchema = z.strictObject({
  locale: z.enum(["pt-BR", "en-US"]).default("pt-BR"),
  reducedMotion: z.boolean().default(false),
  theme: z.enum(themes).default("dark"),
});
export type Settings = z.infer<typeof settingsSchema>;
export function migrateSave(input: unknown): Replay {
  // Versões futuras devem ter migrações explícitas; nunca reinterpretar silenciosamente.
  return replaySchema.parse(input);
}
