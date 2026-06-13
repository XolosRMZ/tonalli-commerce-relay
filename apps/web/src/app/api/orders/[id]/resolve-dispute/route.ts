import { createEscrowTransactionDraft } from "@xolosarmy/escrow-core";
import type {
  EscrowParticipant,
  EscrowParticipants,
  EscrowResolutionRoute,
} from "@xolosarmy/escrow-core";
import { NextResponse } from "next/server";

import { getOrderStore } from "@/server/orders/get-order-store";

interface ResolveDisputeRouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface ResolveDisputeRequestBody {
  resolvedByUserId?: unknown;
  resolution?: unknown;
  authority?: unknown;
  buyer?: unknown;
  intermediary?: unknown;
  arbitrator?: unknown;
  moderator?: unknown;
  networkFeeXec?: unknown;
  simulatedTxid?: unknown;
  resolvedAt?: unknown;
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

type DisputeResolution = "release_to_intermediary" | "refund_to_buyer";
type DisputeAuthority = "arbitrator" | "moderator";

interface ValidResolveDisputeRequest {
  resolvedByUserId: string;
  resolution: DisputeResolution;
  authority: DisputeAuthority;
  buyer: ValidParticipantRequest;
  intermediary?: ValidParticipantRequest;
  arbitrator?: ValidParticipantRequest;
  moderator?: ValidParticipantRequest;
  networkFeeXec: number;
  simulatedTxid: string;
  resolvedAt: string;
}

type ResolveDisputeRequestValidation =
  | { valid: true; request: ValidResolveDisputeRequest }
  | { valid: false; reason: string };

export async function POST(request: Request, context: ResolveDisputeRouteContext) {
  const { id } = await context.params;
  const orderStore = await getOrderStore();
  const order = await orderStore.findById(id);

  if (order === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "DISPUTED") {
    return NextResponse.json(
      {
        error: "Order dispute cannot be resolved",
        reason: "Order status must be DISPUTED",
      },
      { status: 409 },
    );
  }

  if (order.disputeStatus !== "opened" && order.disputeStatus !== "under_review") {
    return NextResponse.json(
      {
        error: "Order dispute cannot be resolved",
        reason: "order.disputeStatus must be opened or under_review",
      },
      { status: 409 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    return invalidResolveDisputeRequestResponse(
      errorReason(error, "Request body must be valid JSON"),
    );
  }

  const validation = validateResolveDisputeRequest(body);

  if (!validation.valid) {
    return invalidResolveDisputeRequestResponse(validation.reason);
  }

  const resolutionRequest = validation.request;

  if (resolutionRequest.buyer.userId !== order.buyerUserId) {
    return NextResponse.json(
      {
        error: "Buyer not allowed for dispute resolution",
        reason: "buyer.userId must match order.buyerUserId",
      },
      { status: 403 },
    );
  }

  if (resolutionRequest.resolution === "release_to_intermediary") {
    if (order.intermediaryUserId === undefined) {
      return NextResponse.json(
        {
          error: "Order dispute cannot release to intermediary",
          reason: "order.intermediaryUserId must exist",
        },
        { status: 409 },
      );
    }

    if (resolutionRequest.intermediary === undefined) {
      return invalidResolveDisputeRequestResponse(
        "intermediary is required when resolution is release_to_intermediary",
      );
    }

    if (resolutionRequest.intermediary.userId !== order.intermediaryUserId) {
      return NextResponse.json(
        {
          error: "Intermediary not allowed to receive dispute release",
          reason: "intermediary.userId must match order.intermediaryUserId",
        },
        { status: 403 },
      );
    }
  }

  const authorityValidation = validateAuthorityActor(resolutionRequest);

  if (!authorityValidation.valid) {
    return NextResponse.json(
      {
        error: "Authority actor not allowed to resolve dispute",
        reason: authorityValidation.reason,
      },
      { status: 403 },
    );
  }

  const networkFeeReserveXec = validateNetworkFeeReserveXec(
    order.quote.networkFeeReserveXec,
  );

  if (!networkFeeReserveXec.valid) {
    return invalidResolveDisputeRequestResponse(networkFeeReserveXec.reason);
  }

  const route = getResolutionRoute(
    resolutionRequest.authority,
    resolutionRequest.resolution,
  );
  const participants: EscrowParticipants = {
    buyer: toEscrowParticipant("buyer", resolutionRequest.buyer),
    intermediary:
      resolutionRequest.intermediary === undefined
        ? undefined
        : toEscrowParticipant("intermediary", resolutionRequest.intermediary),
    arbitrator:
      resolutionRequest.arbitrator === undefined
        ? undefined
        : toEscrowParticipant("arbitrator", resolutionRequest.arbitrator),
    moderator:
      resolutionRequest.moderator === undefined
        ? undefined
        : toEscrowParticipant("moderator", resolutionRequest.moderator),
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
      route,
      networkFeeXec: resolutionRequest.networkFeeXec,
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
    status:
      resolutionRequest.resolution === "release_to_intermediary"
        ? "RELEASED"
        : "REFUNDED",
    escrow:
      resolutionRequest.resolution === "release_to_intermediary"
        ? {
            ...order.escrow,
            releaseTxid: resolutionRequest.simulatedTxid,
          }
        : {
            ...order.escrow,
            refundTxid: resolutionRequest.simulatedTxid,
          },
    disputeStatus:
      resolutionRequest.resolution === "release_to_intermediary"
        ? "resolved_intermediary"
        : "resolved_buyer",
    updatedAt: new Date().toISOString(),
  });

  if (updatedOrder === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    order: updatedOrder,
    resolution: {
      resolvedByUserId: resolutionRequest.resolvedByUserId,
      authority: resolutionRequest.authority,
      resolution: resolutionRequest.resolution,
      route,
      resolvedAt: resolutionRequest.resolvedAt,
    },
    escrowTransactionDraft: draft,
    warning: "Simulated dispute resolution only. No XEC transaction was broadcast.",
  });
}

function validateResolveDisputeRequest(
  body: unknown,
): ResolveDisputeRequestValidation {
  if (!isObjectRecord(body)) {
    return invalidResolveDisputeRequest("Request body must be a JSON object");
  }

  const requestBody = body as ResolveDisputeRequestBody;
  const resolvedByUserId = validateRequiredString(
    requestBody.resolvedByUserId,
    "resolvedByUserId",
  );

  if (!resolvedByUserId.valid) {
    return invalidResolveDisputeRequest(resolvedByUserId.reason);
  }

  const resolution = validateResolution(requestBody.resolution);

  if (!resolution.valid) {
    return invalidResolveDisputeRequest(resolution.reason);
  }

  const authority = validateAuthority(requestBody.authority);

  if (!authority.valid) {
    return invalidResolveDisputeRequest(authority.reason);
  }

  const buyer = validateRequiredParticipant(requestBody.buyer, "buyer");

  if (!buyer.valid) {
    return invalidResolveDisputeRequest(buyer.reason);
  }

  const intermediary = validateOptionalParticipant(
    requestBody.intermediary,
    "intermediary",
  );

  if (!intermediary.valid) {
    return invalidResolveDisputeRequest(intermediary.reason);
  }

  const arbitrator = validateOptionalParticipant(requestBody.arbitrator, "arbitrator");

  if (!arbitrator.valid) {
    return invalidResolveDisputeRequest(arbitrator.reason);
  }

  const moderator = validateOptionalParticipant(requestBody.moderator, "moderator");

  if (!moderator.valid) {
    return invalidResolveDisputeRequest(moderator.reason);
  }

  if (authority.value === "arbitrator" && arbitrator.value === undefined) {
    return invalidResolveDisputeRequest(
      "arbitrator is required when authority is arbitrator",
    );
  }

  if (authority.value === "moderator" && moderator.value === undefined) {
    return invalidResolveDisputeRequest(
      "moderator is required when authority is moderator",
    );
  }

  const networkFeeXec = validateOptionalNonNegativeNumber(
    requestBody.networkFeeXec,
    "networkFeeXec",
  );

  if (!networkFeeXec.valid) {
    return invalidResolveDisputeRequest(networkFeeXec.reason);
  }

  const simulatedTxid = validateOptionalString(
    requestBody.simulatedTxid,
    "simulatedTxid",
  );

  if (!simulatedTxid.valid) {
    return invalidResolveDisputeRequest(simulatedTxid.reason);
  }

  const resolvedAt = validateOptionalIsoString(requestBody.resolvedAt, "resolvedAt");

  if (!resolvedAt.valid) {
    return invalidResolveDisputeRequest(resolvedAt.reason);
  }

  return {
    valid: true,
    request: {
      resolvedByUserId: resolvedByUserId.value,
      resolution: resolution.value,
      authority: authority.value,
      buyer: buyer.value,
      intermediary: intermediary.value,
      arbitrator: arbitrator.value,
      moderator: moderator.value,
      networkFeeXec: networkFeeXec.value ?? 10,
      simulatedTxid:
        simulatedTxid.value ?? `simulated-dispute-${crypto.randomUUID()}`,
      resolvedAt: resolvedAt.value ?? new Date().toISOString(),
    },
  };
}

function validateAuthorityActor(
  request: ValidResolveDisputeRequest,
): { valid: true } | { valid: false; reason: string } {
  if (request.authority === "arbitrator") {
    if (request.arbitrator === undefined) {
      return { valid: false, reason: "arbitrator is required" };
    }

    if (request.arbitrator.userId !== request.resolvedByUserId) {
      return {
        valid: false,
        reason: "arbitrator.userId must match resolvedByUserId",
      };
    }

    return { valid: true };
  }

  if (request.moderator === undefined) {
    return { valid: false, reason: "moderator is required" };
  }

  if (request.moderator.userId !== request.resolvedByUserId) {
    return {
      valid: false,
      reason: "moderator.userId must match resolvedByUserId",
    };
  }

  return { valid: true };
}

function getResolutionRoute(
  authority: DisputeAuthority,
  resolution: DisputeResolution,
): EscrowResolutionRoute {
  if (authority === "arbitrator") {
    return resolution === "release_to_intermediary"
      ? "arbitrator_release_to_intermediary"
      : "arbitrator_refund_to_buyer";
  }

  return resolution === "release_to_intermediary"
    ? "moderator_release_to_intermediary"
    : "moderator_refund_to_buyer";
}

function validateResolution(
  value: unknown,
): { valid: true; value: DisputeResolution } | { valid: false; reason: string } {
  if (value === "release_to_intermediary" || value === "refund_to_buyer") {
    return { valid: true, value };
  }

  return {
    valid: false,
    reason: 'resolution must be "release_to_intermediary" or "refund_to_buyer"',
  };
}

function validateAuthority(
  value: unknown,
): { valid: true; value: DisputeAuthority } | { valid: false; reason: string } {
  if (value === "arbitrator" || value === "moderator") {
    return { valid: true, value };
  }

  return {
    valid: false,
    reason: 'authority must be "arbitrator" or "moderator"',
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

function invalidResolveDisputeRequest(reason: string): ResolveDisputeRequestValidation {
  return { valid: false, reason };
}

function invalidResolveDisputeRequestResponse(reason: string) {
  return NextResponse.json(
    {
      error: "Invalid resolve dispute request",
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
