import { createEscrowTransactionDraft } from "@xolosarmy/escrow-core";
import type { EscrowParticipant, EscrowParticipants } from "@xolosarmy/escrow-core";
import { NextResponse } from "next/server";

import { getOrderStore } from "@/server/orders/get-order-store";

interface OrderRefundRouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface RefundOrderRequestBody {
  buyerUserId?: unknown;
  buyer?: unknown;
  intermediary?: unknown;
  arbitrator?: unknown;
  moderator?: unknown;
  simulatedRefundTxid?: unknown;
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

interface ValidRefundOrderRequest {
  buyerUserId: string;
  buyer: ValidParticipantRequest;
  intermediary?: ValidParticipantRequest;
  arbitrator?: ValidParticipantRequest;
  moderator?: ValidParticipantRequest;
  simulatedRefundTxid: string;
  networkFeeXec: number;
}

type RefundOrderRequestValidation =
  | { valid: true; request: ValidRefundOrderRequest }
  | { valid: false; reason: string };

export async function POST(request: Request, context: OrderRefundRouteContext) {
  const { id } = await context.params;
  const orderStore = await getOrderStore();
  const order = await orderStore.findById(id);

  if (order === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "REFUND_PENDING") {
    return NextResponse.json(
      {
        error: "Order cannot be refunded",
        reason: "Order status must be REFUND_PENDING",
      },
      { status: 409 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    return invalidRefundOrderRequestResponse(
      errorReason(error, "Request body must be valid JSON"),
    );
  }

  const validation = validateRefundOrderRequest(body);

  if (!validation.valid) {
    return invalidRefundOrderRequestResponse(validation.reason);
  }

  const refundRequest = validation.request;

  if (refundRequest.buyerUserId !== order.buyerUserId) {
    return NextResponse.json(
      {
        error: "Buyer not allowed to receive refund",
        reason: "buyerUserId must match order.buyerUserId",
      },
      { status: 403 },
    );
  }

  if (refundRequest.buyer.userId !== order.buyerUserId) {
    return NextResponse.json(
      {
        error: "Buyer not allowed to receive refund",
        reason: "buyer.userId must match order.buyerUserId",
      },
      { status: 403 },
    );
  }

  if (order.intermediaryUserId !== undefined) {
    if (refundRequest.intermediary === undefined) {
      return invalidRefundOrderRequestResponse(
        "intermediary is required when order.intermediaryUserId exists",
      );
    }

    if (refundRequest.intermediary.userId !== order.intermediaryUserId) {
      return NextResponse.json(
        {
          error: "Intermediary not allowed to approve refund",
          reason: "intermediary.userId must match order.intermediaryUserId",
        },
        { status: 403 },
      );
    }
  }

  const networkFeeReserveXec = validateNetworkFeeReserveXec(
    order.quote.networkFeeReserveXec,
  );

  if (!networkFeeReserveXec.valid) {
    return invalidRefundOrderRequestResponse(networkFeeReserveXec.reason);
  }

  const participants: EscrowParticipants = {
    buyer: toEscrowParticipant("buyer", refundRequest.buyer),
    intermediary:
      refundRequest.intermediary === undefined
        ? undefined
        : toEscrowParticipant("intermediary", refundRequest.intermediary),
    arbitrator:
      refundRequest.arbitrator === undefined
        ? undefined
        : toEscrowParticipant("arbitrator", refundRequest.arbitrator),
    moderator:
      refundRequest.moderator === undefined
        ? undefined
        : toEscrowParticipant("moderator", refundRequest.moderator),
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
      route: "voluntary_refund",
      networkFeeXec: refundRequest.networkFeeXec,
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
    status: "REFUNDED",
    escrow: {
      ...order.escrow,
      refundTxid: refundRequest.simulatedRefundTxid,
    },
    updatedAt: new Date().toISOString(),
  });

  if (updatedOrder === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    order: updatedOrder,
    escrowTransactionDraft: draft,
    warning: "Simulated refund only. No XEC transaction was broadcast.",
  });
}

function validateRefundOrderRequest(body: unknown): RefundOrderRequestValidation {
  if (!isObjectRecord(body)) {
    return invalidRefundOrderRequest("Request body must be a JSON object");
  }

  const requestBody = body as RefundOrderRequestBody;
  const buyerUserId = validateRequiredString(requestBody.buyerUserId, "buyerUserId");

  if (!buyerUserId.valid) {
    return invalidRefundOrderRequest(buyerUserId.reason);
  }

  const buyer = validateRequiredParticipant(requestBody.buyer, "buyer");

  if (!buyer.valid) {
    return invalidRefundOrderRequest(buyer.reason);
  }

  const intermediary = validateOptionalParticipant(
    requestBody.intermediary,
    "intermediary",
  );

  if (!intermediary.valid) {
    return invalidRefundOrderRequest(intermediary.reason);
  }

  const arbitrator = validateOptionalParticipant(requestBody.arbitrator, "arbitrator");

  if (!arbitrator.valid) {
    return invalidRefundOrderRequest(arbitrator.reason);
  }

  const moderator = validateOptionalParticipant(requestBody.moderator, "moderator");

  if (!moderator.valid) {
    return invalidRefundOrderRequest(moderator.reason);
  }

  const simulatedRefundTxid = validateOptionalString(
    requestBody.simulatedRefundTxid,
    "simulatedRefundTxid",
  );

  if (!simulatedRefundTxid.valid) {
    return invalidRefundOrderRequest(simulatedRefundTxid.reason);
  }

  const networkFeeXec = validateOptionalNonNegativeNumber(
    requestBody.networkFeeXec,
    "networkFeeXec",
  );

  if (!networkFeeXec.valid) {
    return invalidRefundOrderRequest(networkFeeXec.reason);
  }

  return {
    valid: true,
    request: {
      buyerUserId: buyerUserId.value,
      buyer: buyer.value,
      intermediary: intermediary.value,
      arbitrator: arbitrator.value,
      moderator: moderator.value,
      simulatedRefundTxid:
        simulatedRefundTxid.value ?? `simulated-refund-${crypto.randomUUID()}`,
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

function invalidRefundOrderRequest(reason: string): RefundOrderRequestValidation {
  return { valid: false, reason };
}

function invalidRefundOrderRequestResponse(reason: string) {
  return NextResponse.json(
    {
      error: "Invalid refund order request",
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
