import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getRequestHost,
  validateHostHeader,
  validateOriginHeader,
} from "./request-guards";

describe("request guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.ALLOWED_DOMAINS;
    delete process.env.ALLOWED_ORIGINS;
  });

  it("reads and normalizes the request host", () => {
    const request = new Request("http://localhost/api", {
      headers: { host: "LOCALHOST:3000" },
    });

    expect(getRequestHost(request)).toBe("localhost:3000");
  });

  it("allows a configured host", () => {
    process.env.ALLOWED_DOMAINS = "xolosarmy.xyz,www.xolosarmy.xyz";
    const request = new Request("https://xolosarmy.xyz/api", {
      headers: { host: "xolosarmy.xyz" },
    });

    expect(validateHostHeader(request)).toEqual({
      valid: true,
      value: "xolosarmy.xyz",
    });
  });

  it("rejects an unconfigured host", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.ALLOWED_DOMAINS = "xolosarmy.xyz";
    const request = new Request("https://evil.example/api", {
      headers: { host: "evil.example" },
    });

    expect(validateHostHeader(request)).toEqual({
      valid: false,
      reason: "Host header is not allowed",
    });
  });

  it("allows a configured origin", () => {
    process.env.ALLOWED_ORIGINS = "https://xolosarmy.xyz";
    const request = new Request("https://xolosarmy.xyz/api", {
      headers: { origin: "https://xolosarmy.xyz" },
    });

    expect(validateOriginHeader(request)).toEqual({
      valid: true,
      value: "https://xolosarmy.xyz",
    });
  });

  it("rejects an unconfigured origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.ALLOWED_ORIGINS = "https://xolosarmy.xyz";
    const request = new Request("https://xolosarmy.xyz/api", {
      headers: { origin: "https://evil.example" },
    });

    expect(validateOriginHeader(request)).toEqual({
      valid: false,
      reason: "Origin header is not allowed",
    });
  });

  it("allows localhost origins in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const request = new Request("http://localhost:3000/api", {
      headers: { origin: "http://localhost:3000" },
    });

    expect(validateOriginHeader(request)).toEqual({
      valid: true,
      value: "http://localhost:3000",
    });
  });
});
