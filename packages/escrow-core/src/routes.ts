import type {
  EscrowOutputTarget,
  EscrowResolutionRoute,
  EscrowRole
} from "./types";

export interface EscrowRoutePolicy {
  route: EscrowResolutionRoute;
  requiredSigners: EscrowRole[];
  outputTarget: EscrowOutputTarget;
  description: string;
}

export const ESCROW_ROUTE_POLICIES: Record<
  EscrowResolutionRoute,
  EscrowRoutePolicy
> = {
  buyer_confirms_release: {
    route: "buyer_confirms_release",
    requiredSigners: ["buyer", "intermediary"],
    outputTarget: "intermediary",
    description: "Buyer and intermediary approve release to the intermediary."
  },
  voluntary_refund: {
    route: "voluntary_refund",
    requiredSigners: ["buyer", "intermediary"],
    outputTarget: "buyer",
    description: "Buyer and intermediary approve a voluntary refund to buyer."
  },
  arbitrator_release_to_intermediary: {
    route: "arbitrator_release_to_intermediary",
    requiredSigners: ["arbitrator", "intermediary"],
    outputTarget: "intermediary",
    description: "Arbitrator resolves dispute by releasing funds to intermediary."
  },
  arbitrator_refund_to_buyer: {
    route: "arbitrator_refund_to_buyer",
    requiredSigners: ["arbitrator", "buyer"],
    outputTarget: "buyer",
    description: "Arbitrator resolves dispute by refunding funds to buyer."
  },
  moderator_release_to_intermediary: {
    route: "moderator_release_to_intermediary",
    requiredSigners: ["moderator", "intermediary"],
    outputTarget: "intermediary",
    description: "Moderator resolves dispute by releasing funds to intermediary."
  },
  moderator_refund_to_buyer: {
    route: "moderator_refund_to_buyer",
    requiredSigners: ["moderator", "buyer"],
    outputTarget: "buyer",
    description: "Moderator resolves dispute by refunding funds to buyer."
  }
};

export function getEscrowRoutePolicy(
  route: EscrowResolutionRoute
): EscrowRoutePolicy {
  return ESCROW_ROUTE_POLICIES[route];
}
