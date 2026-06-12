import type {
  CommerceQuote,
  FiatAmount,
  FiatCurrency,
  XecAmount
} from "@xolosarmy/models";

export interface XecFiatRate {
  fiatCurrency: FiatCurrency;
  xecPerFiatUnit: number;
  source: string;
  fetchedAt: string;
}

export interface PricingRateProvider {
  getXecFiatRate(currency: FiatCurrency): Promise<XecFiatRate>;
}

export interface CreateCommerceQuoteInput {
  productCostFiat: FiatAmount;
  intermediaryFeePercent: number;
  platformFeePercent: number;
  networkFeeReserveXec?: XecAmount;
  quoteTtlMinutes?: number;
  now?: Date;
}

export interface CreateCommerceQuoteParams {
  input: CreateCommerceQuoteInput;
  rateProvider: PricingRateProvider;
}

export interface PricingValidationResult {
  valid: boolean;
  reason?: string;
}

export type { CommerceQuote };
