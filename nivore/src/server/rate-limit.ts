import "server-only";

/**
 * In-memory sliding-window limiter. Adequate for a single development
 * process only. Production must use a shared store (Postgres or Redis) so
 * limits hold across instances — see docs/PRODUCTION.md.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterS: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfterS: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return { ok: true, retryAfterS: 0 };
}

/** Check a limit without recording a hit (pair with `hit` for failure-only counting). */
export function peek(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterS: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  return hits.length >= limit ? { ok: false, retryAfterS: Math.ceil((windowMs - (now - hits[0])) / 1000) } : { ok: true, retryAfterS: 0 };
}

export function hit(key: string) {
  const hits = buckets.get(key) ?? [];
  hits.push(Date.now());
  buckets.set(key, hits);
}
