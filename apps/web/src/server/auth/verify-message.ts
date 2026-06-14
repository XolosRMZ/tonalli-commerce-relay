import type { TonalliMessageVerifier } from "@xolosarmy/tonalli-auth";

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

export const tonalliMessageVerifier = devTonalliMessageVerifier;
