import { describe, expect, it, vi } from "vitest";
import { createAuthChallenge } from "./challenge";
import { verifyAuthSignature } from "./verify";

const activeChallenge = createAuthChallenge({
  domain: "tonalli.local",
  address: "ecash:qptest",
  alias: "xolos",
  nonce: "nonce-1",
  now: new Date("2026-01-01T00:00:00.000Z"),
  expiresInMinutes: 10
});

describe("verifyAuthSignature", () => {
  it("fails when expectedDomain does not match", async () => {
    const result = await verifyAuthSignature({
      challenge: activeChallenge,
      signature: "signature",
      expectedDomain: "other.local",
      verifyMessage: () => true,
      now: new Date("2026-01-01T00:01:00.000Z")
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Domain mismatch");
  });

  it("fails when challenge expired", async () => {
    const result = await verifyAuthSignature({
      challenge: activeChallenge,
      signature: "signature",
      expectedDomain: "tonalli.local",
      verifyMessage: () => true,
      now: new Date("2026-01-01T00:10:00.000Z")
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Challenge expired");
  });

  it("fails when verifyMessage is missing", async () => {
    const result = await verifyAuthSignature({
      challenge: activeChallenge,
      signature: "signature",
      expectedDomain: "tonalli.local",
      now: new Date("2026-01-01T00:01:00.000Z")
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Missing verifyMessage implementation");
  });

  it("fails when verifyMessage returns false", async () => {
    const verifyMessage = vi.fn(() => false);
    const result = await verifyAuthSignature({
      challenge: activeChallenge,
      signature: "signature",
      expectedDomain: "tonalli.local",
      verifyMessage,
      now: new Date("2026-01-01T00:01:00.000Z")
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Invalid signature");
    expect(verifyMessage).toHaveBeenCalledOnce();
  });

  it("passes when verifyMessage returns true", async () => {
    const verifyMessage = vi.fn(() => true);
    const result = await verifyAuthSignature({
      challenge: activeChallenge,
      signature: "signature",
      expectedDomain: "tonalli.local",
      verifyMessage,
      now: new Date("2026-01-01T00:01:00.000Z")
    });

    expect(result).toEqual({
      valid: true,
      address: "ecash:qptest",
      alias: "xolos"
    });
    expect(verifyMessage).toHaveBeenCalledOnce();
  });
});
