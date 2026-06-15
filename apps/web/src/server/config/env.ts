export function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export function getOptionalEnv(name: string, defaultValue: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim().length === 0) {
    return defaultValue;
  }

  return value;
}

export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  getRequiredEnv("DATABASE_URL");
  getRequiredEnv("TONALLI_AUTH_SESSION_SECRET");
  getRequiredEnv("ALLOWED_DOMAINS");
  getRequiredEnv("ALLOWED_ORIGINS");

  if (process.env.TONALLI_AUTH_DEV_BYPASS === "true") {
    throw new Error("TONALLI_AUTH_DEV_BYPASS must not be true in production");
  }

  if (process.env.TONALLI_REQUIRE_AUTH !== "true") {
    throw new Error("TONALLI_REQUIRE_AUTH must be true in production");
  }
}
