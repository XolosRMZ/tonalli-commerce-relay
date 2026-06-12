import type { CommerceOrder } from "@xolosarmy/models";
import type {
  CanAcceptOrderParams,
  OrderEligibilityResult,
  ReputationDecision
} from "./types";
import { isWithinDailyLimit, isWithinOrderLimit } from "./limits";

export const MIN_ELIGIBLE_ORDER_FIAT_MXN = 300;

export function getOrderTotalFiatMxn(order: CommerceOrder): number {
  if (order.quote.totalFiat.currency === "MXN") {
    return order.quote.totalFiat.amount;
  }

  // TODO: Convert USD to MXN using pricing/rates.
  return 0;
}

export function isOrderEligibleForReputation(
  order: CommerceOrder
): OrderEligibilityResult {
  if (order.status !== "RELEASED") {
    return {
      eligible: false,
      reason: "Order must be released to qualify for reputation"
    };
  }

  const totalFiatMxn = getOrderTotalFiatMxn(order);

  if (totalFiatMxn < MIN_ELIGIBLE_ORDER_FIAT_MXN) {
    return {
      eligible: false,
      reason: `Order total must be at least ${MIN_ELIGIBLE_ORDER_FIAT_MXN} MXN`
    };
  }

  return { eligible: true };
}

export function canUserAcceptOrder(
  params: CanAcceptOrderParams
): ReputationDecision {
  const { profile, order, currentDailyVolumeFiatMxn } = params;

  if (profile.isFrozen) {
    return { allowed: false, reason: "User reputation profile is frozen" };
  }

  if (profile.openDisputes > 0) {
    return {
      allowed: false,
      reason: "User has open disputes"
    };
  }

  if (order.status !== "FUNDED") {
    return { allowed: false, reason: "Order must be funded before acceptance" };
  }

  const orderFiatMxn = getOrderTotalFiatMxn(order);

  if (!isWithinOrderLimit(profile.level, orderFiatMxn)) {
    return {
      allowed: false,
      reason: "Order exceeds reputation level order limit"
    };
  }

  if (
    !isWithinDailyLimit(
      profile.level,
      currentDailyVolumeFiatMxn,
      orderFiatMxn
    )
  ) {
    return {
      allowed: false,
      reason: "Order exceeds reputation level daily limit"
    };
  }

  return { allowed: true };
}
