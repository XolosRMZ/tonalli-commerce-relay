export type ReputationLevel =
  | "new"
  | "alias_verified"
  | "trusted_intermediary"
  | "tonalli_merchant"
  | "commercial_node";

export interface ReputationLimits {
  maxOrderFiatMxn: number;
  maxDailyFiatMxn: number;
}

export interface ReputationProfile {
  userId: string;
  alias?: string;
  address: string;
  level: ReputationLevel;
  score: number;
  completedOrders: number;
  completedEligibleOrders: number;
  totalVolumeXec: number;
  totalVolumeFiatMxn: number;
  openDisputes: number;
  wonDisputes: number;
  lostDisputes: number;
  limits: ReputationLimits;
  isFrozen: boolean;
  updatedAt: string;
}

export const DEFAULT_REPUTATION_LIMITS: Record<
  ReputationLevel,
  ReputationLimits
> = {
  new: {
    maxOrderFiatMxn: 300,
    maxDailyFiatMxn: 500
  },
  alias_verified: {
    maxOrderFiatMxn: 1000,
    maxDailyFiatMxn: 2000
  },
  trusted_intermediary: {
    maxOrderFiatMxn: 3000,
    maxDailyFiatMxn: 7500
  },
  tonalli_merchant: {
    maxOrderFiatMxn: 10000,
    maxDailyFiatMxn: 25000
  },
  commercial_node: {
    maxOrderFiatMxn: Number.MAX_SAFE_INTEGER,
    maxDailyFiatMxn: Number.MAX_SAFE_INTEGER
  }
};
