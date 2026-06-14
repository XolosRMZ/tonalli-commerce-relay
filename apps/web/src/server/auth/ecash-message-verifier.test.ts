import { describe, expect, it, vi } from "vitest";

import { EcashMessageVerifier } from "./ecash-message-verifier";

describe("EcashMessageVerifier", () => {
  const input = {
    address: "ecash:qbuyerdev",
    message: "Sign in to Tonalli Commerce Relay",
    signature: "invalid-signature",
  };

  it("returns false for an invalid signature", async () => {
    const verifier = new EcashMessageVerifier(() => false);

    await expect(verifier.verify(input)).resolves.toBe(false);
  });

  it("returns false when the ecash library throws", async () => {
    const verifier = new EcashMessageVerifier(() => {
      throw new Error("ecash-lib failure");
    });

    await expect(verifier.verify(input)).resolves.toBe(false);
  });

  it("passes address, message, and signature to the ecash adapter", async () => {
    const verifyMessage = vi.fn(() => true);
    const verifier = new EcashMessageVerifier(verifyMessage);

    await expect(verifier.verify(input)).resolves.toBe(true);

    expect(verifyMessage).toHaveBeenCalledOnce();
    expect(verifyMessage).toHaveBeenCalledWith(
      input.message,
      input.signature,
      input.address,
    );
  });
});
