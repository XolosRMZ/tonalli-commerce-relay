import { NextResponse } from "next/server";

export interface RateLimiter {
  check(input: {
    key: string;
    route: string;
    limit: number;
    windowMs: number;
  }): Promise<{ allowed: boolean; retryAfterSeconds?: number }>;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  async check(input: {
    key: string;
    route: string;
    limit: number;
    windowMs: number;
  }): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
    const now = Date.now();
    const entryKey = `${input.route}:${input.key}`;
    const existing = this.entries.get(entryKey);

    if (existing === undefined || existing.resetAt <= now) {
      this.entries.set(entryKey, {
        count: 1,
        resetAt: now + input.windowMs,
      });

      return { allowed: true };
    }

    if (existing.count >= input.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((existing.resetAt - now) / 1000),
        ),
      };
    }

    this.entries.set(entryKey, {
      ...existing,
      count: existing.count + 1,
    });

    return { allowed: true };
  }
}

export interface RateLimitRequestInput {
  request: Request;
  route: string;
  limit: number;
  windowMs: number;
  identity?: string;
}

const globalForRateLimiter = globalThis as typeof globalThis & {
  __tonalliRateLimiter?: MemoryRateLimiter;
  __tonalliRateLimiterWarningLogged?: boolean;
};

export const memoryRateLimiter =
  globalForRateLimiter.__tonalliRateLimiter ??= new MemoryRateLimiter();

export async function rateLimitRequest(
  input: RateLimitRequestInput,
  limiter: RateLimiter = memoryRateLimiter,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  if (process.env.TONALLI_RATE_LIMIT_ENABLED === "false") {
    return { allowed: true };
  }

  if (
    process.env.NODE_ENV === "production" &&
    !globalForRateLimiter.__tonalliRateLimiterWarningLogged
  ) {
    console.warn(
      "Using in-memory Tonalli rate limiter. Configure an external provider for multi-instance production.",
    );
    globalForRateLimiter.__tonalliRateLimiterWarningLogged = true;
  }

  return limiter.check({
    key: `${input.identity ?? getClientIp(input.request)}:${input.route}`,
    route: input.route,
    limit: input.limit,
    windowMs: input.windowMs,
  });
}

export function rateLimitExceededResponse(input: {
  retryAfterSeconds?: number;
}): NextResponse {
  const retryAfterSeconds = input.retryAfterSeconds ?? 1;

  return NextResponse.json(
    { error: "Too many requests", retryAfterSeconds },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor !== null && forwardedFor.trim().length > 0) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}
