import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertSameUser,
  getAuthorizedArbitratorUserIds,
  getAuthorizedModeratorUserIds,
  getSessionUserId,
  isProductionAuthRequired,
} from "./require-auth";
import type { AuthenticatedTonalliUser } from "./session";

const sessionUser: AuthenticatedTonalliUser = {
  address: "ecash:qbuyer",
  alias: "buyer",
  network: "eCash",
  version: "TonalliAuth-v1",
  issuedAt: "2026-06-15T00:00:00.000Z",
};

describe("require-auth helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.TONALLI_REQUIRE_AUTH;
    delete process.env.TONALLI_ARBITRATOR_USER_IDS;
    delete process.env.TONALLI_MODERATOR_USER_IDS;
  });

  it("uses the Tonalli address as the production user id", () => {
    expect(getSessionUserId(sessionUser)).toBe("ecash:qbuyer");
    expect(assertSameUser(sessionUser, "ecash:qbuyer")).toBe(true);
    expect(assertSameUser(sessionUser, "ecash:qother")).toBe(false);
  });

  it("requires auth in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(isProductionAuthRequired()).toBe(true);
  });

  it("allows legacy dev mode unless TONALLI_REQUIRE_AUTH is true", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(isProductionAuthRequired()).toBe(false);

    process.env.TONALLI_REQUIRE_AUTH = "true";

    expect(isProductionAuthRequired()).toBe(true);
  });

  it("parses arbitrator and moderator allowlists", () => {
    process.env.TONALLI_ARBITRATOR_USER_IDS = "ecash:qarb, ecash:qarb2";
    process.env.TONALLI_MODERATOR_USER_IDS = "ecash:qmod";

    expect(getAuthorizedArbitratorUserIds()).toEqual([
      "ecash:qarb",
      "ecash:qarb2",
    ]);
    expect(getAuthorizedModeratorUserIds()).toEqual(["ecash:qmod"]);
  });
});
