import { NextResponse } from "next/server";

type HealthDbStatus = "ok" | "skipped" | "error";

export async function GET() {
  const db = await checkDatabase();

  return NextResponse.json({
    ok: db !== "error",
    service: "tonalli-commerce-relay",
    db,
    timestamp: new Date().toISOString(),
  });
}

async function checkDatabase(): Promise<HealthDbStatus> {
  if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === "") {
    return "skipped";
  }

  try {
    const { prisma } = await import("@xolosarmy/db");
    await prisma.$queryRaw`SELECT 1`;

    return "ok";
  } catch {
    return "error";
  }
}
