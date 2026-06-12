import { NextResponse } from "next/server";

import { orderStore } from "@/server/orders/order-store";

interface OrderRefundRequestRouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface RefundRequestBody {
  requestedByUserId?: unknown;
  reason?: unknown;
  requestedAt?: unknown;
}

interface ValidRefundRequest {
  requestedByUserId: string;
  reason?: string;
  requestedAt: string;
}

type RefundRequestValidation =
  | { valid: true; request: ValidRefundRequest }
  | { valid: false; reason: string };

export async function POST(
  request: Request,
  context: OrderRefundRequestRouteContext,
) {
  const { id } = await context.params;
  const order = await orderStore.findById(id);

  if (order === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "FUNDED" && order.status !== "ACCEPTED") {
    return NextResponse.json(
      {
        error: "Order cannot request refund",
        reason: "Order status must be FUNDED or ACCEPTED",
      },
      { status: 409 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    return invalidRefundRequestResponse(
      errorReason(error, "Request body must be valid JSON"),
    );
  }

  const validation = validateRefundRequest(body);

  if (!validation.valid) {
    return invalidRefundRequestResponse(validation.reason);
  }

  const refundRequest = validation.request;

  if (!isOrderParticipant(refundRequest.requestedByUserId, order)) {
    return NextResponse.json(
      {
        error: "User not allowed to request refund",
        reason: "requestedByUserId must match order.buyerUserId or order.intermediaryUserId",
      },
      { status: 403 },
    );
  }

  const updatedOrder = await orderStore.update(order.id, {
    status: "REFUND_PENDING",
    updatedAt: new Date().toISOString(),
  });

  if (updatedOrder === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    order: updatedOrder,
    refundRequest,
    warning: "Refund request only. No XEC was refunded.",
  });
}

function validateRefundRequest(body: unknown): RefundRequestValidation {
  if (!isObjectRecord(body)) {
    return invalidRefundRequest("Request body must be a JSON object");
  }

  const requestBody = body as RefundRequestBody;
  const requestedByUserId = validateRequiredString(
    requestBody.requestedByUserId,
    "requestedByUserId",
  );

  if (!requestedByUserId.valid) {
    return invalidRefundRequest(requestedByUserId.reason);
  }

  const reason = validateOptionalString(requestBody.reason, "reason");

  if (!reason.valid) {
    return invalidRefundRequest(reason.reason);
  }

  const requestedAt = validateOptionalIsoString(
    requestBody.requestedAt,
    "requestedAt",
  );

  if (!requestedAt.valid) {
    return invalidRefundRequest(requestedAt.reason);
  }

  return {
    valid: true,
    request: {
      requestedByUserId: requestedByUserId.value,
      reason: reason.value,
      requestedAt: requestedAt.value ?? new Date().toISOString(),
    },
  };
}

function isOrderParticipant(
  userId: string,
  order: { buyerUserId: string; intermediaryUserId?: string },
): boolean {
  return userId === order.buyerUserId || userId === order.intermediaryUserId;
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

function invalidRefundRequest(reason: string): RefundRequestValidation {
  return { valid: false, reason };
}

function invalidRefundRequestResponse(reason: string) {
  return NextResponse.json(
    {
      error: "Invalid refund request",
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
