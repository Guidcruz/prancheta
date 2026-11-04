/**
 * Seeded, deterministic random number generator (mulberry32).
 * The engine never uses Math.random(): the same seed must always produce the same season.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with the given probability. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** One element of the array, or undefined when it is empty (the engine never throws). */
  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[this.int(0, items.length - 1)];
  }

  /**
   * Shuffles the array in place (Fisher-Yates, from the last index down, one `int(0, i)` per
   * step) and returns it. The number and order of draws are part of the determinism contract.
   */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [items[i], items[j]] = [items[j]!, items[i]!];
    }
    return items;
  }

  /** Current internal state, to be stored in a save. */
  getState(): number {
    return this.state;
  }

  /** Rebuilds a generator from a saved state, continuing the same sequence. */
  static fromState(state: number): Rng {
    const r = new Rng(0);
    r.state = state >>> 0;
    return r;
  }

  /** A child generator derived from this one, for independent streams. */
  fork(): Rng {
    return new Rng(Math.floor(this.next() * 4294967296));
  }
}

/** Builds a 32-bit seed from a string (FNV-1a), so saves can carry a readable seed. */
export function seedFromString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
