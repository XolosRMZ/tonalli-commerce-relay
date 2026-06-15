import { NextResponse } from "next/server";

import { getAuthenticatedTonalliUser } from "@/server/auth/session";

export async function GET(request: Request) {
  const user = await getAuthenticatedTonalliUser(request);

  if (user === null) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    address: user.address,
    alias: user.alias,
  });
}
