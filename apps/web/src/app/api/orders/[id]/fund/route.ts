import { createEscrowScriptDraft } from "@xolosarmy/escrow-core";
import type { EscrowParticipant, EscrowParticipants } from "@xolosarmy/escrow-core";
import { NextResponse } from "next/server";

import { getOrderStore } from "@/server/orders/get-order-store";

interface OrderFundRouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface FundOrderRequestBody {
  buyer?: unknown;
  arbitrator?: unknown;
  moderator?: unknown;
  simulatedDepositTxid?: unknown;
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

interface ValidFundOrderRequest {
  buyer: ValidParticipantRequest;
  arbitrator?: ValidParticipantRequest;
  moderator?: ValidParticipantRequest;
  simulatedDepositTxid: string;
}

type FundOrderRequestValidation =
  | { valid: true; request: ValidFundOrderRequest }
  | { valid: false; reason: string };

export async function POST(request: Request, context: OrderFundRouteContext) {
  const { id } = await context.params;
  const orderStore = await getOrderStore();
  const order = await orderStore.findById(id);

  if (order === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "WAITING_DEPOSIT") {
    return NextResponse.json(
      {
        error: "Order cannot be funded",
        reason: "Order status must be WAITING_DEPOSIT",
      },
      { status: 409 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    return invalidFundOrderRequestResponse(errorReason(error, "Request body must be valid JSON"));
  }

  const validation = validateFundOrderRequest(body);

  if (!validation.valid) {
    return invalidFundOrderRequestResponse(validation.reason);
  }

  const fundRequest = validation.request;

  if (fundRequest.buyer.userId !== order.buyerUserId) {
    return invalidFundOrderRequestResponse("buyer.userId must match order.buyerUserId");
  }

  const networkFeeReserveXec = validateNetworkFeeReserveXec(order.quote.networkFeeReserveXec);

  if (!networkFeeReserveXec.valid) {
    return invalidFundOrderRequestResponse(networkFeeReserveXec.reason);
  }

  const participants: EscrowParticipants = {
    buyer: toEscrowParticipant("buyer", fundRequest.buyer),
    arbitrator:
      fundRequest.arbitrator === undefined
        ? undefined
        : toEscrowParticipant("arbitrator", fundRequest.arbitrator),
    moderator:
      fundRequest.moderator === undefined
        ? undefined
        : toEscrowParticipant("moderator", fundRequest.moderator),
  };

  const draft = createEscrowScriptDraft({
    order,
    participants,
    platformAddress: process.env.PLATFORM_XEC_ADDRESS,
    networkFeeReserveXec: networkFeeReserveXec.value,
  });

  // TODO: replace this simulated state change with real on-chain deposit detection
  // through Chronik once funding transactions are broadcast and verified.
  const updatedOrder = await orderStore.update(order.id, {
    status: "FUNDED",
    escrow: {
      escrowAddress: draft.escrowAddress,
      escrowScriptHex: draft.escrowScriptHex,
      depositTxid: fundRequest.simulatedDepositTxid,
      nonce: draft.nonce,
    },
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({
    order: updatedOrder,
    escrowDraft: draft,
    warning: "Simulated funding only. No XEC transaction was broadcast or verified.",
  });
}

function validateFundOrderRequest(body: unknown): FundOrderRequestValidation {
  if (!isObjectRecord(body)) {
    return invalidFundOrderRequest("Request body must be a JSON object");
  }

  const requestBody = body as FundOrderRequestBody;
  const buyer = validateRequiredParticipant(requestBody.buyer, "buyer");

  if (!buyer.valid) {
    return invalidFundOrderRequest(buyer.reason);
  }

  const arbitrator = validateOptionalParticipant(requestBody.arbitrator, "arbitrator");

  if (!arbitrator.valid) {
    return invalidFundOrderRequest(arbitrator.reason);
  }

  const moderator = validateOptionalParticipant(requestBody.moderator, "moderator");

  if (!moderator.valid) {
    return invalidFundOrderRequest(moderator.reason);
  }

  const simulatedDepositTxid = validateOptionalString(
    requestBody.simulatedDepositTxid,
    "simulatedDepositTxid",
  );

  if (!simulatedDepositTxid.valid) {
    return invalidFundOrderRequest(simulatedDepositTxid.reason);
  }

  return {
    valid: true,
    request: {
      buyer: buyer.value,
      arbitrator: arbitrator.value,
      moderator: moderator.value,
      simulatedDepositTxid: simulatedDepositTxid.value ?? `simulated-${crypto.randomUUID()}`,
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

function invalidFundOrderRequest(reason: string): FundOrderRequestValidation {
  return { valid: false, reason };
}

function invalidFundOrderRequestResponse(reason: string) {
  return NextResponse.json(
    {
      error: "Invalid fund order request",
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
