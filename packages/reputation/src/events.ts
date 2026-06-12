import type { ReputationProfile } from "@xolosarmy/models";
import type { ReputationEvent, ReputationUpdateResult } from "./types";
import { clampScore } from "./score";

export function applyOrderCompleted(
  profile: ReputationProfile,
  event: ReputationEvent
): ReputationUpdateResult {
  return {
    profile: {
      ...profile,
      completedOrders: profile.completedOrders + 1,
      totalVolumeXec: profile.totalVolumeXec + (event.volumeXec ?? 0),
      totalVolumeFiatMxn:
        profile.totalVolumeFiatMxn + (event.volumeFiatMxn ?? 0),
      score: clampScore(profile.score + 10),
      updatedAt: event.occurredAt
    },
    event
  };
}

export function applyEligibleOrderCompleted(
  profile: ReputationProfile,
  event: ReputationEvent
): ReputationUpdateResult {
  return {
    profile: {
      ...profile,
      completedEligibleOrders: profile.completedEligibleOrders + 1,
      score: clampScore(profile.score + 15),
      updatedAt: event.occurredAt
    },
    event
  };
}

export function applyDisputeOpened(
  profile: ReputationProfile,
  event: ReputationEvent
): ReputationUpdateResult {
  return {
    profile: {
      ...profile,
      openDisputes: profile.openDisputes + 1,
      score: clampScore(profile.score - 10),
      updatedAt: event.occurredAt
    },
    event
  };
}

export function applyDisputeWon(
  profile: ReputationProfile,
  event: ReputationEvent
): ReputationUpdateResult {
  return {
    profile: {
      ...profile,
      openDisputes: Math.max(0, profile.openDisputes - 1),
      wonDisputes: profile.wonDisputes + 1,
      score: clampScore(profile.score + 5),
      updatedAt: event.occurredAt
    },
    event
  };
}

export function applyDisputeLost(
  profile: ReputationProfile,
  event: ReputationEvent
): ReputationUpdateResult {
  return {
    profile: {
      ...profile,
      openDisputes: Math.max(0, profile.openDisputes - 1),
      lostDisputes: profile.lostDisputes + 1,
      score: clampScore(profile.score - 50),
      updatedAt: event.occurredAt
    },
    event
  };
}

export function applyAccountFrozen(
  profile: ReputationProfile,
  event: ReputationEvent
): ReputationUpdateResult {
  return {
    profile: {
      ...profile,
      isFrozen: true,
      updatedAt: event.occurredAt
    },
    event
  };
}

export function applyAccountUnfrozen(
  profile: ReputationProfile,
  event: ReputationEvent
): ReputationUpdateResult {
  return {
    profile: {
      ...profile,
      isFrozen: false,
      updatedAt: event.occurredAt
    },
    event
  };
}
