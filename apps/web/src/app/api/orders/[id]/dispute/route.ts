import type { CommerceOrderStatus } from "@xolosarmy/models";
import { NextResponse } from "next/server";

import { getDisputeStore } from "@/server/disputes/get-dispute-store";
import type { DisputeRecord } from "@/server/disputes/dispute-store";
import { getOrderStore } from "@/server/orders/get-order-store";

interface OrderDisputeRouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface OpenDisputeRequestBody {
  openedByUserId?: unknown;
  reason?: unknown;
  evidence?: unknown;
  openedAt?: unknown;
}

interface EvidenceRequestBody {
  type?: unknown;
  uri?: unknown;
  hash?: unknown;
}

type DisputeEvidenceType =
  | "receipt"
  | "tracking"
  | "delivery_confirmation"
  | "conversation"
  | "txid"
  | "other";

interface ValidDisputeEvidence {
  type: DisputeEvidenceType;
  uri?: string;
  hash?: string;
}

interface ValidOpenDisputeRequest {
  openedByUserId: string;
  reason: string;
  evidence: ValidDisputeEvidence[];
  openedAt: string;
}

type OpenDisputeRequestValidation =
  | { valid: true; request: ValidOpenDisputeRequest }
  | { valid: false; reason: string };

const DISPUTABLE_ORDER_STATUSES: CommerceOrderStatus[] = [
  "PURCHASED",
  "SHIPPED",
  "RELEASE_PENDING",
  "REFUND_PENDING",
];

export async function POST(request: Request, context: OrderDisputeRouteContext) {
  const { id } = await context.params;
  const orderStore = await getOrderStore();
  const order = await orderStore.findById(id);

  if (order === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!DISPUTABLE_ORDER_STATUSES.includes(order.status)) {
    return NextResponse.json(
      {
        error: "Order cannot be disputed",
        reason:
          "Order status must be PURCHASED, SHIPPED, RELEASE_PENDING, or REFUND_PENDING",
      },
      { status: 409 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    return invalidOpenDisputeRequestResponse(
      errorReason(error, "Request body must be valid JSON"),
    );
  }

  const validation = validateOpenDisputeRequest(body);

  if (!validation.valid) {
    return invalidOpenDisputeRequestResponse(validation.reason);
  }

  const disputeRequest = validation.request;

  if (
    disputeRequest.openedByUserId !== order.buyerUserId &&
    disputeRequest.openedByUserId !== order.intermediaryUserId
  ) {
    return NextResponse.json(
      {
        error: "Dispute opener is not allowed",
        reason: "openedByUserId must match order.buyerUserId or order.intermediaryUserId",
      },
      { status: 403 },
    );
  }

  let disputeRecord: DisputeRecord;

  try {
    const disputeStore = await getDisputeStore();

    // TODO: persist dispute evidence with EvidenceStore.
    // TODO: wrap dispute + order updates in DB transaction when Prisma stores are enabled.
    disputeRecord = await disputeStore.createDispute({
      orderId: order.id,
      status: "opened",
      openedByUserId: disputeRequest.openedByUserId,
      reason: disputeRequest.reason,
      openedAt: disputeRequest.openedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to persist dispute",
        reason: errorReason(error, "DisputeStore failed"),
      },
      { status: 500 },
    );
  }

  const updatedOrder = await orderStore.update(order.id, {
    status: "DISPUTED",
    disputeStatus: "opened",
    updatedAt: new Date().toISOString(),
  });

  if (updatedOrder === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    order: updatedOrder,
    dispute: {
      orderId: updatedOrder.id,
      status: "opened",
      openedByUserId: disputeRequest.openedByUserId,
      reason: disputeRequest.reason,
      evidence: disputeRequest.evidence,
      openedAt: disputeRequest.openedAt,
    },
    disputeRecord,
    warning: "Dispute evidence storage will be added later.",
  });
}

function validateOpenDisputeRequest(body: unknown): OpenDisputeRequestValidation {
  if (!isObjectRecord(body)) {
    return invalidOpenDisputeRequest("Request body must be a JSON object");
  }

  const requestBody = body as OpenDisputeRequestBody;
  const openedByUserId = validateRequiredString(
    requestBody.openedByUserId,
    "openedByUserId",
  );

  if (!openedByUserId.valid) {
    return invalidOpenDisputeRequest(openedByUserId.reason);
  }

  const reason = validateRequiredString(requestBody.reason, "reason");

  if (!reason.valid) {
    return invalidOpenDisputeRequest(reason.reason);
  }

  const evidence = validateOptionalEvidenceArray(requestBody.evidence);

  if (!evidence.valid) {
    return invalidOpenDisputeRequest(evidence.reason);
  }

  const openedAt = validateOptionalIsoString(requestBody.openedAt, "openedAt");

  if (!openedAt.valid) {
    return invalidOpenDisputeRequest(openedAt.reason);
  }

  return {
    valid: true,
    request: {
      openedByUserId: openedByUserId.value,
      reason: reason.value,
      evidence: evidence.value,
      openedAt: openedAt.value ?? new Date().toISOString(),
    },
  };
}

function validateOptionalEvidenceArray(
  value: unknown,
): { valid: true; value: ValidDisputeEvidence[] } | { valid: false; reason: string } {
  if (value === undefined) {
    return { valid: true, value: [] };
  }

  if (!Array.isArray(value)) {
    return { valid: false, reason: "evidence must be an array" };
  }

  const evidence: ValidDisputeEvidence[] = [];

  for (const [index, item] of value.entries()) {
    const itemValidation = validateEvidence(item, `evidence[${index}]`);

    if (!itemValidation.valid) {
      return { valid: false, reason: itemValidation.reason };
    }

    evidence.push(itemValidation.value);
  }

  return { valid: true, value: evidence };
}

function validateEvidence(
  value: unknown,
  fieldName: string,
): { valid: true; value: ValidDisputeEvidence } | { valid: false; reason: string } {
  if (!isObjectRecord(value)) {
    return { valid: false, reason: `${fieldName} must be a JSON object` };
  }

  const evidenceBody = value as EvidenceRequestBody;
  const type = validateEvidenceType(evidenceBody.type, `${fieldName}.type`);

  if (!type.valid) {
    return { valid: false, reason: type.reason };
  }

  const uri = validateOptionalString(evidenceBody.uri, `${fieldName}.uri`);

  if (!uri.valid) {
    return { valid: false, reason: uri.reason };
  }

  const hash = validateOptionalString(evidenceBody.hash, `${fieldName}.hash`);

  if (!hash.valid) {
    return { valid: false, reason: hash.reason };
  }

  return {
    valid: true,
    value: {
      type: type.value,
      uri: uri.value,
      hash: hash.value,
    },
  };
}

function validateEvidenceType(
  value: unknown,
  fieldName: string,
): { valid: true; value: DisputeEvidenceType } | { valid: false; reason: string } {
  if (
    value === "receipt" ||
    value === "tracking" ||
    value === "delivery_confirmation" ||
    value === "conversation" ||
    value === "txid" ||
    value === "other"
  ) {
    return { valid: true, value };
  }

  return {
    valid: false,
    reason:
      `${fieldName} must be one of "receipt", "tracking", ` +
      `"delivery_confirmation", "conversation", "txid", or "other"`,
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
  if (value === undefined) {
    return { valid: true, value: undefined };
  }

  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return { valid: false, reason: `${fieldName} must be an ISO date string` };
  }

  return { valid: true, value };
}

function invalidOpenDisputeRequest(reason: string): OpenDisputeRequestValidation {
  return { valid: false, reason };
}

function invalidOpenDisputeRequestResponse(reason: string) {
  return NextResponse.json(
    {
      error: "Invalid open dispute request",
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
