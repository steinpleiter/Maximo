/**
 * Seedable RNG. Deterministic by design: a round replays identically from the
 * same seed and the same sequence of quiz answers, which makes debugging an
 * outlier win tractable.
 */
export class Rng {
  private s: number;

  constructor(seed: number | string = Date.now()) {
    this.s = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    // Avoid the degenerate zero state.
    if (this.s === 0) this.s = 0x9e3779b9;
  }

  /** mulberry32 — small, fast, good enough for a game. */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max < min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Integer in [min, max] from a `[min, max]` tuple. */
  range([min, max]: readonly [number, number]): number {
    return this.int(min, max);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Weighted pick over `[item, weight]` pairs. Zero-weight items never win. */
  weighted<T>(entries: readonly { item: T; weight: number }[]): T {
    let total = 0;
    for (const e of entries) total += Math.max(0, e.weight);
    let roll = this.next() * total;
    for (const e of entries) {
      roll -= Math.max(0, e.weight);
      if (roll <= 0) return e.item;
    }
    return entries[entries.length - 1].item;
  }

  /** In-place Fisher-Yates. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}

function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
