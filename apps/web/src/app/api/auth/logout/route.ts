import { NextResponse } from "next/server";

import { clearTonalliSessionCookie } from "@/server/auth/session";

export async function POST() {
  const response = NextResponse.json({ authenticated: false });
  clearTonalliSessionCookie(response);

  return response;
}
