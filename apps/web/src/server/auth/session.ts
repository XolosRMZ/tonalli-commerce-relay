import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { NextResponse } from "next/server";

export interface AuthenticatedTonalliUser {
  address: string;
  alias?: string;
  network: "eCash";
  version: "TonalliAuth-v1";
  issuedAt: string;
}

interface TonalliSessionJwtPayload extends JWTPayload {
  address: string;
  alias?: string;
  network: "eCash";
  version: "TonalliAuth-v1";
  issuedAt: string;
}

export const TONALLI_SESSION_COOKIE_NAME = "tonalli_session";

const DEFAULT_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;
const DEV_SESSION_SECRET = "tonalli-auth-dev-session-secret";

export async function createTonalliSessionToken(
  user: Omit<AuthenticatedTonalliUser, "network" | "version" | "issuedAt"> & {
    issuedAt?: string;
  },
): Promise<string> {
  const issuedAt = user.issuedAt ?? new Date().toISOString();
  const maxAgeSeconds = getSessionMaxAgeSeconds();

  return new SignJWT({
    address: user.address,
    alias: user.alias,
    network: "eCash",
    version: "TonalliAuth-v1",
    issuedAt,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(Math.floor(Date.parse(issuedAt) / 1000))
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(getSessionSecret());
}

export async function verifyTonalliSessionToken(
  token: string,
): Promise<AuthenticatedTonalliUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
    });

    if (!isTonalliSessionPayload(payload)) {
      return null;
    }

    return {
      address: payload.address,
      alias: payload.alias,
      network: payload.network,
      version: payload.version,
      issuedAt: payload.issuedAt,
    };
  } catch {
    return null;
  }
}

export async function setTonalliSessionCookie(
  response: NextResponse,
  user: Omit<AuthenticatedTonalliUser, "network" | "version" | "issuedAt"> & {
    issuedAt?: string;
  },
): Promise<void> {
  const token = await createTonalliSessionToken(user);

  response.cookies.set(TONALLI_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionMaxAgeSeconds(),
  });
}

export function clearTonalliSessionCookie(response: NextResponse): void {
  response.cookies.set(TONALLI_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getAuthenticatedTonalliUser(
  request: Request,
): Promise<AuthenticatedTonalliUser | null> {
  const token = getCookieValue(request, TONALLI_SESSION_COOKIE_NAME);

  if (token === undefined) {
    return null;
  }

  return verifyTonalliSessionToken(token);
}

function getSessionSecret(): Uint8Array {
  const secret = process.env.TONALLI_AUTH_SESSION_SECRET;

  if (secret !== undefined && secret.length > 0) {
    return new TextEncoder().encode(secret);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "TONALLI_AUTH_SESSION_SECRET is required when NODE_ENV=production",
    );
  }

  return new TextEncoder().encode(DEV_SESSION_SECRET);
}

function getSessionMaxAgeSeconds(): number {
  const configured = process.env.TONALLI_AUTH_SESSION_MAX_AGE_SECONDS;

  if (configured === undefined || configured.trim().length === 0) {
    return DEFAULT_SESSION_MAX_AGE_SECONDS;
  }

  const parsed = Number(configured);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      "TONALLI_AUTH_SESSION_MAX_AGE_SECONDS must be a positive integer",
    );
  }

  return parsed;
}

function getCookieValue(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie");

  if (cookieHeader === null) {
    return undefined;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = cookie.trim().split("=");

    if (rawName === name) {
      return rawValueParts.join("=");
    }
  }

  return undefined;
}

function isTonalliSessionPayload(
  payload: JWTPayload,
): payload is TonalliSessionJwtPayload {
  return (
    typeof payload.address === "string" &&
    payload.address.trim().length > 0 &&
    (payload.alias === undefined || typeof payload.alias === "string") &&
    payload.network === "eCash" &&
    payload.version === "TonalliAuth-v1" &&
    typeof payload.issuedAt === "string" &&
    !Number.isNaN(Date.parse(payload.issuedAt))
  );
}
