import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("POST /api/auth/challenge", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.ALLOWED_DOMAINS;
  });

  it("uses a validated host as the challenge domain", async () => {
    process.env.ALLOWED_DOMAINS = "xolosarmy.xyz";

    const response = await POST(
      new Request("https://xolosarmy.xyz/api/auth/challenge", {
        method: "POST",
        headers: { host: "xolosarmy.xyz" },
        body: JSON.stringify({ address: "ecash:qbuyer" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.challenge.domain).toBe("xolosarmy.xyz");
  });

  it("rejects an invalid host", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.ALLOWED_DOMAINS = "xolosarmy.xyz";

    const response = await POST(
      new Request("https://evil.example/api/auth/challenge", {
        method: "POST",
        headers: { host: "evil.example" },
        body: JSON.stringify({ address: "ecash:qbuyer" }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Invalid host",
      reason: "Host header is not allowed",
    });
    expect(response.status).toBe(400);
  });
});
