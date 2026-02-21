/**
 * Simple in-memory rate limiter for API routes.
 * For production at scale, consider Redis or Upstash.
 */

const store = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  windowMs: number = 60_000,
  maxAttempts: number = 5
): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) return false;
  entry.count++;
  return true;
}
