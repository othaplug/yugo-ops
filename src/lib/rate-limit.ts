/**
 * Simple in-memory sliding window rate limiter.
 * For serverless: each cold start resets; sufficient for basic abuse protection.
 */

const store = new Map<string, number[]>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, timestamps] of store) {
    const filtered = timestamps.filter((t) => t > cutoff);
    if (filtered.length === 0) store.delete(key);
    else store.set(key, filtered);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Check and consume one request from the rate limit budget.
 * @param key    Unique key (e.g. user ID or IP)
 * @param limit  Max requests in the window
 * @param windowMs  Window duration in ms (default 60s)
 */
/**
 * Legacy compat wrapper: `checkRateLimit(key, windowMs, limit)` → boolean.
 */
export function checkRateLimit(key: string, windowMs: number, limit: number): boolean {
  return rateLimit(key, limit, windowMs).allowed;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  cleanup(windowMs);

  const cutoff = now - windowMs;
  const timestamps = (store.get(key) ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: oldest + windowMs - now,
    };
  }

  timestamps.push(now);
  store.set(key, timestamps);

  return {
    allowed: true,
    remaining: limit - timestamps.length,
    retryAfterMs: 0,
  };
}
