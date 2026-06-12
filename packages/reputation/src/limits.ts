import type { ReputationLevel, ReputationLimits } from "@xolosarmy/models";
import { DEFAULT_REPUTATION_LIMITS } from "@xolosarmy/models";

export function getReputationLimits(level: ReputationLevel): ReputationLimits {
  return DEFAULT_REPUTATION_LIMITS[level];
}

export function isWithinOrderLimit(
  level: ReputationLevel,
  orderFiatMxn: number
): boolean {
  if (orderFiatMxn < 0) {
    return false;
  }

  return orderFiatMxn <= getReputationLimits(level).maxOrderFiatMxn;
}

export function isWithinDailyLimit(
  level: ReputationLevel,
  currentDailyVolumeFiatMxn: number,
  orderFiatMxn: number
): boolean {
  if (currentDailyVolumeFiatMxn < 0 || orderFiatMxn < 0) {
    return false;
  }

  return (
    currentDailyVolumeFiatMxn + orderFiatMxn <=
    getReputationLimits(level).maxDailyFiatMxn
  );
}
