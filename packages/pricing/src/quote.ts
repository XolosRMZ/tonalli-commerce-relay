import type { CommerceQuote, FiatAmount, XecAmount } from "@xolosarmy/models";
import type {
  CreateCommerceQuoteInput,
  CreateCommerceQuoteParams,
  PricingValidationResult
} from "./types";

export const DEFAULT_NETWORK_FEE_RESERVE_XEC: XecAmount = {
  amount: 100,
  currency: "XEC"
};

export const DEFAULT_QUOTE_TTL_MINUTES = 10;

export function validateCreateCommerceQuoteInput(
  input: CreateCommerceQuoteInput
): PricingValidationResult {
  if (
    !Number.isFinite(input.productCostFiat.amount) ||
    input.productCostFiat.amount <= 0
  ) {
    return {
      valid: false,
      reason: "Product cost fiat amount must be greater than 0"
    };
  }

  if (
    !Number.isFinite(input.intermediaryFeePercent) ||
    input.intermediaryFeePercent < 0
  ) {
    return {
      valid: false,
      reason: "Intermediary fee percent must be greater than or equal to 0"
    };
  }

  if (
    !Number.isFinite(input.platformFeePercent) ||
    input.platformFeePercent < 0
  ) {
    return {
      valid: false,
      reason: "Platform fee percent must be greater than or equal to 0"
    };
  }

  if (
    input.networkFeeReserveXec !== undefined &&
    (!Number.isFinite(input.networkFeeReserveXec.amount) ||
      input.networkFeeReserveXec.amount < 0)
  ) {
    return {
      valid: false,
      reason: "Network fee reserve XEC amount must be greater than or equal to 0"
    };
  }

  if (
    input.quoteTtlMinutes !== undefined &&
    (!Number.isFinite(input.quoteTtlMinutes) || input.quoteTtlMinutes <= 0)
  ) {
    return {
      valid: false,
      reason: "Quote TTL minutes must be greater than 0"
    };
  }

  return { valid: true };
}

export async function createCommerceQuote(
  params: CreateCommerceQuoteParams
): Promise<CommerceQuote> {
  const validation = validateCreateCommerceQuoteInput(params.input);

  if (!validation.valid) {
    throw new Error(validation.reason ?? "Invalid commerce quote input");
  }

  const { input, rateProvider } = params;
  const { productCostFiat } = input;
  const networkFeeReserveXec =
    input.networkFeeReserveXec ?? DEFAULT_NETWORK_FEE_RESERVE_XEC;
  const quoteTtlMinutes = input.quoteTtlMinutes ?? DEFAULT_QUOTE_TTL_MINUTES;
  const now = input.now ?? new Date();
  const rate = await rateProvider.getXecFiatRate(productCostFiat.currency);

  if (rate.fiatCurrency !== productCostFiat.currency) {
    throw new Error(
      `Rate currency ${rate.fiatCurrency} does not match product currency ${productCostFiat.currency}`
    );
  }

  // TODO: migrate pricing math to decimal/bignumber before production usage.
  const intermediaryFeeFiatAmount = roundFiat(
    (productCostFiat.amount * input.intermediaryFeePercent) / 100
  );
  const platformFeeFiatAmount = roundFiat(
    (productCostFiat.amount * input.platformFeePercent) / 100
  );
  const totalFiatAmount = roundFiat(
    productCostFiat.amount + intermediaryFeeFiatAmount + platformFeeFiatAmount
  );
  const productCostXecAmount = productCostFiat.amount * rate.xecPerFiatUnit;
  const feeXecAmount =
    (intermediaryFeeFiatAmount + platformFeeFiatAmount) * rate.xecPerFiatUnit;
  const totalXecAmount = roundXec(
    productCostXecAmount + feeXecAmount + networkFeeReserveXec.amount
  );
  const quotedAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + quoteTtlMinutes * 60 * 1000
  ).toISOString();

  return {
    productCostFiat: roundFiatAmount(productCostFiat),
    intermediaryFeeFiat: {
      amount: intermediaryFeeFiatAmount,
      currency: productCostFiat.currency
    },
    platformFeeFiat: {
      amount: platformFeeFiatAmount,
      currency: productCostFiat.currency
    },
    networkFeeReserveXec: {
      amount: roundXec(networkFeeReserveXec.amount),
      currency: "XEC"
    },
    totalFiat: {
      amount: totalFiatAmount,
      currency: productCostFiat.currency
    },
    totalXec: {
      amount: totalXecAmount,
      currency: "XEC"
    },
    rate: {
      fiatCurrency: rate.fiatCurrency,
      xecPerFiatUnit: rate.xecPerFiatUnit,
      source: rate.source,
      quotedAt,
      expiresAt
    }
  };
}

function roundFiat(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundXec(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundFiatAmount(amount: FiatAmount): FiatAmount {
  return {
    amount: roundFiat(amount.amount),
    currency: amount.currency
  };
}
