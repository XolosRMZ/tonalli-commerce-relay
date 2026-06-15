import { NextResponse } from "next/server";

import { getOrderStore } from "@/server/orders/get-order-store";
import { validateOriginHeader } from "@/server/security/request-guards";

interface OrderReleaseRequestRouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface ReleaseRequestBody {
  intermediaryUserId?: unknown;
  message?: unknown;
  requestedAt?: unknown;
}

interface ValidReleaseRequest {
  intermediaryUserId: string;
  message?: string;
  requestedAt: string;
}

interface SimulatedReleaseRequest {
  requestedByUserId: string;
  message?: string;
  requestedAt: string;
}

type ReleaseRequestValidation =
  | { valid: true; request: ValidReleaseRequest }
  | { valid: false; reason: string };

export async function POST(
  request: Request,
  context: OrderReleaseRequestRouteContext,
) {
  const originValidation = validateOriginHeader(request);

  if (!originValidation.valid) {
    return NextResponse.json(
      { error: "Invalid origin", reason: originValidation.reason },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const orderStore = await getOrderStore();
  const order = await orderStore.findById(id);

  if (order === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "SHIPPED" && order.status !== "PURCHASED") {
    return NextResponse.json(
      {
        error: "Order cannot request escrow release",
        reason: "Order status must be SHIPPED or PURCHASED",
      },
      { status: 409 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    return invalidReleaseRequestResponse(
      errorReason(error, "Request body must be valid JSON"),
    );
  }

  const validation = validateReleaseRequest(body);

  if (!validation.valid) {
    return invalidReleaseRequestResponse(validation.reason);
  }

  const releaseRequest = validation.request;

  if (order.intermediaryUserId === undefined) {
    return NextResponse.json(
      {
        error: "Order cannot request escrow release",
        reason: "order.intermediaryUserId must exist",
      },
      { status: 409 },
    );
  }

  if (releaseRequest.intermediaryUserId !== order.intermediaryUserId) {
    return NextResponse.json(
      {
        error: "Intermediary not allowed to request escrow release",
        reason: "intermediaryUserId must match order.intermediaryUserId",
      },
      { status: 403 },
    );
  }

  const updatedOrder = await orderStore.update(order.id, {
    status: "RELEASE_PENDING",
    updatedAt: new Date().toISOString(),
  });

  if (updatedOrder === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const simulatedReleaseRequest: SimulatedReleaseRequest = {
    requestedByUserId: releaseRequest.intermediaryUserId,
    message: releaseRequest.message,
    requestedAt: releaseRequest.requestedAt,
  };

  return NextResponse.json({
    order: updatedOrder,
    releaseRequest: simulatedReleaseRequest,
    warning: "Release request only. No XEC was released.",
  });
}

function validateReleaseRequest(body: unknown): ReleaseRequestValidation {
  if (!isObjectRecord(body)) {
    return invalidReleaseRequest("Request body must be a JSON object");
  }

  const requestBody = body as ReleaseRequestBody;
  const intermediaryUserId = validateRequiredString(
    requestBody.intermediaryUserId,
    "intermediaryUserId",
  );

  if (!intermediaryUserId.valid) {
    return invalidReleaseRequest(intermediaryUserId.reason);
  }

  const message = validateOptionalString(requestBody.message, "message");

  if (!message.valid) {
    return invalidReleaseRequest(message.reason);
  }

  const requestedAt = validateOptionalIsoString(requestBody.requestedAt, "requestedAt");

  if (!requestedAt.valid) {
    return invalidReleaseRequest(requestedAt.reason);
  }

  return {
    valid: true,
    request: {
      intermediaryUserId: intermediaryUserId.value,
      message: message.value,
      requestedAt: requestedAt.value ?? new Date().toISOString(),
    },
  };
}

function validateRequiredString(
  value: unknown,
  fieldName: string,
): { valid: true; value: string } | { valid: false; reason: string } {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { valid: false, reason: `${fieldName} must be a non-empty string` };
  }

  return { valid: true, value: value.trim() };
}

function validateOptionalString(
  value: unknown,
  fieldName: string,
): { valid: true; value: string | undefined } | { valid: false; reason: string } {
  if (value === undefined) {
    return { valid: true, value: undefined };
  }

  if (typeof value !== "string") {
    return { valid: false, reason: `${fieldName} must be a string` };
  }

  const trimmed = value.trim();

  return { valid: true, value: trimmed.length === 0 ? undefined : trimmed };
}

function validateOptionalIsoString(
  value: unknown,
  fieldName: string,
): { valid: true; value: string | undefined } | { valid: false; reason: string } {
  const stringValue = validateOptionalString(value, fieldName);

  if (!stringValue.valid || stringValue.value === undefined) {
    return stringValue;
  }

  const parsedTime = Date.parse(stringValue.value);

  if (Number.isNaN(parsedTime)) {
    return { valid: false, reason: `${fieldName} must be an ISO date string` };
  }

  return { valid: true, value: new Date(parsedTime).toISOString() };
}

function invalidReleaseRequest(reason: string): ReleaseRequestValidation {
  return { valid: false, reason };
}

function invalidReleaseRequestResponse(reason: string) {
  return NextResponse.json(
    {
      error: "Invalid release request",
      reason,
    },
    { status: 400 },
  );
}

function errorReason(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
