import type { TonalliMessageVerifier } from "@xolosarmy/tonalli-auth";

let ecashMessageVerifier: TonalliMessageVerifier | undefined;

export const devTonalliMessageVerifier: TonalliMessageVerifier = {
  async verify(input) {
    void input.address;
    void input.message;

    if (
      process.env.TONALLI_AUTH_DEV_BYPASS === "true" &&
      input.signature === "dev-valid-signature"
    ) {
      return true;
    }

    return false;
  },
};

export const tonalliMessageVerifier: TonalliMessageVerifier = {
  async verify(input) {
    if (await devTonalliMessageVerifier.verify(input)) {
      return true;
    }

    if (ecashMessageVerifier === undefined) {
      const { EcashMessageVerifier } = await import("./ecash-message-verifier");
      ecashMessageVerifier = new EcashMessageVerifier();
    }

    return ecashMessageVerifier.verify(input);
  },
};
