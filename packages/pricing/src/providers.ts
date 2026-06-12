import type { FiatCurrency } from "@xolosarmy/models";
import type { PricingRateProvider, XecFiatRate } from "./types";

export class StaticPricingRateProvider implements PricingRateProvider {
  private readonly rates: Record<FiatCurrency, XecFiatRate>;

  constructor(rates: Record<FiatCurrency, XecFiatRate>) {
    this.rates = rates;
  }

  async getXecFiatRate(currency: FiatCurrency): Promise<XecFiatRate> {
    const rate = this.rates[currency];

    if (!rate) {
      throw new Error(`Missing XEC fiat rate for ${currency}`);
    }

    return rate;
  }
}
