import type { DisputeStatus } from "./dispute";
import type { CommerceQuote } from "./money";
import type { StoreProductReference } from "./store";

export type CommerceOrderStatus =
  | "WAITING_DEPOSIT"
  | "FUNDED"
  | "ACCEPTED"
  | "PURCHASED"
  | "SHIPPED"
  | "RELEASE_PENDING"
  | "RELEASED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "DISPUTED"
  | "CANCELLED";

export interface EscrowReference {
  escrowAddress?: string;
  escrowScriptHex?: string;
  depositTxid?: string;
  releaseTxid?: string;
  refundTxid?: string;
  nonce?: string;
}

export interface CommerceOrder {
  id: string;
  buyerUserId: string;
  intermediaryUserId?: string;
  arbitratorUserId?: string;
  moderatorUserId?: string;
  product: StoreProductReference;
  quote: CommerceQuote;
  status: CommerceOrderStatus;
  escrow: EscrowReference;
  disputeStatus: DisputeStatus;
  createdAt: string;
  updatedAt: string;
}
