import { NextResponse } from "next/server";

export interface ApiErrorContext {
  route: string;
  orderId?: string;
  user?: string;
}

export function internalErrorResponse(
  error: unknown,
  context: ApiErrorContext,
): NextResponse {
  console.error("Tonalli API error", {
    route: context.route,
    orderId: context.orderId,
    user: context.user,
    message: safeErrorMessage(error),
  });

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      error: "Internal server error",
      reason: safeErrorMessage(error),
    },
    { status: 500 },
  );
}

export function badRequestResponse(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Unknown error";
}
