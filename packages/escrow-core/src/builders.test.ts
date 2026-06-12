import type { CommerceOrder } from "@xolosarmy/models";
import { describe, expect, it } from "vitest";
import {
  createEscrowScriptDraft,
  createEscrowTransactionDraft
} from "./builders";
import type { EscrowBuildContext } from "./types";

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

function context(overrides: Partial<EscrowBuildContext> = {}): EscrowBuildContext {
  return {
    order: order(),
    participants: {
      buyer: { role: "buyer", userId: "buyer-1", address: "ecash:qbuyer" },
      intermediary: { role: "intermediary", userId: "intermediary-1", address: "ecash:qintermediary" }
    },
    platformAddress: "ecash:qplatform",
    networkFeeReserveXec: 100,
    ...overrides
  };
}

describe("createEscrowScriptDraft", () => {
  it("returns TODO_IMPLEMENTATION and nonce", () => {
    const draft = createEscrowScriptDraft(context());

    expect(draft.TODO_IMPLEMENTATION).toBe("ecash-lib-and-chronik-required");
    expect(draft.nonce).toContain("order-1:");
  });
});

describe("createEscrowTransactionDraft", () => {
  it("for buyer_confirms_release creates main output to intermediary and miner_fee", () => {
    const draft = createEscrowTransactionDraft({ context: context(), route: "buyer_confirms_release" });

    expect(draft.outputs).toEqual([
      { target: "intermediary", address: "ecash:qintermediary", amountXec: 954000 },
      { target: "miner_fee", amountXec: 100 }
    ]);
  });

  it("for voluntary_refund creates main output to buyer", () => {
    const draft = createEscrowTransactionDraft({ context: context(), route: "voluntary_refund" });

    expect(draft.outputs[0]).toEqual({ target: "buyer", address: "ecash:qbuyer", amountXec: 954000 });
  });

  it("fails when networkFeeXec is greater than totalXec", () => {
    expect(() =>
      createEscrowTransactionDraft({ context: context(), route: "buyer_confirms_release", networkFeeXec: 954101 })
    ).toThrow("Escrow transaction draft principal amount cannot be negative");
  });
});
