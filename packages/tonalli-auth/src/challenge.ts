import type { TonalliAuthChallenge } from "./types";

export interface CreateAuthChallengeParams {
  domain: string;
  address: string;
  nonce: string;
  alias?: string;
  expiresInMinutes?: number;
  now?: Date;
}

export function createAuthChallenge(
  params: CreateAuthChallengeParams,
): TonalliAuthChallenge {
  const expiresInMinutes = params.expiresInMinutes ?? 10;

  if (expiresInMinutes <= 0) {
    throw new Error("expiresInMinutes must be positive");
  }

  const issuedAtDate = params.now ?? new Date();
  const expirationDate = new Date(
    issuedAtDate.getTime() + expiresInMinutes * 60 * 1000,
  );

  return {
    domain: params.domain,
    address: params.address,
    alias: params.alias,
    nonce: params.nonce,
    issuedAt: issuedAtDate.toISOString(),
    expirationTime: expirationDate.toISOString(),
    purpose: "authentication",
    network: "eCash",
    version: "TonalliAuth-v1",
  };
}

export function formatChallengeForSigning(
  challenge: TonalliAuthChallenge,
): string {
  const aliasLine =
    challenge.alias === undefined ? [] : [`Alias: ${challenge.alias}`];

  return [
    "Sign in to Tonalli Commerce Relay",
    "",
    `Domain: ${challenge.domain}`,
    `Address: ${challenge.address}`,
    ...aliasLine,
    `Nonce: ${challenge.nonce}`,
    `Issued At: ${challenge.issuedAt}`,
    `Expiration: ${challenge.expirationTime}`,
    `Purpose: ${challenge.purpose}`,
    `Network: ${challenge.network}`,
    `Version: ${challenge.version}`,
  ].join("\n");
}
