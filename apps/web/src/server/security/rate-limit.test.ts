import { afterEach, describe, expect, it } from "vitest";

import {
  MemoryRateLimiter,
  getClientIp,
  rateLimitRequest,
} from "./rate-limit";

describe("MemoryRateLimiter", () => {
  afterEach(() => {
    delete process.env.TONALLI_RATE_LIMIT_ENABLED;
  });

  it("allows requests within the limit", async () => {
    const limiter = new MemoryRateLimiter();

    await expect(
      limiter.check({ key: "ip", route: "/api/auth/challenge", limit: 2, windowMs: 1000 }),
    ).resolves.toEqual({ allowed: true });
    await expect(
      limiter.check({ key: "ip", route: "/api/auth/challenge", limit: 2, windowMs: 1000 }),
    ).resolves.toEqual({ allowed: true });
  });

  it("blocks requests over the limit", async () => {
    const limiter = new MemoryRateLimiter();

    await limiter.check({ key: "ip", route: "/api/auth/verify", limit: 1, windowMs: 1000 });

    await expect(
      limiter.check({ key: "ip", route: "/api/auth/verify", limit: 1, windowMs: 1000 }),
    ).resolves.toMatchObject({ allowed: false, retryAfterSeconds: 1 });
  });

  it("can be disabled by env", async () => {
    process.env.TONALLI_RATE_LIMIT_ENABLED = "false";
    const limiter = new MemoryRateLimiter();
    const request = new Request("http://localhost/api/orders");

    await expect(
      rateLimitRequest(
        { request, route: "/api/orders", limit: 0, windowMs: 1000 },
        limiter,
      ),
    ).resolves.toEqual({ allowed: true });
  });

  it("uses x-forwarded-for as the client ip", () => {
    const request = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });

    expect(getClientIp(request)).toBe("203.0.113.10");
  });
});
