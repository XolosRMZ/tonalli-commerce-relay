import { afterEach, describe, expect, it, vi } from "vitest";

import { internalErrorResponse, safeErrorMessage } from "./api-errors";

describe("api-errors", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns safe messages for unknown errors", () => {
    expect(safeErrorMessage(new Error("database failed"))).toBe("database failed");
    expect(safeErrorMessage("plain failure")).toBe("plain failure");
    expect(safeErrorMessage(null)).toBe("Unknown error");
  });

  it("does not expose internal reasons in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = internalErrorResponse(new Error("Prisma exploded"), {
      route: "/api/orders",
      orderId: "order-1",
      user: "ecash:qbuyer",
    });

    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    });
    expect(response.status).toBe(500);

    consoleError.mockRestore();
  });

  it("can expose a safe reason in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = internalErrorResponse(new Error("store failed"), {
      route: "/api/orders",
    });

    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
      reason: "store failed",
    });

    consoleError.mockRestore();
  });
});
