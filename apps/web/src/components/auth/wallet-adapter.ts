export interface TonalliWalletConnector {
  signMessage(input: { address: string; message: string }): Promise<string>;
}

export class MockTonalliWalletConnector implements TonalliWalletConnector {
  async signMessage(input: {
    address: string;
    message: string;
  }): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 250));

    if (!input.address.startsWith("ecash:")) {
      throw new Error("Mock connector requires an ecash: address");
    }

    if (input.message.trim().length === 0) {
      throw new Error("Mock connector requires a non-empty message");
    }

    // TODO: Implement with real WalletConnect using namespace "ecash:1" and RPC method "ecash_signMessage".
    return "dev-valid-signature";
  }
}
