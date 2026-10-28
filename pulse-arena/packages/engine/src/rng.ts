/**
 * Deterministic pseudo-random utilities.
 *
 * Every random decision in a match (piece deals, Pulse replacements, Static
 * cells) is derived from the match seed plus a stable key, so any two players
 * asking for "cycle 7" receive the identical result regardless of when they
 * ask. Nothing here touches Math.random.
 */

/** 32-bit FNV-1a style mix of a seed and a list of integer keys. */
export function hashKey(seed: number, ...keys: number[]): number {
  let h = (seed ^ 0x811c9dc5) >>> 0;
  for (const k of keys) {
    // Mix all four bytes of each key.
    for (let i = 0; i < 4; i++) {
      h ^= (k >>> (i * 8)) & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  // Final avalanche (murmur3 fmix32).
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Mulberry32: tiny, fast, well-distributed 32-bit generator. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick an index from a weight table using a uniform roll in [0, 1). */
export function weightedIndex(weights: readonly number[], roll: number): number {
  let total = 0;
  for (const w of weights) total += w;
  let target = roll * total;
  for (let i = 0; i < weights.length; i++) {
    target -= weights[i]!;
    if (target < 0) return i;
  }
  return weights.length - 1;
}

/** Domain-separation tags so different random streams never collide. */
export const Stream = {
  Deal: 1,
  Reroll: 2,
  Static: 3,
} as const;
