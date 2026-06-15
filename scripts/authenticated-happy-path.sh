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
      product: {
        provider: "amazon_mx",
        productUrl: "https://example.invalid/dev-product",
        title: "Authenticated happy path product",
        quantity: 1
      },
      quote: $quote
    }'
  )"
)"
print_response "$order_response"
order_id="$(jq -r '.order.id' <<<"$order_response")"
assert_jq "$order_response" '.order.status == "WAITING_DEPOSIT"' "order was not created"

fund_payload="$(jq -n \
  --arg buyerUserId "$BUYER_USER_ID" \
  --arg buyerAddress "$BUYER_ADDRESS" \
  --arg buyerPublicKey "$BUYER_PUBLIC_KEY" \
  '{
    buyer: { userId: $buyerUserId, address: $buyerAddress, publicKey: $buyerPublicKey },
    simulatedDepositTxid: "dev-authenticated-deposit-txid"
  }'
)"
expect_forbidden_with_cookies "$INTERMEDIARY_COOKIE_JAR" "/api/orders/${order_id}/fund" "$fund_payload" "intermediary was allowed to fund buyer order"

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
expect_forbidden_with_cookies "$BUYER_COOKIE_JAR" "/api/orders/${order_id}/accept" "$accept_payload" "buyer was allowed to accept as intermediary"

print_step "Intermediary accepts order"
accept_response="$(post_json_with_cookies "$INTERMEDIARY_COOKIE_JAR" "/api/orders/${order_id}/accept" "$accept_payload")"
print_response "$accept_response"
assert_jq "$accept_response" '.order.status == "ACCEPTED"' "order was not accepted"

purchase_payload="$(jq -n \
  --arg intermediaryUserId "$INTERMEDIARY_USER_ID" \
  --arg purchasedAt "$DEMO_TIMESTAMP" \
  '{
    intermediaryUserId: $intermediaryUserId,
    evidence: { type: "receipt", uri: "https://example.invalid/auth-receipt.png" },
    externalOrderId: "AUTH-ORDER-123456",
    purchasedAt: $purchasedAt
  }'
)"
expect_forbidden_with_cookies "$BUYER_COOKIE_JAR" "/api/orders/${order_id}/purchase" "$purchase_payload" "buyer was allowed to submit purchase evidence"

print_step "Intermediary submits purchase evidence"
purchase_response="$(post_json_with_cookies "$INTERMEDIARY_COOKIE_JAR" "/api/orders/${order_id}/purchase" "$purchase_payload")"
print_response "$purchase_response"
assert_jq "$purchase_response" '.order.status == "PURCHASED"' "order was not purchased"

ship_payload="$(jq -n \
  --arg intermediaryUserId "$INTERMEDIARY_USER_ID" \
  --arg shippedAt "$DEMO_TIMESTAMP" \
  '{
    intermediaryUserId: $intermediaryUserId,
    tracking: { carrier: "DEV_CARRIER", trackingNumber: "AUTH-TRACK-123456" },
    shippedAt: $shippedAt
  }'
)"
print_step "Intermediary ships order"
ship_response="$(post_json_with_cookies "$INTERMEDIARY_COOKIE_JAR" "/api/orders/${order_id}/ship" "$ship_payload")"
print_response "$ship_response"
assert_jq "$ship_response" '.order.status == "SHIPPED"' "order was not shipped"

release_request_payload="$(jq -n \
  --arg intermediaryUserId "$INTERMEDIARY_USER_ID" \
  --arg requestedAt "$DEMO_TIMESTAMP" \
  '{ intermediaryUserId: $intermediaryUserId, message: "Authenticated release request.", requestedAt: $requestedAt }'
)"
print_step "Intermediary requests release"
release_request_response="$(post_json_with_cookies "$INTERMEDIARY_COOKIE_JAR" "/api/orders/${order_id}/release-request" "$release_request_payload")"
print_response "$release_request_response"
assert_jq "$release_request_response" '.order.status == "RELEASE_PENDING"' "release was not requested"

release_payload="$(jq -n \
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
    simulatedReleaseTxid: "dev-authenticated-release-txid",
    networkFeeXec: 10
  }'
)"
expect_forbidden_with_cookies "$INTERMEDIARY_COOKIE_JAR" "/api/orders/${order_id}/release" "$release_payload" "intermediary was allowed to release buyer escrow"

print_step "Buyer releases order"
release_response="$(post_json_with_cookies "$BUYER_COOKIE_JAR" "/api/orders/${order_id}/release" "$release_payload")"
print_response "$release_response"
assert_jq "$release_response" '.order.status == "RELEASED"' "order was not released"

printf '\nAuthenticated happy path completed successfully\n'
