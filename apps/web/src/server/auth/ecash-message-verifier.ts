import type { TonalliMessageVerifier } from "@xolosarmy/tonalli-auth";

export class EcashMessageVerifier implements TonalliMessageVerifier {
  async verify(input: {
    address: string;
    message: string;
    signature: string;
  }): Promise<boolean> {
    void input.address;
    void input.message;
    void input.signature;

    // TODO:
    // Integrar verificacion real cuando se confirme el formato de firma de Tonalli Wallet:
    // - message exacto
    // - signature encoding
    // - address format
    // - public key recovery o validacion contra address
    // - algoritmo ECDSA/Schnorr compatible con eCash
    return false;
  }
}
