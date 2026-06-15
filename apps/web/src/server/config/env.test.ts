import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getOptionalEnv,
  getRequiredEnv,
  validateProductionEnv,
} from "./env";

describe("env config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.DATABASE_URL;
    delete process.env.TONALLI_AUTH_SESSION_SECRET;
    delete process.env.ALLOWED_DOMAINS;
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.TONALLI_AUTH_DEV_BYPASS;
    delete process.env.TONALLI_REQUIRE_AUTH;
  });

  it("reads required and optional env values", () => {
    process.env.TEST_REQUIRED_ENV = "value";

    expect(getRequiredEnv("TEST_REQUIRED_ENV")).toBe("value");
    expect(getOptionalEnv("MISSING_OPTIONAL_ENV", "fallback")).toBe("fallback");

    delete process.env.TEST_REQUIRED_ENV;
  });

  it("fails when a required env is missing", () => {
    expect(() => getRequiredEnv("MISSING_REQUIRED_ENV")).toThrow(
      "MISSING_REQUIRED_ENV is required",
    );
  });

  it("fails in production when the session secret is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.DATABASE_URL = "postgresql://example";
    process.env.ALLOWED_DOMAINS = "xolosarmy.xyz";
    process.env.ALLOWED_ORIGINS = "https://xolosarmy.xyz";
    process.env.TONALLI_REQUIRE_AUTH = "true";

    expect(() => validateProductionEnv()).toThrow(
      "TONALLI_AUTH_SESSION_SECRET is required",
    );
  });

  it("fails in production when dev bypass is true", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.DATABASE_URL = "postgresql://example";
    process.env.TONALLI_AUTH_SESSION_SECRET = "secret";
    process.env.ALLOWED_DOMAINS = "xolosarmy.xyz";
    process.env.ALLOWED_ORIGINS = "https://xolosarmy.xyz";
    process.env.TONALLI_AUTH_DEV_BYPASS = "true";
    process.env.TONALLI_REQUIRE_AUTH = "true";

    expect(() => validateProductionEnv()).toThrow(
      "TONALLI_AUTH_DEV_BYPASS must not be true in production",
    );
  });
});
