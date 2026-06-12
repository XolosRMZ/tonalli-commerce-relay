import { formatChallengeForSigning } from "./challenge";
import type {
  TonalliAuthChallenge,
  TonalliAuthVerificationResult,
} from "./types";

export interface VerifyAuthSignatureParams {
  challenge: TonalliAuthChallenge;
  signature: string;
  expectedDomain: string;
  verifyMessage?: (
    message: string,
    signature: string,
    address: string,
  ) => Promise<boolean> | boolean;
  now?: Date;
}

export async function verifyAuthSignature(
  params: VerifyAuthSignatureParams,
): Promise<TonalliAuthVerificationResult> {
  const { challenge } = params;

  if (challenge.domain !== params.expectedDomain) {
    return invalid(challenge, "Domain mismatch");
  }

  if (challenge.version !== "TonalliAuth-v1") {
    return invalid(challenge, "Unsupported TonalliAuth version");
  }

  if (challenge.network !== "eCash") {
    return invalid(challenge, "Unsupported network");
  }

  if (challenge.purpose !== "authentication") {
    return invalid(challenge, "Unsupported purpose");
  }

  const now = params.now ?? new Date();
  const expirationTime = Date.parse(challenge.expirationTime);

  if (Number.isNaN(expirationTime)) {
    return invalid(challenge, "Invalid expirationTime");
  }

  if (expirationTime <= now.getTime()) {
    return invalid(challenge, "Challenge expired");
  }

  const message = formatChallengeForSigning(challenge);

  if (params.verifyMessage === undefined) {
    return invalid(challenge, "Missing verifyMessage implementation");
  }

  // TODO: wire this adapter to tonalli-core once Tonalli Wallet signing is ready.
  const signatureIsValid = await params.verifyMessage(
    message,
    params.signature,
    challenge.address,
  );

  if (!signatureIsValid) {
    return invalid(challenge, "Invalid signature");
  }

  return {
    valid: true,
    address: challenge.address,
    alias: challenge.alias,
  };
}

function invalid(
  challenge: TonalliAuthChallenge,
  reason: string,
): TonalliAuthVerificationResult {
  return {
    valid: false,
    address: challenge.address,
    alias: challenge.alias,
    reason,
  };
}
