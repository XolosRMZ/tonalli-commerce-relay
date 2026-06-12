import type {
  TonalliAuthChallenge,
  TonalliAuthChallengeRecord,
} from "./types";

export interface TonalliNonceStore {
  create(challenge: TonalliAuthChallenge): Promise<void>;
  findByNonce(nonce: string): Promise<TonalliAuthChallengeRecord | null>;
  markUsed(nonce: string): Promise<void>;
  revoke(nonce: string): Promise<void>;
}

export interface NonceValidationResult {
  valid: boolean;
  reason?: string;
}
