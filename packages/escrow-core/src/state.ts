import type { CommerceOrder, CommerceOrderStatus } from "@xolosarmy/models";
import type {
  EscrowResolutionRoute,
  EscrowValidationResult
} from "./types";

export const ALLOWED_ESCROW_STATE_TRANSITIONS: Array<{
  from: CommerceOrderStatus;
  to: CommerceOrderStatus;
  route?: EscrowResolutionRoute;
}> = [
  { from: "WAITING_DEPOSIT", to: "FUNDED" },
  { from: "FUNDED", to: "ACCEPTED" },
  { from: "ACCEPTED", to: "PURCHASED" },
  { from: "PURCHASED", to: "SHIPPED" },
  { from: "PURCHASED", to: "RELEASE_PENDING" },
  { from: "SHIPPED", to: "RELEASE_PENDING" },
  {
    from: "RELEASE_PENDING",
    to: "RELEASED",
    route: "buyer_confirms_release"
  },
  { from: "RELEASE_PENDING", to: "DISPUTED" },
  {
    from: "DISPUTED",
    to: "RELEASED",
    route: "arbitrator_release_to_intermediary"
  },
  {
    from: "DISPUTED",
    to: "REFUNDED",
    route: "arbitrator_refund_to_buyer"
  },
  {
    from: "DISPUTED",
    to: "RELEASED",
    route: "moderator_release_to_intermediary"
  },
  {
    from: "DISPUTED",
    to: "REFUNDED",
    route: "moderator_refund_to_buyer"
  },
  { from: "FUNDED", to: "REFUND_PENDING" },
  { from: "ACCEPTED", to: "REFUND_PENDING" },
  { from: "REFUND_PENDING", to: "REFUNDED", route: "voluntary_refund" },
  { from: "WAITING_DEPOSIT", to: "CANCELLED" }
];

export function canTransitionEscrowState(params: {
  from: CommerceOrderStatus;
  to: CommerceOrderStatus;
  route?: EscrowResolutionRoute;
}): EscrowValidationResult {
  const allowed = ALLOWED_ESCROW_STATE_TRANSITIONS.some((transition) => {
    return (
      transition.from === params.from &&
      transition.to === params.to &&
      transition.route === params.route
    );
  });

  if (!allowed) {
    const routeLabel = params.route ? ` using route ${params.route}` : "";

    return {
      valid: false,
      reason: `Escrow state cannot transition from ${params.from} to ${params.to}${routeLabel}`
    };
  }

  return { valid: true };
}

export function validateOrderCanResolveEscrow(
  order: CommerceOrder,
  route: EscrowResolutionRoute
): EscrowValidationResult {
  if (route === "buyer_confirms_release") {
    return order.status === "RELEASE_PENDING"
      ? { valid: true }
      : {
          valid: false,
          reason:
            "buyer_confirms_release requires order status RELEASE_PENDING"
        };
  }

  if (route === "voluntary_refund") {
    return order.status === "REFUND_PENDING"
      ? { valid: true }
      : {
          valid: false,
          reason: "voluntary_refund requires order status REFUND_PENDING"
        };
  }

  if (
    route === "arbitrator_release_to_intermediary" ||
    route === "arbitrator_refund_to_buyer" ||
    route === "moderator_release_to_intermediary" ||
    route === "moderator_refund_to_buyer"
  ) {
    return order.status === "DISPUTED"
      ? { valid: true }
      : {
          valid: false,
          reason: `${route} requires order status DISPUTED`
        };
  }

  return {
    valid: false,
    reason: `Unsupported escrow resolution route ${route}`
  };
}
