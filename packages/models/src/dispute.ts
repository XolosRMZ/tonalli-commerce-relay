export type DisputeStatus =
  | "none"
  | "opened"
  | "under_review"
  | "resolved_buyer"
  | "resolved_intermediary"
  | "cancelled";

export type DisputeResolution =
  | "release_to_intermediary"
  | "refund_to_buyer"
  | "partial_resolution"
  | "no_action";

export interface DisputeEvidence {
  type:
    | "receipt"
    | "tracking"
    | "delivery_confirmation"
    | "conversation"
    | "txid"
    | "other";
  uri?: string;
  hash?: string;
  submittedByUserId: string;
  submittedAt: string;
}

export interface CommerceDispute {
  id: string;
  orderId: string;
  status: DisputeStatus;
  openedByUserId: string;
  reason: string;
  evidence: DisputeEvidence[];
  resolution?: DisputeResolution;
  resolvedByUserId?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}
