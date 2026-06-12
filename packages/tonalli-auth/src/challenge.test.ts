import { describe, expect, it } from "vitest";
import { createAuthChallenge, formatChallengeForSigning } from "./challenge";

describe("createAuthChallenge", () => {
  it("creates version TonalliAuth-v1, network eCash, purpose authentication", () => {
    const challenge = createAuthChallenge({
      domain: "tonalli.local",
      address: "ecash:qptest",
      nonce: "nonce-1",
      now: new Date("2026-01-01T00:00:00.000Z")
    });

    expect(challenge.version).toBe("TonalliAuth-v1");
    expect(challenge.network).toBe("eCash");
    expect(challenge.purpose).toBe("authentication");
  });

  it("throws when expiresInMinutes <= 0", () => {
    expect(() =>
      createAuthChallenge({
        domain: "tonalli.local",
        address: "ecash:qptest",
        nonce: "nonce-1",
        expiresInMinutes: 0
      })
    ).toThrow("expiresInMinutes must be positive");
  });
});

describe("formatChallengeForSigning", () => {
  it("includes Domain, Address, Nonce, Issued At, Expiration, Purpose, Network, Version", () => {
    const message = formatChallengeForSigning(
      createAuthChallenge({
        domain: "tonalli.local",
        address: "ecash:qptest",
        nonce: "nonce-1",
        now: new Date("2026-01-01T00:00:00.000Z")
      })
    );

    expect(message).toContain("Domain: tonalli.local");
    expect(message).toContain("Address: ecash:qptest");
    expect(message).toContain("Nonce: nonce-1");
    expect(message).toContain("Issued At: 2026-01-01T00:00:00.000Z");
    expect(message).toContain("Expiration: 2026-01-01T00:10:00.000Z");
    expect(message).toContain("Purpose: authentication");
    expect(message).toContain("Network: eCash");
    expect(message).toContain("Version: TonalliAuth-v1");
  });

  it("includes Alias when present", () => {
    const message = formatChallengeForSigning(
      createAuthChallenge({
        domain: "tonalli.local",
        address: "ecash:qptest",
        alias: "xolos",
        nonce: "nonce-1"
      })
    );

    expect(message).toContain("Alias: xolos");
  });

  it("does not include Alias when missing", () => {
    const message = formatChallengeForSigning(
      createAuthChallenge({
        domain: "tonalli.local",
        address: "ecash:qptest",
        nonce: "nonce-1"
      })
    );

    expect(message).not.toContain("Alias:");
  });
});
