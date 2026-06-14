import { describe, expect, it, vi } from "vitest";
import { createAuthChallenge, formatChallengeForSigning } from "./challenge";
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
      verifier: { verify: () => true },
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
      verifier: { verify: () => true },
      now: new Date("2026-01-01T00:10:00.000Z")
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Challenge expired");
  });

  it("fails when verifier is missing", async () => {
    const result = await verifyAuthSignature({
      challenge: activeChallenge,
      signature: "signature",
      expectedDomain: "tonalli.local",
      now: new Date("2026-01-01T00:01:00.000Z")
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Missing TonalliMessageVerifier implementation");
  });

  it("fails when verifier returns false", async () => {
    const verify = vi.fn(() => false);
    const result = await verifyAuthSignature({
      challenge: activeChallenge,
      signature: "signature",
      expectedDomain: "tonalli.local",
      verifier: { verify },
      now: new Date("2026-01-01T00:01:00.000Z")
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Invalid signature");
    expect(verify).toHaveBeenCalledOnce();
  });

  it("passes when verifier returns true", async () => {
    const verify = vi.fn(() => true);
    const result = await verifyAuthSignature({
      challenge: activeChallenge,
      signature: "signature",
      expectedDomain: "tonalli.local",
      verifier: { verify },
      now: new Date("2026-01-01T00:01:00.000Z")
    });

    expect(result).toEqual({
      valid: true,
      address: "ecash:qptest",
      alias: "xolos"
    });
    expect(verify).toHaveBeenCalledOnce();
  });

  it("passes the exact formatted challenge message to the verifier", async () => {
    const verify = vi.fn(() => true);
    await verifyAuthSignature({
      challenge: activeChallenge,
      signature: "signature",
      expectedDomain: "tonalli.local",
      verifier: { verify },
      now: new Date("2026-01-01T00:01:00.000Z")
    });

    expect(verify).toHaveBeenCalledWith({
      address: activeChallenge.address,
      message: formatChallengeForSigning(activeChallenge),
      signature: "signature"
    });
  });
});
