import type { ReputationLevel, ReputationProfile } from "@xolosarmy/models";
import { canUserAcceptOrder } from "@xolosarmy/reputation";
import { NextResponse } from "next/server";

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
import { getReputationStore } from "@/server/reputation/get-reputation-store";

interface OrderAcceptRouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface AcceptOrderRequestBody {
  intermediary?: unknown;
  reputationProfile?: unknown;
  currentDailyVolumeFiatMxn?: unknown;
}

interface IntermediaryRequestBody {
  userId?: unknown;
  address?: unknown;
  alias?: unknown;
}

interface ValidIntermediaryRequest {
  userId: string;
  address: string;
  alias?: string;
}

interface ValidAcceptOrderRequest {
  intermediary: ValidIntermediaryRequest;
  reputationProfile: ReputationProfile;
  currentDailyVolumeFiatMxn: number;
}

type AcceptOrderRequestValidation =
  | { valid: true; request: ValidAcceptOrderRequest }
  | { valid: false; reason: string };

export async function POST(request: Request, context: OrderAcceptRouteContext) {
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

  const { id } = await context.params;
  const orderStore = await getOrderStore();
  const order = await orderStore.findById(id);

  if (order === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "FUNDED") {
    return NextResponse.json(
      {
        error: "Order cannot be accepted",
        reason: "Order status must be FUNDED",
      },
      { status: 409 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    return invalidAcceptOrderRequestResponse(errorReason(error, "Request body must be valid JSON"));
  }

  const validation = validateAcceptOrderRequest(body);

  if (!validation.valid) {
    return invalidAcceptOrderRequestResponse(validation.reason);
  }

  const acceptRequest = validation.request;

  if (authRequired && sessionUser !== null) {
    if (!assertSameUser(sessionUser, acceptRequest.intermediary.userId)) {
      return forbiddenResponse();
    }
  }

  if (order.buyerUserId === acceptRequest.intermediary.userId) {
    return invalidAcceptOrderRequestResponse("buyerUserId must not match intermediary.userId");
  }

  // --- REPUTATION ENGINE INJECTION ---
  const reputationStore = await getReputationStore();
  let profile = await reputationStore.getProfile(acceptRequest.intermediary.userId);
  
  if (!profile) {
    profile = acceptRequest.reputationProfile;
    await reputationStore.saveProfile(profile);
  }

  const decision = canUserAcceptOrder({
    profile,
    order,
    currentDailyVolumeFiatMxn: acceptRequest.currentDailyVolumeFiatMxn,
  });
  // -----------------------------------

  if (!decision.allowed) {
    return NextResponse.json(
      {
        error: "Intermediary not allowed to accept order",
        reason: decision.reason,
      },
      { status: 403 },
    );
  }

  const updatedOrder = await orderStore.update(order.id, {
    status: "ACCEPTED",
    intermediaryUserId: acceptRequest.intermediary.userId,
    updatedAt: new Date().toISOString(),
  });

  if (updatedOrder === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    order: updatedOrder,
    decision,
  });
}

function validateAcceptOrderRequest(body: unknown): AcceptOrderRequestValidation {
  if (!isObjectRecord(body)) {
    return invalidAcceptOrderRequest("Request body must be a JSON object");
  }

  const requestBody = body as AcceptOrderRequestBody;
  const intermediary = validateIntermediary(requestBody.intermediary);

  if (!intermediary.valid) {
    return invalidAcceptOrderRequest(intermediary.reason);
  }

  const reputationProfile = validateReputationProfile(requestBody.reputationProfile);

  if (!reputationProfile.valid) {
    return invalidAcceptOrderRequest(reputationProfile.reason);
  }

  if (reputationProfile.value.userId !== intermediary.value.userId) {
    return invalidAcceptOrderRequest(
      "reputationProfile.userId must match intermediary.userId",
    );
  }

  if (reputationProfile.value.address !== intermediary.value.address) {
    return invalidAcceptOrderRequest(
      "reputationProfile.address must match intermediary.address",
    );
  }

  const currentDailyVolumeFiatMxn = validateNonNegativeNumber(
    requestBody.currentDailyVolumeFiatMxn,
    "currentDailyVolumeFiatMxn",
  );

  if (!currentDailyVolumeFiatMxn.valid) {
    return invalidAcceptOrderRequest(currentDailyVolumeFiatMxn.reason);
  }

  return {
    valid: true,
    request: {
      intermediary: intermediary.value,
      reputationProfile: reputationProfile.value,
      currentDailyVolumeFiatMxn: currentDailyVolumeFiatMxn.value,
    },
  };
}

function validateIntermediary(
  value: unknown,
): { valid: true; value: ValidIntermediaryRequest } | { valid: false; reason: string } {
  if (!isObjectRecord(value)) {
    return { valid: false, reason: "intermediary must be a JSON object" };
  }

  const intermediaryBody = value as IntermediaryRequestBody;
  const userId = validateRequiredString(intermediaryBody.userId, "intermediary.userId");

  if (!userId.valid) {
    return { valid: false, reason: userId.reason };
  }

  const address = validateRequiredString(intermediaryBody.address, "intermediary.address");

  if (!address.valid) {
    return { valid: false, reason: address.reason };
  }

  const alias = validateOptionalString(intermediaryBody.alias, "intermediary.alias");

  if (!alias.valid) {
    return { valid: false, reason: alias.reason };
  }

  return {
    valid: true,
    value: {
      userId: userId.value,
      address: address.value,
      alias: alias.value,
    },
  };
}

function validateReputationProfile(
  value: unknown,
): { valid: true; value: ReputationProfile } | { valid: false; reason: string } {
  if (!isObjectRecord(value)) {
    return { valid: false, reason: "reputationProfile must be a JSON object" };
  }

  const userId = validateRequiredString(value.userId, "reputationProfile.userId");

  if (!userId.valid) {
    return { valid: false, reason: userId.reason };
  }

  const address = validateRequiredString(value.address, "reputationProfile.address");

  if (!address.valid) {
    return { valid: false, reason: address.reason };
  }

  const alias = validateOptionalString(value.alias, "reputationProfile.alias");

  if (!alias.valid) {
    return { valid: false, reason: alias.reason };
  }

  const level = validateReputationLevel(value.level);

  if (!level.valid) {
    return { valid: false, reason: level.reason };
  }

  const score = validateNumber(value.score, "reputationProfile.score");

  if (!score.valid) {
    return { valid: false, reason: score.reason };
  }

  const completedOrders = validateNonNegativeNumber(
    value.completedOrders,
    "reputationProfile.completedOrders",
  );

  if (!completedOrders.valid) {
    return { valid: false, reason: completedOrders.reason };
  }

  const completedEligibleOrders = validateNonNegativeNumber(
    value.completedEligibleOrders,
    "reputationProfile.completedEligibleOrders",
  );

  if (!completedEligibleOrders.valid) {
    return { valid: false, reason: completedEligibleOrders.reason };
  }

  const totalVolumeXec = validateNonNegativeNumber(
    value.totalVolumeXec,
    "reputationProfile.totalVolumeXec",
  );

  if (!totalVolumeXec.valid) {
    return { valid: false, reason: totalVolumeXec.reason };
  }

  const totalVolumeFiatMxn = validateNonNegativeNumber(
    value.totalVolumeFiatMxn,
    "reputationProfile.totalVolumeFiatMxn",
  );

  if (!totalVolumeFiatMxn.valid) {
    return { valid: false, reason: totalVolumeFiatMxn.reason };
  }

  const openDisputes = validateNonNegativeNumber(
    value.openDisputes,
    "reputationProfile.openDisputes",
  );

  if (!openDisputes.valid) {
    return { valid: false, reason: openDisputes.reason };
  }

  const wonDisputes = validateNonNegativeNumber(
    value.wonDisputes,
    "reputationProfile.wonDisputes",
  );

  if (!wonDisputes.valid) {
    return { valid: false, reason: wonDisputes.reason };
  }

  const lostDisputes = validateNonNegativeNumber(
    value.lostDisputes,
    "reputationProfile.lostDisputes",
  );

  if (!lostDisputes.valid) {
    return { valid: false, reason: lostDisputes.reason };
  }

  const limits = validateReputationLimits(value.limits);

  if (!limits.valid) {
    return { valid: false, reason: limits.reason };
  }

  if (typeof value.isFrozen !== "boolean") {
    return {
      valid: false,
      reason: "reputationProfile.isFrozen must be a boolean",
    };
  }

  const updatedAt = validateRequiredString(value.updatedAt, "reputationProfile.updatedAt");

  if (!updatedAt.valid) {
    return { valid: false, reason: updatedAt.reason };
  }

  return {
    valid: true,
    value: {
      userId: userId.value,
      alias: alias.value,
      address: address.value,
      level: level.value,
      score: score.value,
      completedOrders: completedOrders.value,
      completedEligibleOrders: completedEligibleOrders.value,
      totalVolumeXec: totalVolumeXec.value,
      totalVolumeFiatMxn: totalVolumeFiatMxn.value,
      openDisputes: openDisputes.value,
      wonDisputes: wonDisputes.value,
      lostDisputes: lostDisputes.value,
      limits: limits.value,
      isFrozen: value.isFrozen,
      updatedAt: updatedAt.value,
    },
  };
}

function validateReputationLimits(
  value: unknown,
): { valid: true; value: ReputationProfile["limits"] } | { valid: false; reason: string } {
  if (!isObjectRecord(value)) {
    return { valid: false, reason: "reputationProfile.limits must be a JSON object" };
  }

  const maxOrderFiatMxn = validateNonNegativeNumber(
    value.maxOrderFiatMxn,
    "reputationProfile.limits.maxOrderFiatMxn",
  );

  if (!maxOrderFiatMxn.valid) {
    return { valid: false, reason: maxOrderFiatMxn.reason };
  }

  const maxDailyFiatMxn = validateNonNegativeNumber(
    value.maxDailyFiatMxn,
    "reputationProfile.limits.maxDailyFiatMxn",
  );

  if (!maxDailyFiatMxn.valid) {
    return { valid: false, reason: maxDailyFiatMxn.reason };
  }

  return {
    valid: true,
    value: {
      maxOrderFiatMxn: maxOrderFiatMxn.value,
      maxDailyFiatMxn: maxDailyFiatMxn.value,
    },
  };
}

function validateReputationLevel(
  value: unknown,
): { valid: true; value: ReputationLevel } | { valid: false; reason: string } {
  if (
    value === "new" ||
    value === "alias_verified" ||
    value === "trusted_intermediary" ||
    value === "tonalli_merchant" ||
    value === "commercial_node"
  ) {
    return { valid: true, value };
  }

  return {
    valid: false,
    reason:
      'reputationProfile.level must be one of "new", "alias_verified", "trusted_intermediary", "tonalli_merchant", or "commercial_node"',
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

function validateNumber(
  value: unknown,
  fieldName: string,
): { valid: true; value: number } | { valid: false; reason: string } {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { valid: false, reason: `${fieldName} must be a finite number` };
  }

  return { valid: true, value };
}

function validateNonNegativeNumber(
  value: unknown,
  fieldName: string,
): { valid: true; value: number } | { valid: false; reason: string } {
  const numberValue = validateNumber(value, fieldName);

  if (!numberValue.valid) {
    return numberValue;
  }

  if (numberValue.value < 0) {
    return { valid: false, reason: `${fieldName} must be greater than or equal to 0` };
  }

  return numberValue;
}

function invalidAcceptOrderRequest(reason: string): AcceptOrderRequestValidation {
  return { valid: false, reason };
}

function invalidAcceptOrderRequestResponse(reason: string) {
  return NextResponse.json(
    {
      error: "Invalid accept order request",
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
