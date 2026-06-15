import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTonalliSessionToken,
  getAuthenticatedTonalliUser,
  TONALLI_SESSION_COOKIE_NAME,
  verifyTonalliSessionToken,
} from "./session";

describe("TonalliAuth session tokens", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.TONALLI_AUTH_SESSION_SECRET;
    delete process.env.TONALLI_AUTH_SESSION_MAX_AGE_SECONDS;
  });

  it("reads a valid token from the session cookie", async () => {
    process.env.TONALLI_AUTH_SESSION_SECRET = "test-secret";
    const token = await createTonalliSessionToken({
      address: "ecash:qbuyer",
      alias: "buyer",
      issuedAt: "2026-06-15T00:00:00.000Z",
    });

    const request = new Request("http://localhost/api/auth/session", {
      headers: {
        cookie: `${TONALLI_SESSION_COOKIE_NAME}=${token}`,
      },
    });

    await expect(getAuthenticatedTonalliUser(request)).resolves.toEqual({
      address: "ecash:qbuyer",
      alias: "buyer",
      network: "eCash",
      version: "TonalliAuth-v1",
      issuedAt: "2026-06-15T00:00:00.000Z",
    });
  });

  it("rejects a corrupt token", async () => {
    process.env.TONALLI_AUTH_SESSION_SECRET = "test-secret";

    await expect(verifyTonalliSessionToken("not-a-token")).resolves.toBeNull();
  });

  it("requires a session secret in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(
      createTonalliSessionToken({ address: "ecash:qbuyer" }),
    ).rejects.toThrow(
      "TONALLI_AUTH_SESSION_SECRET is required when NODE_ENV=production",
    );
  });

  it("allows an explicit development fallback outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const token = await createTonalliSessionToken({ address: "ecash:qbuyer" });

    await expect(verifyTonalliSessionToken(token)).resolves.toMatchObject({
      address: "ecash:qbuyer",
      network: "eCash",
      version: "TonalliAuth-v1",
    });
  });
});
