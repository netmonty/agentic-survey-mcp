/**
 * Minimal in-memory fixed-window rate limiter. Sufficient for a single
 * instance / v1; swap for a shared store (Redis/Upstash) when horizontally
 * scaled. Submit is the one high-abuse surface, so it's rate-limited per IP.
 */
const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.reset) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return { ok: true };
  }
  if (entry.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((entry.reset - now) / 1000) };
  }
  entry.count++;
  return { ok: true };
}
