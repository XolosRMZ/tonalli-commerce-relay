import { NextResponse } from "next/server";

import type { EvidenceRecord } from "@/server/evidence/evidence-store";
import { getEvidenceStore } from "@/server/evidence/get-evidence-store";
import { getOrderStore } from "@/server/orders/get-order-store";

interface OrderShipRouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface ShipOrderRequestBody {
  intermediaryUserId?: unknown;
  tracking?: unknown;
  shippedAt?: unknown;
}

interface TrackingRequestBody {
  carrier?: unknown;
  trackingNumber?: unknown;
  trackingUrl?: unknown;
  notes?: unknown;
}

interface ValidTrackingRequest {
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  notes?: string;
}

interface ValidShipOrderRequest {
  intermediaryUserId: string;
  tracking: ValidTrackingRequest;
  shippedAt: string;
}

interface SimulatedShippingEvidence {
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  notes?: string;
  submittedByUserId: string;
  submittedAt: string;
}

type ShipOrderRequestValidation =
  | { valid: true; request: ValidShipOrderRequest }
  | { valid: false; reason: string };

export async function POST(request: Request, context: OrderShipRouteContext) {
  const { id } = await context.params;
  const orderStore = await getOrderStore();
  const order = await orderStore.findById(id);

  if (order === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "PURCHASED") {
    return NextResponse.json(
      {
        error: "Order cannot be marked as shipped",
        reason: "Order status must be PURCHASED",
      },
      { status: 409 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    return invalidShipOrderRequestResponse(
      errorReason(error, "Request body must be valid JSON"),
    );
  }

  const validation = validateShipOrderRequest(body);

  if (!validation.valid) {
    return invalidShipOrderRequestResponse(validation.reason);
  }

  const shipRequest = validation.request;

  if (order.intermediaryUserId === undefined) {
    return NextResponse.json(
      {
        error: "Order cannot be marked as shipped",
        reason: "order.intermediaryUserId must exist",
      },
      { status: 409 },
    );
  }

  if (shipRequest.intermediaryUserId !== order.intermediaryUserId) {
    return NextResponse.json(
      {
        error: "Intermediary not allowed to ship order",
        reason: "intermediaryUserId must match order.intermediaryUserId",
      },
      { status: 403 },
    );
  }

  const shippingEvidence: SimulatedShippingEvidence = {
    carrier: shipRequest.tracking.carrier,
    trackingNumber: shipRequest.tracking.trackingNumber,
    trackingUrl: shipRequest.tracking.trackingUrl,
    notes: shipRequest.tracking.notes,
    submittedByUserId: shipRequest.intermediaryUserId,
    submittedAt: shipRequest.shippedAt,
  };

  let evidenceRecord: EvidenceRecord;

  try {
    const evidenceStore = await getEvidenceStore();
    evidenceRecord = await evidenceStore.create({
      orderId: order.id,
      type: "tracking",
      uri: shipRequest.tracking.trackingUrl,
      hash: undefined,
      notes: shipRequest.tracking.notes,
      externalReference: `${shipRequest.tracking.carrier}:${shipRequest.tracking.trackingNumber}`,
      submittedByUserId: shipRequest.intermediaryUserId,
      submittedAt: shipRequest.shippedAt,
    });
  } catch (error) {
    return failedEvidencePersistenceResponse(error);
  }

  // TODO: Wrap evidence + order update in a DB transaction when using Prisma.
  const updatedOrder = await orderStore.update(order.id, {
    status: "SHIPPED",
    updatedAt: new Date().toISOString(),
  });

  if (updatedOrder === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // TODO: Attach tracking to order history.
  // TODO: Hash sensitive shipping evidence before any on-chain anchoring.
  return NextResponse.json({
    order: updatedOrder,
    shippingEvidence,
    evidenceRecord,
    warning:
      "Shipping evidence is persisted separately from the order update. Transaction support will be added later.",
  });
}

function validateShipOrderRequest(body: unknown): ShipOrderRequestValidation {
  if (!isObjectRecord(body)) {
    return invalidShipOrderRequest("Request body must be a JSON object");
  }

  const requestBody = body as ShipOrderRequestBody;
  const intermediaryUserId = validateRequiredString(
    requestBody.intermediaryUserId,
    "intermediaryUserId",
  );

  if (!intermediaryUserId.valid) {
    return invalidShipOrderRequest(intermediaryUserId.reason);
  }

  const tracking = validateTracking(requestBody.tracking);

  if (!tracking.valid) {
    return invalidShipOrderRequest(tracking.reason);
  }

  const shippedAt = validateOptionalIsoString(requestBody.shippedAt, "shippedAt");

  if (!shippedAt.valid) {
    return invalidShipOrderRequest(shippedAt.reason);
  }

  return {
    valid: true,
    request: {
      intermediaryUserId: intermediaryUserId.value,
      tracking: tracking.value,
      shippedAt: shippedAt.value ?? new Date().toISOString(),
    },
  };
}

function validateTracking(
  value: unknown,
): { valid: true; value: ValidTrackingRequest } | { valid: false; reason: string } {
  if (!isObjectRecord(value)) {
    return { valid: false, reason: "tracking must be a JSON object" };
  }

  const trackingBody = value as TrackingRequestBody;
  const carrier = validateRequiredString(trackingBody.carrier, "tracking.carrier");

  if (!carrier.valid) {
    return { valid: false, reason: carrier.reason };
  }

  const trackingNumber = validateRequiredString(
    trackingBody.trackingNumber,
    "tracking.trackingNumber",
  );

  if (!trackingNumber.valid) {
    return { valid: false, reason: trackingNumber.reason };
  }

  const trackingUrl = validateOptionalString(
    trackingBody.trackingUrl,
    "tracking.trackingUrl",
  );

  if (!trackingUrl.valid) {
    return { valid: false, reason: trackingUrl.reason };
  }

  const notes = validateOptionalString(trackingBody.notes, "tracking.notes");

  if (!notes.valid) {
    return { valid: false, reason: notes.reason };
  }

  return {
    valid: true,
    value: {
      carrier: carrier.value,
      trackingNumber: trackingNumber.value,
      trackingUrl: trackingUrl.value,
      notes: notes.value,
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

function invalidShipOrderRequest(reason: string): ShipOrderRequestValidation {
  return { valid: false, reason };
}

function invalidShipOrderRequestResponse(reason: string) {
  return NextResponse.json(
    {
      error: "Invalid ship order request",
      reason,
    },
    { status: 400 },
  );
}

function failedEvidencePersistenceResponse(error: unknown) {
  return NextResponse.json(
    {
      error: "Failed to persist evidence",
      reason: errorReason(error, "Unknown evidence persistence failure"),
    },
    { status: 500 },
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
