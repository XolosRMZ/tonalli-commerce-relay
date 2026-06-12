import { createEscrowTransactionDraft } from "@xolosarmy/escrow-core";
import type { EscrowParticipant, EscrowParticipants } from "@xolosarmy/escrow-core";
import { NextResponse } from "next/server";

import { orderStore } from "@/server/orders/order-store";

interface OrderReleaseRouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface ReleaseOrderRequestBody {
  buyerUserId?: unknown;
  buyer?: unknown;
  intermediary?: unknown;
  arbitrator?: unknown;
  moderator?: unknown;
  simulatedReleaseTxid?: unknown;
  networkFeeXec?: unknown;
}

interface ParticipantRequestBody {
  userId?: unknown;
  address?: unknown;
  publicKey?: unknown;
}

interface ValidParticipantRequest {
  userId: string;
  address: string;
  publicKey?: string;
}

interface ValidReleaseOrderRequest {
  buyerUserId: string;
  buyer: ValidParticipantRequest;
  intermediary: ValidParticipantRequest;
  arbitrator?: ValidParticipantRequest;
  moderator?: ValidParticipantRequest;
  simulatedReleaseTxid: string;
  networkFeeXec: number;
}

type ReleaseOrderRequestValidation =
  | { valid: true; request: ValidReleaseOrderRequest }
  | { valid: false; reason: string };

export async function POST(request: Request, context: OrderReleaseRouteContext) {
  const { id } = await context.params;
  const order = await orderStore.findById(id);

  if (order === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "RELEASE_PENDING") {
    return NextResponse.json(
      {
        error: "Order cannot be released",
        reason: "Order status must be RELEASE_PENDING",
      },
      { status: 409 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    return invalidReleaseOrderRequestResponse(
      errorReason(error, "Request body must be valid JSON"),
    );
  }

  const validation = validateReleaseOrderRequest(body);

  if (!validation.valid) {
    return invalidReleaseOrderRequestResponse(validation.reason);
  }

  const releaseRequest = validation.request;

  if (releaseRequest.buyerUserId !== order.buyerUserId) {
    return NextResponse.json(
      {
        error: "Buyer not allowed to release order",
        reason: "buyerUserId must match order.buyerUserId",
      },
      { status: 403 },
    );
  }

  if (releaseRequest.buyer.userId !== order.buyerUserId) {
    return NextResponse.json(
      {
        error: "Buyer not allowed to release order",
        reason: "buyer.userId must match order.buyerUserId",
      },
      { status: 403 },
    );
  }

  if (order.intermediaryUserId === undefined) {
    return NextResponse.json(
      {
        error: "Order cannot be released",
        reason: "order.intermediaryUserId must exist",
      },
      { status: 409 },
    );
  }

  if (releaseRequest.intermediary.userId !== order.intermediaryUserId) {
    return NextResponse.json(
      {
        error: "Intermediary not allowed to receive escrow release",
        reason: "intermediary.userId must match order.intermediaryUserId",
      },
      { status: 403 },
    );
  }

  const networkFeeReserveXec = validateNetworkFeeReserveXec(
    order.quote.networkFeeReserveXec,
  );

  if (!networkFeeReserveXec.valid) {
    return invalidReleaseOrderRequestResponse(networkFeeReserveXec.reason);
  }

  const participants: EscrowParticipants = {
    buyer: toEscrowParticipant("buyer", releaseRequest.buyer),
    intermediary: toEscrowParticipant("intermediary", releaseRequest.intermediary),
    arbitrator:
      releaseRequest.arbitrator === undefined
        ? undefined
        : toEscrowParticipant("arbitrator", releaseRequest.arbitrator),
    moderator:
      releaseRequest.moderator === undefined
        ? undefined
        : toEscrowParticipant("moderator", releaseRequest.moderator),
  };

  let draft: ReturnType<typeof createEscrowTransactionDraft>;

  try {
    draft = createEscrowTransactionDraft({
      context: {
        order,
        participants,
        platformAddress: process.env.PLATFORM_XEC_ADDRESS,
        networkFeeReserveXec: networkFeeReserveXec.value,
      },
      route: "buyer_confirms_release",
      networkFeeXec: releaseRequest.networkFeeXec,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create escrow transaction draft",
        reason: errorReason(error, "createEscrowTransactionDraft failed"),
      },
      { status: 500 },
    );
  }

  const updatedOrder = await orderStore.update(order.id, {
    status: "RELEASED",
    escrow: {
      ...order.escrow,
      releaseTxid: releaseRequest.simulatedReleaseTxid,
    },
    updatedAt: new Date().toISOString(),
  });

  if (updatedOrder === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    order: updatedOrder,
    escrowTransactionDraft: draft,
    warning: "Simulated release only. No XEC transaction was broadcast.",
  });
}

function validateReleaseOrderRequest(body: unknown): ReleaseOrderRequestValidation {
  if (!isObjectRecord(body)) {
    return invalidReleaseOrderRequest("Request body must be a JSON object");
  }

  const requestBody = body as ReleaseOrderRequestBody;
  const buyerUserId = validateRequiredString(requestBody.buyerUserId, "buyerUserId");

  if (!buyerUserId.valid) {
    return invalidReleaseOrderRequest(buyerUserId.reason);
  }

  const buyer = validateRequiredParticipant(requestBody.buyer, "buyer");

  if (!buyer.valid) {
    return invalidReleaseOrderRequest(buyer.reason);
  }

  const intermediary = validateRequiredParticipant(
    requestBody.intermediary,
    "intermediary",
  );

  if (!intermediary.valid) {
    return invalidReleaseOrderRequest(intermediary.reason);
  }

  const arbitrator = validateOptionalParticipant(requestBody.arbitrator, "arbitrator");

  if (!arbitrator.valid) {
    return invalidReleaseOrderRequest(arbitrator.reason);
  }

  const moderator = validateOptionalParticipant(requestBody.moderator, "moderator");

  if (!moderator.valid) {
    return invalidReleaseOrderRequest(moderator.reason);
  }

  const simulatedReleaseTxid = validateOptionalString(
    requestBody.simulatedReleaseTxid,
    "simulatedReleaseTxid",
  );

  if (!simulatedReleaseTxid.valid) {
    return invalidReleaseOrderRequest(simulatedReleaseTxid.reason);
  }

  const networkFeeXec = validateOptionalNonNegativeNumber(
    requestBody.networkFeeXec,
    "networkFeeXec",
  );

  if (!networkFeeXec.valid) {
    return invalidReleaseOrderRequest(networkFeeXec.reason);
  }

  return {
    valid: true,
    request: {
      buyerUserId: buyerUserId.value,
      buyer: buyer.value,
      intermediary: intermediary.value,
      arbitrator: arbitrator.value,
      moderator: moderator.value,
      simulatedReleaseTxid:
        simulatedReleaseTxid.value ?? `simulated-release-${crypto.randomUUID()}`,
      networkFeeXec: networkFeeXec.value ?? 10,
    },
  };
}

function validateRequiredParticipant(
  value: unknown,
  fieldName: string,
): { valid: true; value: ValidParticipantRequest } | { valid: false; reason: string } {
  if (value === undefined) {
    return { valid: false, reason: `${fieldName} is required` };
  }

  return validateParticipant(value, fieldName);
}

function validateOptionalParticipant(
  value: unknown,
  fieldName: string,
): { valid: true; value: ValidParticipantRequest | undefined } | { valid: false; reason: string } {
  if (value === undefined) {
    return { valid: true, value: undefined };
  }

  return validateParticipant(value, fieldName);
}

function validateParticipant(
  value: unknown,
  fieldName: string,
): { valid: true; value: ValidParticipantRequest } | { valid: false; reason: string } {
  if (!isObjectRecord(value)) {
    return { valid: false, reason: `${fieldName} must be a JSON object` };
  }

  const participantBody = value as ParticipantRequestBody;
  const userId = validateRequiredString(participantBody.userId, `${fieldName}.userId`);

  if (!userId.valid) {
    return { valid: false, reason: userId.reason };
  }

  const address = validateRequiredString(participantBody.address, `${fieldName}.address`);

  if (!address.valid) {
    return { valid: false, reason: address.reason };
  }

  const publicKey = validateOptionalString(participantBody.publicKey, `${fieldName}.publicKey`);

  if (!publicKey.valid) {
    return { valid: false, reason: publicKey.reason };
  }

  return {
    valid: true,
    value: {
      userId: userId.value,
      address: address.value,
      publicKey: publicKey.value,
    },
  };
}

function validateNetworkFeeReserveXec(
  value: unknown,
): { valid: true; value: number } | { valid: false; reason: string } {
  if (!isObjectRecord(value) || typeof value.amount !== "number" || !Number.isFinite(value.amount)) {
    return {
      valid: false,
      reason: "order.quote.networkFeeReserveXec.amount must be a finite number",
    };
  }

  return { valid: true, value: value.amount };
}

function toEscrowParticipant(
  role: EscrowParticipant["role"],
  participant: ValidParticipantRequest,
): EscrowParticipant {
  return {
    role,
    userId: participant.userId,
    address: participant.address,
    publicKey: participant.publicKey,
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

function validateOptionalNonNegativeNumber(
  value: unknown,
  fieldName: string,
): { valid: true; value: number | undefined } | { valid: false; reason: string } {
  if (value === undefined) {
    return { valid: true, value: undefined };
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return { valid: false, reason: `${fieldName} must be a number greater than or equal to 0` };
  }

  return { valid: true, value };
}

function invalidReleaseOrderRequest(reason: string): ReleaseOrderRequestValidation {
  return { valid: false, reason };
}

function invalidReleaseOrderRequestResponse(reason: string) {
  return NextResponse.json(
    {
      error: "Invalid release order request",
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
