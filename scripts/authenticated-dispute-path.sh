#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/authenticated-common.sh"
trap cleanup_auth_cookies EXIT
require_jq

authenticate_role "buyer" "$BUYER_COOKIE_JAR" "$BUYER_ADDRESS" "$BUYER_ALIAS"
authenticate_role "intermediary" "$INTERMEDIARY_COOKIE_JAR" "$INTERMEDIARY_ADDRESS" "$INTERMEDIARY_ALIAS"
authenticate_role "arbitrator" "$ARBITRATOR_COOKIE_JAR" "$ARBITRATOR_ADDRESS" "devarb.xec"

print_step "Create quote"
quote_response="$(create_quote)"
print_response "$quote_response"
quote_json="$(jq -c '.quote' <<<"$quote_response")"

print_step "Buyer creates order"
order_response="$(
  post_json_with_cookies "$BUYER_COOKIE_JAR" "/api/orders" "$(jq -n \
    --arg buyerUserId "$BUYER_USER_ID" \
    --arg buyerAddress "$BUYER_ADDRESS" \
    --arg buyerAlias "$BUYER_ALIAS" \
    --argjson quote "$quote_json" \
    '{
      buyerUserId: $buyerUserId,
      buyerAddress: $buyerAddress,
      buyerAlias: $buyerAlias,
      product: { provider: "amazon_mx", productUrl: "https://example.invalid/dev-product", title: "Authenticated dispute product", quantity: 1 },
      quote: $quote
    }'
  )"
)"
print_response "$order_response"
order_id="$(jq -r '.order.id' <<<"$order_response")"

fund_payload="$(jq -n \
  --arg buyerUserId "$BUYER_USER_ID" \
  --arg buyerAddress "$BUYER_ADDRESS" \
  --arg buyerPublicKey "$BUYER_PUBLIC_KEY" \
  '{ buyer: { userId: $buyerUserId, address: $buyerAddress, publicKey: $buyerPublicKey }, simulatedDepositTxid: "dev-authenticated-dispute-deposit-txid" }'
)"
print_step "Buyer funds order"
fund_response="$(post_json_with_cookies "$BUYER_COOKIE_JAR" "/api/orders/${order_id}/fund" "$fund_payload")"
print_response "$fund_response"
assert_jq "$fund_response" '.order.status == "FUNDED"' "order was not funded"

accept_payload="$(jq -n \
  --arg intermediaryUserId "$INTERMEDIARY_USER_ID" \
  --arg intermediaryAddress "$INTERMEDIARY_ADDRESS" \
  --arg intermediaryAlias "$INTERMEDIARY_ALIAS" \
  --arg updatedAt "$DEMO_TIMESTAMP" \
  '{
    intermediary: { userId: $intermediaryUserId, address: $intermediaryAddress, alias: $intermediaryAlias },
    reputationProfile: {
      userId: $intermediaryUserId,
      alias: $intermediaryAlias,
      address: $intermediaryAddress,
      level: "alias_verified",
      score: 25,
      completedOrders: 3,
      completedEligibleOrders: 2,
      totalVolumeXec: 500000,
      totalVolumeFiatMxn: 1200,
      openDisputes: 0,
      wonDisputes: 0,
      lostDisputes: 0,
      limits: { maxOrderFiatMxn: 1000, maxDailyFiatMxn: 2000 },
      isFrozen: false,
      updatedAt: $updatedAt
    },
    currentDailyVolumeFiatMxn: 0
  }'
)"
print_step "Intermediary accepts order"
accept_response="$(post_json_with_cookies "$INTERMEDIARY_COOKIE_JAR" "/api/orders/${order_id}/accept" "$accept_payload")"
print_response "$accept_response"
assert_jq "$accept_response" '.order.status == "ACCEPTED"' "order was not accepted"

purchase_payload="$(jq -n \
  --arg intermediaryUserId "$INTERMEDIARY_USER_ID" \
  --arg purchasedAt "$DEMO_TIMESTAMP" \
  '{ intermediaryUserId: $intermediaryUserId, evidence: { type: "receipt", uri: "https://example.invalid/auth-dispute-receipt.png" }, externalOrderId: "AUTH-DISPUTE-123456", purchasedAt: $purchasedAt }'
)"
print_step "Intermediary submits purchase evidence"
purchase_response="$(post_json_with_cookies "$INTERMEDIARY_COOKIE_JAR" "/api/orders/${order_id}/purchase" "$purchase_payload")"
print_response "$purchase_response"
assert_jq "$purchase_response" '.order.status == "PURCHASED"' "order was not purchased"

ship_payload="$(jq -n \
  --arg intermediaryUserId "$INTERMEDIARY_USER_ID" \
  --arg shippedAt "$DEMO_TIMESTAMP" \
  '{ intermediaryUserId: $intermediaryUserId, tracking: { carrier: "DEV_CARRIER", trackingNumber: "AUTH-DISPUTE-TRACK" }, shippedAt: $shippedAt }'
)"
print_step "Intermediary ships order"
ship_response="$(post_json_with_cookies "$INTERMEDIARY_COOKIE_JAR" "/api/orders/${order_id}/ship" "$ship_payload")"
print_response "$ship_response"
assert_jq "$ship_response" '.order.status == "SHIPPED"' "order was not shipped"

dispute_payload="$(jq -n \
  --arg openedByUserId "$BUYER_USER_ID" \
  --arg openedAt "$DEMO_TIMESTAMP" \
  '{ openedByUserId: $openedByUserId, reason: "Product not received", evidence: [{ type: "conversation", uri: "https://example.invalid/auth-dispute-evidence" }], openedAt: $openedAt }'
)"
expect_forbidden_with_cookies "$INTERMEDIARY_COOKIE_JAR" "/api/orders/${order_id}/dispute" "$dispute_payload" "intermediary was allowed to open dispute as buyer"

print_step "Buyer opens dispute"
dispute_response="$(post_json_with_cookies "$BUYER_COOKIE_JAR" "/api/orders/${order_id}/dispute" "$dispute_payload")"
print_response "$dispute_response"
assert_jq "$dispute_response" '.order.status == "DISPUTED"' "dispute did not open"

resolve_payload="$(jq -n \
  --arg resolvedByUserId "$ARBITRATOR_USER_ID" \
  --arg buyerUserId "$BUYER_USER_ID" \
  --arg buyerAddress "$BUYER_ADDRESS" \
  --arg buyerPublicKey "$BUYER_PUBLIC_KEY" \
  --arg intermediaryUserId "$INTERMEDIARY_USER_ID" \
  --arg intermediaryAddress "$INTERMEDIARY_ADDRESS" \
  --arg intermediaryPublicKey "$INTERMEDIARY_PUBLIC_KEY" \
  --arg arbitratorUserId "$ARBITRATOR_USER_ID" \
  --arg arbitratorAddress "$ARBITRATOR_ADDRESS" \
  --arg arbitratorPublicKey "$ARBITRATOR_PUBLIC_KEY" \
  --arg resolvedAt "$DEMO_TIMESTAMP" \
  '{
    resolvedByUserId: $resolvedByUserId,
    resolution: "refund_to_buyer",
    authority: "arbitrator",
    buyer: { userId: $buyerUserId, address: $buyerAddress, publicKey: $buyerPublicKey },
    intermediary: { userId: $intermediaryUserId, address: $intermediaryAddress, publicKey: $intermediaryPublicKey },
    arbitrator: { userId: $arbitratorUserId, address: $arbitratorAddress, publicKey: $arbitratorPublicKey },
    networkFeeXec: 10,
    simulatedTxid: "dev-authenticated-dispute-resolution-txid",
    resolvedAt: $resolvedAt
  }'
)"
expect_forbidden_with_cookies "$BUYER_COOKIE_JAR" "/api/orders/${order_id}/resolve-dispute" "$resolve_payload" "buyer was allowed to resolve dispute as arbitrator"

print_step "Arbitrator resolves dispute"
resolve_response="$(post_json_with_cookies "$ARBITRATOR_COOKIE_JAR" "/api/orders/${order_id}/resolve-dispute" "$resolve_payload")"
print_response "$resolve_response"
assert_jq "$resolve_response" '.order.status == "REFUNDED"' "dispute resolution did not refund order"

printf '\nAuthenticated dispute path completed successfully\n'
