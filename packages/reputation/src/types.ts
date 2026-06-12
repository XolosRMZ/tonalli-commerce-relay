import type { CommerceOrder, ReputationProfile } from "@xolosarmy/models";

export type ReputationEventType =
  | "order_completed"
  | "eligible_order_completed"
  | "dispute_opened"
  | "dispute_won"
  | "dispute_lost"
  | "account_frozen"
  | "account_unfrozen";

export interface ReputationEvent {
  type: ReputationEventType;
  userId: string;
  orderId?: string;
  volumeXec?: number;
  volumeFiatMxn?: number;
  occurredAt: string;
  reason?: string;
}

export interface ReputationDecision {
  allowed: boolean;
  reason?: string;
}

export interface ReputationUpdateResult {
  profile: ReputationProfile;
  event: ReputationEvent;
}

export interface OrderEligibilityResult {
  eligible: boolean;
  reason?: string;
}

export interface CanAcceptOrderParams {
  profile: ReputationProfile;
  order: CommerceOrder;
  currentDailyVolumeFiatMxn: number;
}
