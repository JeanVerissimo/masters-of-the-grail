export class RandomService {
  #state: number;
  constructor(seed: number) {
    this.#state = seed >>> 0;
  }
  next(): number {
    let t = (this.#state = (this.#state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  pick<T>(items: readonly T[]): T {
    if (!items.length) throw new Error("Empty pool");
    return items[Math.floor(this.next() * items.length)];
  }
  weighted<T>(items: readonly T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    if (
      items.length !== weights.length ||
      !items.length ||
      weights.some((w) => !Number.isFinite(w) || w < 0) ||
      total <= 0
    )
      throw new Error("Invalid weights");
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll < 0) return items[i];
    }
    return items[items.length - 1];
  }
}
