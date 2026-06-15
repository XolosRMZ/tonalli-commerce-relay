import { NextResponse } from "next/server";

import {
  getAuthenticatedTonalliUser,
  type AuthenticatedTonalliUser,
} from "./session";

export async function requireTonalliUser(
  request: Request,
): Promise<AuthenticatedTonalliUser | null> {
  return getAuthenticatedTonalliUser(request);
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

export function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function assertSameUser(
  sessionUser: AuthenticatedTonalliUser,
  expectedUserId: string,
): boolean {
  return getSessionUserId(sessionUser) === expectedUserId;
}

export function getSessionUserId(
  sessionUser: AuthenticatedTonalliUser,
): string {
  return sessionUser.address;
}

export function isProductionAuthRequired(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.TONALLI_REQUIRE_AUTH === "true"
  );
}

export function getAuthorizedArbitratorUserIds(): string[] {
  return getConfiguredUserIds(process.env.TONALLI_ARBITRATOR_USER_IDS);
}

export function getAuthorizedModeratorUserIds(): string[] {
  return getConfiguredUserIds(process.env.TONALLI_MODERATOR_USER_IDS);
}

function getConfiguredUserIds(value: string | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  return value
    .split(",")
    .map((userId) => userId.trim())
    .filter((userId) => userId.length > 0);
}
