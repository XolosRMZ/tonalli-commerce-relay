export type FiatCurrency = "MXN" | "USD";

export type CryptoCurrency = "XEC";

export interface FiatAmount {
  amount: number;
  currency: FiatCurrency;
}

export interface XecAmount {
  amount: number;
  currency: "XEC";
}

export interface CommerceQuote {
  productCostFiat: FiatAmount;
  intermediaryFeeFiat: FiatAmount;
  platformFeeFiat: FiatAmount;
  networkFeeReserveXec: XecAmount;
  totalFiat: FiatAmount;
  totalXec: XecAmount;
  rate: {
    fiatCurrency: FiatCurrency;
    xecPerFiatUnit: number;
    source: string;
    quotedAt: string;
    expiresAt: string;
  };
}
