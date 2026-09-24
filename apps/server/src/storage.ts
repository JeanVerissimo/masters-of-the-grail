import { mkdir, readFile, writeFile, rename, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { idSchema, replaySchema, type Replay } from "@grail/shared";
import {
  settingsSchema,
  migrateSave,
  type MatchStorage,
} from "@grail/match-runtime";
import { providerConfigSchema, type ProviderConfig } from "@grail/llm";

export { settingsSchema, migrateSave };
export class LocalStorage implements MatchStorage {
  readonly directory: string;
  #queue: Promise<void> = Promise.resolve();
  constructor(directory = ".local") {
    this.directory = resolve(directory);
  }
  async #atomic(name: string, data: unknown) {
    const operation = async () => {
      await mkdir(this.directory, { recursive: true });
      const target = join(this.directory, name),
        temp = `${target}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(data), {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temp, target);
    };
    const result = this.#queue.then(operation);
    this.#queue = result.catch(() => {});
    await result;
  }
  async save(id: string, replay: Replay) {
    idSchema.parse(id);
    await this.#atomic(`${id}.json`, replaySchema.parse(replay));
  }
  async load(id: string) {
    idSchema.parse(id);
    const raw = JSON.parse(
      await readFile(join(this.directory, `${id}.json`), "utf8"),
    );
    return migrateSave(raw);
  }
  async list() {
    await mkdir(this.directory, { recursive: true });
    const files = (await readdir(this.directory)).filter(
      (f) =>
        f.endsWith(".json") && !["settings.json", "providers.json"].includes(f),
    );
    const results = [];
    for (const file of files) {
      try {
        const replay = await this.load(file.slice(0, -5));
        results.push({
          id: file.slice(0, -5),
          seed: replay.config.seed,
          decisions: replay.decisions.length,
        });
      } catch {
        /* Saves inválidos não impedem acesso aos demais. */
      }
    }
    return results;
  }
  async settings() {
    try {
      return settingsSchema.parse(
        JSON.parse(
          await readFile(join(this.directory, "settings.json"), "utf8"),
        ),
      );
    } catch {
      return settingsSchema.parse({});
    }
  }
  async setSettings(input: unknown) {
    const settings = settingsSchema.parse(input);
    await this.#atomic("settings.json", settings);
    return settings;
  }
  async providers() {
    try {
      return z
        .array(providerConfigSchema.omit({ apiKey: true }))
        .parse(
          JSON.parse(
            await readFile(join(this.directory, "providers.json"), "utf8"),
          ),
        );
    } catch {
      return [];
    }
  }
  async setProviders(providers: ProviderConfig[]) {
    await this.#atomic(
      "providers.json",
      providers.map(({ apiKey: _key, ...safe }) => safe),
    );
  }
}
