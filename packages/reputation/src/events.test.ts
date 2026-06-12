import type { ReputationProfile } from "@xolosarmy/models";
import { describe, expect, it } from "vitest";
import {
  applyAccountFrozen,
  applyAccountUnfrozen,
  applyDisputeLost,
  applyDisputeOpened,
  applyOrderCompleted
} from "./events";
import type { ReputationEvent } from "./types";

function profile(overrides: Partial<ReputationProfile> = {}): ReputationProfile {
  return {
    userId: "user-1",
    address: "ecash:qptest",
    level: "alias_verified",
    score: 25,
    completedOrders: 0,
    completedEligibleOrders: 0,
    totalVolumeXec: 0,
    totalVolumeFiatMxn: 0,
    openDisputes: 0,
    wonDisputes: 0,
    lostDisputes: 0,
    limits: { maxOrderFiatMxn: 1000, maxDailyFiatMxn: 2000 },
    isFrozen: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function event(overrides: Partial<ReputationEvent> = {}): ReputationEvent {
  return {
    type: "order_completed",
    userId: "user-1",
    orderId: "order-1",
    volumeXec: 900000,
    volumeFiatMxn: 300,
    occurredAt: "2026-01-01T00:10:00.000Z",
    ...overrides
  };
}

describe("reputation events", () => {
  it("applyOrderCompleted does not mutate original profile", () => {
    const original = profile();
    const snapshot = { ...original };

    applyOrderCompleted(original, event());

    expect(original).toEqual(snapshot);
  });

  it("applyOrderCompleted increments completedOrders, volume, and score", () => {
    const result = applyOrderCompleted(profile(), event());

    expect(result.profile.completedOrders).toBe(1);
    expect(result.profile.totalVolumeXec).toBe(900000);
    expect(result.profile.totalVolumeFiatMxn).toBe(300);
    expect(result.profile.score).toBe(35);
  });

  it("applyDisputeOpened increments openDisputes and lowers score without going below 0", () => {
    const result = applyDisputeOpened(profile({ score: 5 }), event({ type: "dispute_opened" }));

    expect(result.profile.openDisputes).toBe(1);
    expect(result.profile.score).toBe(0);
  });

  it("applyDisputeLost increments lostDisputes and lowers score without going below 0", () => {
    const result = applyDisputeLost(profile({ openDisputes: 1, score: 20 }), event({ type: "dispute_lost" }));

    expect(result.profile.openDisputes).toBe(0);
    expect(result.profile.lostDisputes).toBe(1);
    expect(result.profile.score).toBe(0);
  });

  it("applyAccountFrozen and applyAccountUnfrozen change isFrozen", () => {
    const frozen = applyAccountFrozen(profile(), event({ type: "account_frozen" }));
    const unfrozen = applyAccountUnfrozen(frozen.profile, event({ type: "account_unfrozen" }));

    expect(frozen.profile.isFrozen).toBe(true);
    expect(unfrozen.profile.isFrozen).toBe(false);
  });
});
