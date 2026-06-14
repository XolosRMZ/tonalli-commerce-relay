import { verifyMsg } from "ecash-lib";
import type { TonalliMessageVerifier } from "@xolosarmy/tonalli-auth";

type EcashVerifyMessageAdapter = (
  message: string,
  signature: string,
  address: string,
) => boolean;

export class EcashMessageVerifier implements TonalliMessageVerifier {
  constructor(
    private readonly verifyMessage: EcashVerifyMessageAdapter = verifyMsg,
  ) {}

  async verify(input: {
    address: string;
    message: string;
    signature: string;
  }): Promise<boolean> {
    try {
      return this.verifyMessage(input.message, input.signature, input.address);
    } catch {
      return false;
    }
  }
}
