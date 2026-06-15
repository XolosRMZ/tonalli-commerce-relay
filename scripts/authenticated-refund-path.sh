#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/authenticated-common.sh"
trap cleanup_auth_cookies EXIT
require_jq

authenticate_role "buyer" "$BUYER_COOKIE_JAR" "$BUYER_ADDRESS" "$BUYER_ALIAS"
authenticate_role "intermediary" "$INTERMEDIARY_COOKIE_JAR" "$INTERMEDIARY_ADDRESS" "$INTERMEDIARY_ALIAS"

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
      product: { provider: "amazon_mx", productUrl: "https://example.invalid/dev-product", title: "Authenticated refund product", quantity: 1 },
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
  '{ buyer: { userId: $buyerUserId, address: $buyerAddress, publicKey: $buyerPublicKey }, simulatedDepositTxid: "dev-authenticated-refund-deposit-txid" }'
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

refund_request_payload="$(jq -n \
  --arg requestedByUserId "$INTERMEDIARY_USER_ID" \
  --arg requestedAt "$DEMO_TIMESTAMP" \
  '{ requestedByUserId: $requestedByUserId, reason: "Product out of stock", requestedAt: $requestedAt }'
)"
expect_forbidden_with_cookies "$BUYER_COOKIE_JAR" "/api/orders/${order_id}/refund-request" "$refund_request_payload" "buyer was allowed to submit intermediary refund request"

print_step "Intermediary requests refund"
refund_request_response="$(post_json_with_cookies "$INTERMEDIARY_COOKIE_JAR" "/api/orders/${order_id}/refund-request" "$refund_request_payload")"
print_response "$refund_request_response"
assert_jq "$refund_request_response" '.order.status == "REFUND_PENDING"' "refund request failed"

refund_payload="$(jq -n \
  --arg buyerUserId "$BUYER_USER_ID" \
  --arg buyerAddress "$BUYER_ADDRESS" \
  --arg buyerPublicKey "$BUYER_PUBLIC_KEY" \
  --arg intermediaryUserId "$INTERMEDIARY_USER_ID" \
  --arg intermediaryAddress "$INTERMEDIARY_ADDRESS" \
  --arg intermediaryPublicKey "$INTERMEDIARY_PUBLIC_KEY" \
  '{
    buyerUserId: $buyerUserId,
    buyer: { userId: $buyerUserId, address: $buyerAddress, publicKey: $buyerPublicKey },
    intermediary: { userId: $intermediaryUserId, address: $intermediaryAddress, publicKey: $intermediaryPublicKey },
    simulatedRefundTxid: "dev-authenticated-refund-txid",
    networkFeeXec: 10
  }'
)"
print_step "Intermediary completes refund"
refund_response="$(post_json_with_cookies "$INTERMEDIARY_COOKIE_JAR" "/api/orders/${order_id}/refund" "$refund_payload")"
print_response "$refund_response"
assert_jq "$refund_response" '.order.status == "REFUNDED"' "order was not refunded"

printf '\nAuthenticated refund path completed successfully\n'
