import { getEscrowRoutePolicy } from "./routes";
import type {
  EscrowBuildContext,
  EscrowOutputTarget,
  EscrowResolutionRoute,
  EscrowScriptDraft,
  EscrowTransactionDraft
} from "./types";

export function createEscrowScriptDraft(
  context: EscrowBuildContext
): EscrowScriptDraft {
  if (!context.participants.buyer) {
    throw new Error("Escrow script draft requires a buyer participant");
  }

  if (!context.order.id) {
    throw new Error("Escrow script draft requires an order id");
  }

  // TODO: replace with ecash-lib script builder inspired by local-ecash.
  // This deterministic placeholder nonce is not safe for production use.
  const nonce = `${context.order.id}:${Date.now()}`;

  return {
    nonce,
    participants: context.participants,
    createdAt: new Date().toISOString(),
    TODO_IMPLEMENTATION: "ecash-lib-and-chronik-required"
  };
}

export function createEscrowTransactionDraft(params: {
  context: EscrowBuildContext;
  route: EscrowResolutionRoute;
  networkFeeXec?: number;
}): EscrowTransactionDraft {
  const { context, route } = params;
  const policy = getEscrowRoutePolicy(route);
  const networkFeeXec = params.networkFeeXec ?? context.networkFeeReserveXec;
  const principalAmountXec = context.order.quote.totalXec.amount - networkFeeXec;
  const outputTarget = getParticipantOutputTarget(policy.outputTarget);
  const recipient = context.participants[outputTarget];

  if (!recipient) {
    throw new Error(
      `Escrow transaction draft requires ${policy.outputTarget} participant`
    );
  }

  if (principalAmountXec < 0) {
    throw new Error("Escrow transaction draft principal amount cannot be negative");
  }

  // TODO: split real platform fees when transaction construction is implemented.
  void context.platformAddress;

  return {
    route,
    orderId: context.order.id,
    outputs: [
      {
        target: outputTarget,
        address: recipient.address,
        amountXec: principalAmountXec
      },
      {
        target: "miner_fee",
        amountXec: networkFeeXec
      }
    ],
    requiredSigners: policy.requiredSigners,
    networkFeeXec,
    createdAt: new Date().toISOString(),
    TODO_IMPLEMENTATION: "ecash-lib-and-chronik-required"
  };
}

function getParticipantOutputTarget(
  outputTarget: EscrowOutputTarget
): "buyer" | "intermediary" {
  if (outputTarget === "buyer" || outputTarget === "intermediary") {
    return outputTarget;
  }

  throw new Error(
    `Escrow route output target ${outputTarget} is not a participant payout target`
  );
}
