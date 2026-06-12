import { verifyAuthSignature } from "@xolosarmy/tonalli-auth";
import { NextResponse } from "next/server";

import { nonceStore } from "@/server/auth/nonce-store";
import { verifyTonalliMessage } from "@/server/auth/verify-message";

interface VerifyRequestBody {
  nonce?: unknown;
  signature?: unknown;
}

export async function POST(request: Request) {
  const body = (await request.json()) as VerifyRequestBody;

  if (typeof body.nonce !== "string" || body.nonce.trim().length === 0) {
    return NextResponse.json(
      { valid: false, reason: "nonce is required" },
      { status: 400 },
    );
  }

  if (
    typeof body.signature !== "string" ||
    body.signature.trim().length === 0
  ) {
    return NextResponse.json(
      { valid: false, reason: "signature is required" },
      { status: 400 },
    );
  }

  const nonce = body.nonce.trim();
  const signature = body.signature.trim();
  const challenge = await nonceStore.findByNonce(nonce);

  if (challenge === null) {
    return NextResponse.json(
      { valid: false, reason: "Challenge not found" },
      { status: 400 },
    );
  }

  if (challenge.revokedAt !== null && challenge.revokedAt !== undefined) {
    return NextResponse.json(
      { valid: false, reason: "Challenge revoked" },
      { status: 400 },
    );
  }

  if (challenge.usedAt !== null && challenge.usedAt !== undefined) {
    return NextResponse.json(
      { valid: false, reason: "Challenge already used" },
      { status: 400 },
    );
  }

  const result = await verifyAuthSignature({
    challenge,
    signature,
    expectedDomain: challenge.domain,
    verifyMessage: verifyTonalliMessage,
  });

  if (!result.valid) {
    return NextResponse.json(result, { status: 401 });
  }

  await nonceStore.markUsed(nonce);

  return NextResponse.json({
    valid: true,
    address: result.address,
    alias: result.alias,
  });
}
