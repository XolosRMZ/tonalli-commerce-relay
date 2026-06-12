import type { CommerceOrder } from "@xolosarmy/models";
import { describe, expect, it } from "vitest";
import {
  canTransitionEscrowState,
  validateOrderCanResolveEscrow
} from "./state";

function order(overrides: Partial<CommerceOrder> = {}): CommerceOrder {
  return {
    id: "order-1",
    buyerUserId: "buyer-1",
    intermediaryUserId: "intermediary-1",
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
    status: "RELEASE_PENDING",
    escrow: {},
    disputeStatus: "none",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("canTransitionEscrowState", () => {
  it("allows WAITING_DEPOSIT -> FUNDED", () => {
    expect(canTransitionEscrowState({ from: "WAITING_DEPOSIT", to: "FUNDED" })).toEqual({ valid: true });
  });

  it("allows RELEASE_PENDING -> RELEASED with buyer_confirms_release", () => {
    expect(
      canTransitionEscrowState({ from: "RELEASE_PENDING", to: "RELEASED", route: "buyer_confirms_release" })
    ).toEqual({ valid: true });
  });

  it("rejects RELEASE_PENDING -> RELEASED without route", () => {
    expect(canTransitionEscrowState({ from: "RELEASE_PENDING", to: "RELEASED" }).valid).toBe(false);
  });
});

describe("validateOrderCanResolveEscrow", () => {
  it("allows buyer_confirms_release only when status RELEASE_PENDING", () => {
    expect(validateOrderCanResolveEscrow(order({ status: "RELEASE_PENDING" }), "buyer_confirms_release")).toEqual({ valid: true });
    expect(validateOrderCanResolveEscrow(order({ status: "DISPUTED" }), "buyer_confirms_release").valid).toBe(false);
  });

  it("allows arbitrator_refund_to_buyer only when status DISPUTED", () => {
    expect(validateOrderCanResolveEscrow(order({ status: "DISPUTED" }), "arbitrator_refund_to_buyer")).toEqual({ valid: true });
    expect(validateOrderCanResolveEscrow(order({ status: "RELEASE_PENDING" }), "arbitrator_refund_to_buyer").valid).toBe(false);
  });

  it("rejects voluntary_refund when status is not REFUND_PENDING", () => {
    expect(validateOrderCanResolveEscrow(order({ status: "RELEASE_PENDING" }), "voluntary_refund").valid).toBe(false);
  });
});
