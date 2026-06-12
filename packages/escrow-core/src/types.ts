import type { CommerceOrder, CommerceOrderStatus } from "@xolosarmy/models";

export type EscrowRole =
  | "buyer"
  | "intermediary"
  | "arbitrator"
  | "moderator";

export interface EscrowParticipant {
  role: EscrowRole;
  userId: string;
  address: string;
  publicKey?: string;
}

export interface EscrowParticipants {
  buyer: EscrowParticipant;
  intermediary?: EscrowParticipant;
  arbitrator?: EscrowParticipant;
  moderator?: EscrowParticipant;
}

export type EscrowResolutionRoute =
  | "buyer_confirms_release"
  | "voluntary_refund"
  | "arbitrator_release_to_intermediary"
  | "arbitrator_refund_to_buyer"
  | "moderator_release_to_intermediary"
  | "moderator_refund_to_buyer";

export type EscrowOutputTarget =
  | "buyer"
  | "intermediary"
  | "platform"
  | "miner_fee";

export interface EscrowOutput {
  target: EscrowOutputTarget;
  address?: string;
  amountXec: number;
}

export interface EscrowBuildContext {
  order: CommerceOrder;
  participants: EscrowParticipants;
  platformAddress?: string;
  networkFeeReserveXec: number;
}

export interface EscrowScriptDraft {
  escrowAddress?: string;
  escrowScriptHex?: string;
  escrowScriptHash?: string;
  nonce: string;
  participants: EscrowParticipants;
  createdAt: string;
  TODO_IMPLEMENTATION: "ecash-lib-and-chronik-required";
}

export interface EscrowTransactionDraft {
  route: EscrowResolutionRoute;
  orderId: string;
  unsignedTxHex?: string;
  outputs: EscrowOutput[];
  requiredSigners: EscrowRole[];
  networkFeeXec: number;
  createdAt: string;
  TODO_IMPLEMENTATION: "ecash-lib-and-chronik-required";
}

export interface EscrowValidationResult {
  valid: boolean;
  reason?: string;
}

export interface EscrowStateTransition {
  from: CommerceOrderStatus;
  to: CommerceOrderStatus;
  route?: EscrowResolutionRoute;
}
