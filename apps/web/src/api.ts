/** A interface conversa com o servidor local, que também hospeda os Agents. */
export const AGENTS_ENABLED = true;
/** O servidor envia atualizações da partida por WebSocket. */
export const LIVE_UPDATES = true;

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Grail-Request": "1" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "REQUEST_FAILED");
  return value as T;
}
