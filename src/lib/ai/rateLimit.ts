interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

const DEFAULT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_LIMIT = 12;

type GlobalWithRateLimit = typeof globalThis & {
  __tctAiRateLimits?: Map<string, RateLimitBucket>;
};

export function checkAiRateLimit(
  key: string,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS
): RateLimitResult {
  const globalRef = globalThis as GlobalWithRateLimit;
  if (!globalRef.__tctAiRateLimits) {
    globalRef.__tctAiRateLimits = new Map();
  }

  const now = Date.now();
  const buckets = globalRef.__tctAiRateLimits;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
    retryAfterSeconds: 0,
  };
}