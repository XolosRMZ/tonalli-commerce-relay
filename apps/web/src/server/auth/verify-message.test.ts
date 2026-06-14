import { afterEach, describe, expect, it, vi } from "vitest";

import {
  devTonalliMessageVerifier,
  tonalliMessageVerifier,
} from "./verify-message";

describe("devTonalliMessageVerifier", () => {
  afterEach(() => {
    delete process.env.TONALLI_AUTH_DEV_BYPASS;
  });

  it("accepts the dev signature when TONALLI_AUTH_DEV_BYPASS is true", async () => {
    process.env.TONALLI_AUTH_DEV_BYPASS = "true";

    await expect(
      devTonalliMessageVerifier.verify({
        address: "ecash:qbuyerdev",
        message: "message",
        signature: "dev-valid-signature",
      }),
    ).resolves.toBe(true);
  });

  it("rejects the dev signature when TONALLI_AUTH_DEV_BYPASS is not active", async () => {
    await expect(
      devTonalliMessageVerifier.verify({
        address: "ecash:qbuyerdev",
        message: "message",
        signature: "dev-valid-signature",
      }),
    ).resolves.toBe(false);
  });

  it("rejects invalid signatures", async () => {
    process.env.TONALLI_AUTH_DEV_BYPASS = "true";

    await expect(
      devTonalliMessageVerifier.verify({
        address: "ecash:qbuyerdev",
        message: "message",
        signature: "invalid-signature",
      }),
    ).resolves.toBe(false);
  });
});

describe("tonalliMessageVerifier", () => {
  afterEach(() => {
    delete process.env.TONALLI_AUTH_DEV_BYPASS;
  });

  it("keeps the dev bypass working", async () => {
    process.env.TONALLI_AUTH_DEV_BYPASS = "true";

    await expect(
      tonalliMessageVerifier.verify({
        address: "ecash:qbuyerdev",
        message: "message",
        signature: "dev-valid-signature",
      }),
    ).resolves.toBe(true);
  });

  it("returns false instead of throwing for invalid real signatures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      tonalliMessageVerifier.verify({
        address: "ecash:qbuyerdev",
        message: "message",
        signature: "invalid-signature",
      }),
    ).resolves.toBe(false);

    consoleError.mockRestore();
  });
});
