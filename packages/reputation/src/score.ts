import type { ReputationLevel, ReputationProfile } from "@xolosarmy/models";

export function clampScore(score: number): number {
  return Math.min(1000, Math.max(0, score));
}

export function inferReputationLevel(
  profile: ReputationProfile
): ReputationLevel {
  if (
    profile.completedEligibleOrders >= 100 &&
    profile.totalVolumeFiatMxn >= 100000 &&
    profile.lostDisputes === 0
  ) {
    return "commercial_node";
  }

  if (
    profile.completedEligibleOrders >= 30 &&
    profile.totalVolumeFiatMxn >= 30000
  ) {
    return "tonalli_merchant";
  }

  if (
    profile.completedEligibleOrders >= 10 &&
    profile.totalVolumeFiatMxn >= 10000
  ) {
    return "trusted_intermediary";
  }

  if (profile.alias !== undefined) {
    return "alias_verified";
  }

  return "new";
}

export function calculateDisputeLossPenalty(
  profile: ReputationProfile
): number {
  if (profile.lostDisputes >= 5) {
    return 250;
  }

  if (profile.lostDisputes >= 2) {
    return 100;
  }

  return 50;
}
