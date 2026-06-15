import { afterEach, describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /api/healthz", () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("returns ok and skips db when DATABASE_URL is missing", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      service: "tonalli-commerce-relay",
      db: "skipped",
    });
    expect(typeof body.timestamp).toBe("string");
  });
});
