export type TonalliAuthPurpose = "authentication";

export type TonalliAuthVersion = "TonalliAuth-v1";

export type TonalliNetwork = "eCash";

export interface TonalliAuthChallenge {
  domain: string;
  address: string;
  alias?: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  purpose: TonalliAuthPurpose;
  network: TonalliNetwork;
  version: TonalliAuthVersion;
}

export interface TonalliAuthVerificationResult {
  valid: boolean;
  address: string;
  alias?: string;
  reason?: string;
}

export type TonalliActionPurpose =
  | "order_create"
  | "order_accept"
  | "escrow_release"
  | "escrow_refund"
  | "escrow_dispute";

export interface TonalliAuthChallengeRecord extends TonalliAuthChallenge {
  usedAt?: string | null;
  revokedAt?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}
