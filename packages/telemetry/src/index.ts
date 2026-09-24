import type { GameEvent } from "@grail/shared";
const secretKey =
  /api.?key|authorization|cookie|password|secret|credential|access.?token|refresh.?token|reasoning|chain.?of.?thought/i;
export function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        secretKey.test(k) ? "[REDACTED]" : sanitize(v),
      ]),
    );
  if (typeof value === "string")
    return value
      .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
      .replace(/sk-[\w-]+/g, "[REDACTED]");
  return value;
}
export type { AgentMetric } from "@grail/shared";
export function aggregateMetrics(events: GameEvent[]) {
  const players: Record<
    string,
    {
      damage: number;
      investigations: number;
      identityDiscoveries: number;
      manaUsage: number;
      npUsage: number;
      eliminations: number;
      deaths: number;
      survivalDays: number;
      actions: Record<string, number>;
    }
  > = {};
  const row = (id: string) =>
    players[id] ??
    (players[id] = {
      damage: 0,
      investigations: 0,
      identityDiscoveries: 0,
      manaUsage: 0,
      npUsage: 0,
      eliminations: 0,
      deaths: 0,
      survivalDays: 0,
      actions: {},
    });
  for (const e of events) {
    if (!e.actor) continue;
    const p = row(e.actor);
    p.survivalDays = Math.max(p.survivalDays, e.day);
    if (e.type === "DAMAGE_RESOLVED") p.damage += e.value ?? 0;
    if (e.type === "MANA_SPENT") p.manaUsage += e.value ?? 0;
    if (e.type === "NP_USED") p.npUsage++;
    if (e.type === "IDENTITY_DISCOVERED") p.identityDiscoveries++;
    if (e.type === "DAY_ACTION") {
      p.actions[e.detail!] = (p.actions[e.detail!] ?? 0) + 1;
      if (e.detail?.startsWith("INVESTIGATE")) p.investigations++;
    }
    if (e.type === "PLAYER_ELIMINATED") p.deaths++;
    if (e.type === "ELIMINATION_CREDIT") p.eliminations++;
  }
  return players;
}
