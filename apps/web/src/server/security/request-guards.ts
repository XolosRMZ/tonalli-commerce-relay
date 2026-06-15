export type RequestGuardResult =
  | { valid: true; value?: string }
  | { valid: false; reason: string };

const DEV_ALLOWED_DOMAINS = [
  "localhost",
  "localhost:3000",
  "localhost:3001",
  "127.0.0.1",
  "127.0.0.1:3000",
  "127.0.0.1:3001",
];

const DEV_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

export function getAllowedDomains(): string[] {
  return mergeConfiguredValues(
    process.env.ALLOWED_DOMAINS,
    process.env.NODE_ENV === "production" ? [] : DEV_ALLOWED_DOMAINS,
  ).map(normalizeHost);
}

export function getAllowedOrigins(): string[] {
  return mergeConfiguredValues(
    process.env.ALLOWED_ORIGINS,
    process.env.NODE_ENV === "production" ? [] : DEV_ALLOWED_ORIGINS,
  ).map(normalizeOrigin);
}

export function getRequestHost(request: Request): string | null {
  const host = request.headers.get("host");

  if (host === null || host.trim().length === 0) {
    return null;
  }

  return normalizeHost(host);
}

export function validateHostHeader(
  request: Request,
): { valid: true; value: string } | { valid: false; reason: string } {
  const host = getRequestHost(request);

  if (host === null) {
    return { valid: false, reason: "Host header is required" };
  }

  if (!getAllowedDomains().includes(host)) {
    return { valid: false, reason: "Host header is not allowed" };
  }

  return { valid: true, value: host };
}

export function validateOriginHeader(request: Request): RequestGuardResult {
  const originHeader = request.headers.get("origin");

  if (originHeader === null || originHeader.trim().length === 0) {
    return { valid: true };
  }

  let origin: string;

  try {
    origin = normalizeOrigin(originHeader);
  } catch {
    return { valid: false, reason: "Origin header is invalid" };
  }

  if (!getAllowedOrigins().includes(origin)) {
    return { valid: false, reason: "Origin header is not allowed" };
  }

  return { valid: true, value: origin };
}

function mergeConfiguredValues(
  configured: string | undefined,
  defaults: string[],
): string[] {
  const values = configured === undefined ? [] : configured.split(",");

  return [...values, ...defaults]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase();
}

function normalizeOrigin(origin: string): string {
  return new URL(origin.trim()).origin.toLowerCase();
}
