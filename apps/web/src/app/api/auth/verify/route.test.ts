import { createAuthChallenge } from "@xolosarmy/tonalli-auth";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getAuthChallengeStore } from "../../../../server/auth/auth-store";

import { POST } from "./route";

describe("POST /api/auth/verify", () => {
  afterEach(() => {
    delete process.env.TONALLI_AUTH_DEV_BYPASS;
    delete process.env.TONALLI_AUTH_SESSION_SECRET;
    delete process.env.ALLOWED_ORIGINS;
  });

  it("emits a session cookie for a valid signature", async () => {
    process.env.TONALLI_AUTH_DEV_BYPASS = "true";
    process.env.TONALLI_AUTH_SESSION_SECRET = "test-secret";
    const challenge = createAuthChallenge({
      domain: "localhost:3000",
      address: "ecash:qbuyer",
      alias: "buyer",
      nonce: crypto.randomUUID(),
      expiresInMinutes: 10,
    });
    const store = await getAuthChallengeStore();
    await store.create(challenge);

    const response = await POST(
      new Request("http://localhost:3000/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({
          nonce: challenge.nonce,
          signature: "dev-valid-signature",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      valid: true,
      address: "ecash:qbuyer",
      alias: "buyer",
      authenticated: true,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("tonalli_session=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("does not emit a session cookie for an invalid signature", async () => {
    process.env.TONALLI_AUTH_DEV_BYPASS = "true";
    process.env.TONALLI_AUTH_SESSION_SECRET = "test-secret";
    const challenge = createAuthChallenge({
      domain: "localhost:3000",
      address: "ecash:qbuyer",
      nonce: crypto.randomUUID(),
      expiresInMinutes: 10,
    });
    const store = await getAuthChallengeStore();
    await store.create(challenge);

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await POST(
      new Request("http://localhost:3000/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({
          nonce: challenge.nonce,
          signature: "invalid-signature",
        }),
      }),
    );

    consoleError.mockRestore();

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects an invalid origin", async () => {
    process.env.ALLOWED_ORIGINS = "https://xolosarmy.xyz";

    const response = await POST(
      new Request("https://xolosarmy.xyz/api/auth/verify", {
        method: "POST",
        headers: { origin: "https://evil.example" },
        body: JSON.stringify({
          nonce: "nonce",
          signature: "signature",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Invalid origin",
      reason: "Origin header is not allowed",
    });
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
