import {
  createAuthChallenge,
  formatChallengeForSigning,
} from "@xolosarmy/tonalli-auth";
import { NextResponse } from "next/server";

import { nonceStore } from "@/server/auth/nonce-store";

interface ChallengeRequestBody {
  address?: unknown;
  alias?: unknown;
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChallengeRequestBody;

  if (typeof body.address !== "string" || body.address.trim().length === 0) {
    return NextResponse.json(
      { error: "address is required" },
      { status: 400 },
    );
  }

  if (body.alias !== undefined && typeof body.alias !== "string") {
    return NextResponse.json(
      { error: "alias must be a string" },
      { status: 400 },
    );
  }

  const address = body.address.trim();
  const alias = body.alias?.trim();
  const domain = request.headers.get("host") ?? "localhost";
  const nonce = crypto.randomUUID();
  const challenge = createAuthChallenge({
    domain,
    address,
    nonce,
    alias: alias === "" ? undefined : alias,
    expiresInMinutes: 10,
  });

  await nonceStore.create(challenge);

  return NextResponse.json({
    challenge,
    message: formatChallengeForSigning(challenge),
  });
}
