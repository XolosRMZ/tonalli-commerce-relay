import { describe, expect, it } from "vitest";

import { MockTonalliWalletConnector } from "./wallet-adapter";

describe("MockTonalliWalletConnector", () => {
  it("returns the dev bypass signature for an ecash address and message", async () => {
    const connector = new MockTonalliWalletConnector();

    await expect(
      connector.signMessage({
        address: "ecash:qzdq0q65fwnt94rlcph5kllj0xcry6e0v58zrgp7a3",
        message: "Sign in to Tonalli Commerce Relay",
      }),
    ).resolves.toBe("dev-valid-signature");
  });

  it("rejects non-ecash addresses", async () => {
    const connector = new MockTonalliWalletConnector();

    await expect(
      connector.signMessage({
        address: "bitcoincash:qzdq0q65fwnt94rlcph5kllj0xcry6e0v58zrgp7a3",
        message: "Sign in to Tonalli Commerce Relay",
      }),
    ).rejects.toThrow("Mock connector requires an ecash: address");
  });

  it("rejects empty messages", async () => {
    const connector = new MockTonalliWalletConnector();

    await expect(
      connector.signMessage({
        address: "ecash:qzdq0q65fwnt94rlcph5kllj0xcry6e0v58zrgp7a3",
        message: " ",
      }),
    ).rejects.toThrow("Mock connector requires a non-empty message");
  });
});
