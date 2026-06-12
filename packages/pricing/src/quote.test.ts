import { describe, expect, it } from "vitest";
import { StaticPricingRateProvider } from "./providers";
import {
  DEFAULT_NETWORK_FEE_RESERVE_XEC,
  createCommerceQuote
} from "./quote";
import type { CreateCommerceQuoteInput } from "./types";

const rateProvider = new StaticPricingRateProvider({
  MXN: {
    fiatCurrency: "MXN",
    xecPerFiatUnit: 3000,
    source: "test",
    fetchedAt: "2026-01-01T00:00:00.000Z"
  },
  USD: {
    fiatCurrency: "USD",
    xecPerFiatUnit: 50000,
    source: "test",
    fetchedAt: "2026-01-01T00:00:00.000Z"
  }
});

function quoteInput(
  overrides: Partial<CreateCommerceQuoteInput> = {}
): CreateCommerceQuoteInput {
  return {
    productCostFiat: { amount: 100, currency: "MXN" },
    intermediaryFeePercent: 5,
    platformFeePercent: 1,
    now: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides
  };
}

describe("createCommerceQuote", () => {
  it("calculates totalFiat and totalXec using StaticPricingRateProvider", async () => {
    const quote = await createCommerceQuote({
      input: quoteInput(),
      rateProvider
    });

    expect(quote.totalFiat).toEqual({ amount: 106, currency: "MXN" });
    expect(quote.totalXec).toEqual({ amount: 318100, currency: "XEC" });
  });

  it("applies default networkFeeReserveXec when missing", async () => {
    const quote = await createCommerceQuote({
      input: quoteInput(),
      rateProvider
    });

    expect(quote.networkFeeReserveXec).toEqual(
      DEFAULT_NETWORK_FEE_RESERVE_XEC
    );
  });

  it("respects custom networkFeeReserveXec", async () => {
    const quote = await createCommerceQuote({
      input: quoteInput({
        networkFeeReserveXec: { amount: 250, currency: "XEC" }
      }),
      rateProvider
    });

    expect(quote.networkFeeReserveXec).toEqual({
      amount: 250,
      currency: "XEC"
    });
    expect(quote.totalXec).toEqual({ amount: 318250, currency: "XEC" });
  });

  it("fails when productCostFiat.amount <= 0", async () => {
    await expect(
      createCommerceQuote({
        input: quoteInput({ productCostFiat: { amount: 0, currency: "MXN" } }),
        rateProvider
      })
    ).rejects.toThrow("Product cost fiat amount must be greater than 0");
  });

  it("fails when intermediaryFeePercent is negative", async () => {
    await expect(
      createCommerceQuote({
        input: quoteInput({ intermediaryFeePercent: -1 }),
        rateProvider
      })
    ).rejects.toThrow(
      "Intermediary fee percent must be greater than or equal to 0"
    );
  });

  it("fails when platformFeePercent is negative", async () => {
    await expect(
      createCommerceQuote({
        input: quoteInput({ platformFeePercent: -1 }),
        rateProvider
      })
    ).rejects.toThrow(
      "Platform fee percent must be greater than or equal to 0"
    );
  });
});
