type Window = { count: number; resetAt: number };
const windows = new Map<string, Window>();

export function checkRateLimit(key: string, limit = 100, durationMs = 60_000): void {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + durationMs });
    return;
  }
  if (current.count >= limit)
    throw Object.assign(new Error('Rate limit exceeded'), { statusCode: 429 });
  current.count += 1;
}
