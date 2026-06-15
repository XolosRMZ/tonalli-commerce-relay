import { NextResponse } from "next/server";

import type { EvidenceRecord } from "@/server/evidence/evidence-store";
import { getEvidenceStore } from "@/server/evidence/get-evidence-store";
import {
  assertSameUser,
  forbiddenResponse,
  getAuthorizedArbitratorUserIds,
  getAuthorizedModeratorUserIds,
  getSessionUserId,
  isProductionAuthRequired,
  requireTonalliUser,
  unauthorizedResponse,
} from "@/server/auth/require-auth";
import { getOrderStore } from "@/server/orders/get-order-store";
import { validateOriginHeader } from "@/server/security/request-guards";
import { internalErrorResponse } from "@/server/security/api-errors";
import { rateLimitExceededResponse, rateLimitRequest } from "@/server/security/rate-limit";

interface OrderPurchaseRouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface PurchaseOrderRequestBody {
  intermediaryUserId?: unknown;
  evidence?: unknown;
  externalOrderId?: unknown;
  purchasedAt?: unknown;
}

interface EvidenceRequestBody {
  type?: unknown;
  uri?: unknown;
  hash?: unknown;
  notes?: unknown;
}

type PurchaseEvidenceType =
  | "receipt"
  | "tracking"
  | "delivery_confirmation"
  | "conversation"
  | "txid"
  | "other";

interface ValidPurchaseEvidenceRequest {
  type: PurchaseEvidenceType;
  uri?: string;
  hash?: string;
  notes?: string;
}

interface ValidPurchaseOrderRequest {
  intermediaryUserId: string;
  evidence: ValidPurchaseEvidenceRequest;
  externalOrderId?: string;
  purchasedAt: string;
}

interface SimulatedPurchaseEvidence {
  type: PurchaseEvidenceType;
  uri?: string;
  hash?: string;
  notes?: string;
  externalOrderId?: string;
  submittedByUserId: string;
  submittedAt: string;
}

type PurchaseOrderRequestValidation =
  | { valid: true; request: ValidPurchaseOrderRequest }
  | { valid: false; reason: string };

export async function POST(request: Request, context: OrderPurchaseRouteContext) {
  const originValidation = validateOriginHeader(request);

  if (!originValidation.valid) {
    return NextResponse.json(
      { error: "Invalid origin", reason: originValidation.reason },
      { status: 403 },
    );
  }

  const authRequired = isProductionAuthRequired();
  const sessionUser = await requireTonalliUser(request);

  if (authRequired && sessionUser === null) {
    return unauthorizedResponse();
  }

  const rateLimit = await rateLimitRequest({
    request,
    route: "/api/orders/:id/purchase",
    limit: 60,
    windowMs: 60_000,
    identity: sessionUser === null ? undefined : getSessionUserId(sessionUser),
  });

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit);
  }

  const { id } = await context.params;
  const orderStore = await getOrderStore();
  const order = await orderStore.findById(id);

  if (order === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "ACCEPTED") {
    return NextResponse.json(
      {
        error: "Order cannot be marked as purchased",
        reason: "Order status must be ACCEPTED",
      },
      { status: 409 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    return invalidPurchaseOrderRequestResponse(
      errorReason(error, "Request body must be valid JSON"),
    );
  }

  const validation = validatePurchaseOrderRequest(body);

  if (!validation.valid) {
    return invalidPurchaseOrderRequestResponse(validation.reason);
  }

  const purchaseRequest = validation.request;

  if (authRequired && sessionUser !== null) {
    if (
      order.intermediaryUserId === undefined ||
      !assertSameUser(sessionUser, order.intermediaryUserId) ||
      !assertSameUser(sessionUser, purchaseRequest.intermediaryUserId)
    ) {
      return forbiddenResponse();
    }
  }

  if (order.intermediaryUserId === undefined) {
    return NextResponse.json(
      {
        error: "Order cannot be marked as purchased",
        reason: "order.intermediaryUserId must exist",
      },
      { status: 409 },
    );
  }

  if (purchaseRequest.intermediaryUserId !== order.intermediaryUserId) {
    return NextResponse.json(
      {
        error: "Intermediary not allowed to purchase order",
        reason: "intermediaryUserId must match order.intermediaryUserId",
      },
      { status: 403 },
    );
  }

  const purchaseEvidence: SimulatedPurchaseEvidence = {
    type: purchaseRequest.evidence.type,
    uri: purchaseRequest.evidence.uri,
    hash: purchaseRequest.evidence.hash,
    notes: purchaseRequest.evidence.notes,
    externalOrderId: purchaseRequest.externalOrderId,
    submittedByUserId: purchaseRequest.intermediaryUserId,
    submittedAt: purchaseRequest.purchasedAt,
  };

  let evidenceRecord: EvidenceRecord;

  try {
    const evidenceStore = await getEvidenceStore();
    evidenceRecord = await evidenceStore.create({
      orderId: order.id,
      type: purchaseRequest.evidence.type,
      uri: purchaseRequest.evidence.uri,
      hash: purchaseRequest.evidence.hash,
      notes: purchaseRequest.evidence.notes,
      externalReference: purchaseRequest.externalOrderId,
      submittedByUserId: purchaseRequest.intermediaryUserId,
      submittedAt: purchaseRequest.purchasedAt,
    });
  } catch (error) {
    return failedEvidencePersistenceResponse(error, order.id, purchaseRequest.intermediaryUserId);
  }

  // TODO: Wrap evidence + order update in a DB transaction when using Prisma.
  const updatedOrder = await orderStore.update(order.id, {
    status: "PURCHASED",
    updatedAt: new Date().toISOString(),
  });

  if (updatedOrder === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // TODO: Store files/hashes securely.
  // TODO: Attach evidence to dispute/order history.
  return NextResponse.json({
    order: updatedOrder,
    purchaseEvidence,
    evidenceRecord,
    warning:
      "Evidence is persisted separately from the order update. Transaction support will be added later.",
  });
}

function validatePurchaseOrderRequest(body: unknown): PurchaseOrderRequestValidation {
  if (!isObjectRecord(body)) {
    return invalidPurchaseOrderRequest("Request body must be a JSON object");
  }

  const requestBody = body as PurchaseOrderRequestBody;
  const intermediaryUserId = validateRequiredString(
    requestBody.intermediaryUserId,
    "intermediaryUserId",
  );

  if (!intermediaryUserId.valid) {
    return invalidPurchaseOrderRequest(intermediaryUserId.reason);
  }

  const evidence = validateEvidence(requestBody.evidence);

  if (!evidence.valid) {
    return invalidPurchaseOrderRequest(evidence.reason);
  }

  const externalOrderId = validateOptionalString(
    requestBody.externalOrderId,
    "externalOrderId",
  );

  if (!externalOrderId.valid) {
    return invalidPurchaseOrderRequest(externalOrderId.reason);
  }

  const purchasedAt = validateOptionalIsoString(requestBody.purchasedAt, "purchasedAt");

  if (!purchasedAt.valid) {
    return invalidPurchaseOrderRequest(purchasedAt.reason);
  }

  return {
    valid: true,
    request: {
      intermediaryUserId: intermediaryUserId.value,
      evidence: evidence.value,
      externalOrderId: externalOrderId.value,
      purchasedAt: purchasedAt.value ?? new Date().toISOString(),
    },
  };
}

function validateEvidence(
  value: unknown,
): { valid: true; value: ValidPurchaseEvidenceRequest } | { valid: false; reason: string } {
  if (!isObjectRecord(value)) {
    return { valid: false, reason: "evidence must be a JSON object" };
  }

  const evidenceBody = value as EvidenceRequestBody;
  const type = validateEvidenceType(evidenceBody.type);

  if (!type.valid) {
    return { valid: false, reason: type.reason };
  }

  const uri = validateOptionalString(evidenceBody.uri, "evidence.uri");

  if (!uri.valid) {
    return { valid: false, reason: uri.reason };
  }

  const hash = validateOptionalString(evidenceBody.hash, "evidence.hash");

  if (!hash.valid) {
    return { valid: false, reason: hash.reason };
  }

  const notes = validateOptionalString(evidenceBody.notes, "evidence.notes");

  if (!notes.valid) {
    return { valid: false, reason: notes.reason };
  }

  return {
    valid: true,
    value: {
      type: type.value,
      uri: uri.value,
      hash: hash.value,
      notes: notes.value,
    },
  };
}

function validateEvidenceType(
  value: unknown,
): { valid: true; value: PurchaseEvidenceType } | { valid: false; reason: string } {
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
      'evidence.type must be one of "receipt", "tracking", "delivery_confirmation", "conversation", "txid", or "other"',
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

function invalidPurchaseOrderRequest(reason: string): PurchaseOrderRequestValidation {
  return { valid: false, reason };
}

function invalidPurchaseOrderRequestResponse(reason: string) {
  return NextResponse.json(
    {
      error: "Invalid purchase order request",
      reason,
    },
    { status: 400 },
  );
}

function failedEvidencePersistenceResponse(error: unknown, orderId: string, user: string) {
  return internalErrorResponse(error, {
    route: "/api/orders/:id/purchase",
    orderId,
    user,
  });
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
