if (process.env.NODE_ENV === "production") {
  const requiredEnv = [
    "DATABASE_URL",
    "TONALLI_AUTH_SESSION_SECRET",
    "ALLOWED_DOMAINS",
    "ALLOWED_ORIGINS",
  ];

  for (const name of requiredEnv) {
    if (!process.env[name]) {
      throw new Error(` is required`);
    }
  }

  if (process.env.TONALLI_AUTH_DEV_BYPASS === "true") {
    throw new Error("TONALLI_AUTH_DEV_BYPASS must not be true in production");
  }

  if (process.env.TONALLI_REQUIRE_AUTH !== "true") {
    throw new Error("TONALLI_REQUIRE_AUTH must be true in production");
  }
}

const nextConfig = {};

export default nextConfig;
