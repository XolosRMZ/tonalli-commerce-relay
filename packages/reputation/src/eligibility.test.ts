import type { CommerceOrder, ReputationProfile } from "@xolosarmy/models";
import { describe, expect, it } from "vitest";
import { canUserAcceptOrder, isOrderEligibleForReputation } from "./eligibility";

function profile(overrides: Partial<ReputationProfile> = {}): ReputationProfile {
  return {
    userId: "user-1",
    address: "ecash:qptest",
    level: "alias_verified",
    score: 100,
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

function order(overrides: Partial<CommerceOrder> = {}): CommerceOrder {
  return {
    id: "order-1",
    buyerUserId: "buyer-1",
    intermediaryUserId: "user-1",
    product: { provider: "other", productUrl: "https://example.test/product", quantity: 1 },
    quote: {
      productCostFiat: { amount: 300, currency: "MXN" },
      intermediaryFeeFiat: { amount: 15, currency: "MXN" },
      platformFeeFiat: { amount: 3, currency: "MXN" },
      networkFeeReserveXec: { amount: 100, currency: "XEC" },
      totalFiat: { amount: 318, currency: "MXN" },
      totalXec: { amount: 954100, currency: "XEC" },
      rate: {
        fiatCurrency: "MXN",
        xecPerFiatUnit: 3000,
        source: "test",
        quotedAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-01T00:10:00.000Z"
      }
    },
    status: "FUNDED",
    escrow: {},
    disputeStatus: "none",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("canUserAcceptOrder", () => {
  it("allows user not frozen, without open disputes, status FUNDED, and within limits", () => {
    expect(
      canUserAcceptOrder({ profile: profile(), order: order(), currentDailyVolumeFiatMxn: 0 })
    ).toEqual({ allowed: true });
  });

  it("rejects profile.isFrozen", () => {
    const result = canUserAcceptOrder({
      profile: profile({ isFrozen: true }),
      order: order(),
      currentDailyVolumeFiatMxn: 0
    });

    expect(result.allowed).toBe(false);
  });

  it("rejects openDisputes > 0", () => {
    const result = canUserAcceptOrder({
      profile: profile({ openDisputes: 1 }),
      order: order(),
      currentDailyVolumeFiatMxn: 0
    });

    expect(result.allowed).toBe(false);
  });

  it("rejects order.status other than FUNDED", () => {
    const result = canUserAcceptOrder({
      profile: profile(),
      order: order({ status: "ACCEPTED" }),
      currentDailyVolumeFiatMxn: 0
    });

    expect(result.allowed).toBe(false);
  });
});

describe("isOrderEligibleForReputation", () => {
  it("requires status RELEASED", () => {
    const result = isOrderEligibleForReputation(order({ status: "FUNDED" }));

    expect(result.eligible).toBe(false);
  });

  it("rejects order below 300 MXN", () => {
    const result = isOrderEligibleForReputation(
      order({ status: "RELEASED", quote: { ...order().quote, totalFiat: { amount: 299, currency: "MXN" } } })
    );

    expect(result.eligible).toBe(false);
  });
});
