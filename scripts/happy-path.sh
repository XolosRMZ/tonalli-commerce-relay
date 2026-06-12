#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
BUYER_USER_ID="dev_buyer_001"
BUYER_ADDRESS="ecash:qdevbuyeraddressplaceholder0000000000000000"
BUYER_PUBLIC_KEY="dev-buyer-public-key-placeholder"
BUYER_ALIAS="devbuyer.xec"
INTERMEDIARY_USER_ID="dev_intermediary_001"
INTERMEDIARY_ADDRESS="ecash:qdevintermediaryaddressplaceholder000000"
INTERMEDIARY_PUBLIC_KEY="dev-intermediary-public-key-placeholder"
INTERMEDIARY_ALIAS="devmerchant.xec"
DEMO_TIMESTAMP="2026-06-12T20:00:00.000Z"

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required to run this script. Install jq and try again." >&2
  exit 1
fi

print_step() {
  printf '\n== %s ==\n' "$1"
}

post_json() {
  local path="$1"
  local payload="$2"

  curl --fail-with-body --silent --show-error \
    -X POST "${BASE_URL}${path}" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

assert_jq() {
  local response="$1"
  local filter="$2"
  local message="$3"

  if ! jq -e "$filter" >/dev/null <<<"$response"; then
    echo "Error: ${message}" >&2
    echo "$response" | jq . >&2
    exit 1
  fi
}

print_response() {
  echo "$1" | jq .
}

print_step "1. Create quote"
quote_response="$(
  post_json "/api/quote" '{
    "amount": 100,
    "currency": "MXN",
    "intermediaryFeePercent": 5,
    "platformFeePercent": 1,
    "networkFeeReserveXec": 100
  }'
)"
print_response "$quote_response"
quote_json="$(jq -c '.quote' <<<"$quote_response")"
assert_jq "$quote_response" '.quote.totalFiat.amount == 106 and .quote.totalXec.amount == 318100' "quote response did not include expected totals"

print_step "2. Create order"
order_response="$(
  post_json "/api/orders" "$(jq -n \
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
        title: "Dev placeholder product",
        quantity: 1,
        notes: "Happy path demo placeholder"
      },
      quote: $quote
    }'
  )"
)"
print_response "$order_response"
order_id="$(jq -r '.order.id' <<<"$order_response")"
assert_jq "$order_response" '.order.id | type == "string" and length > 0' "order response did not include order.id"
assert_jq "$order_response" '.order.status == "WAITING_DEPOSIT"' "order was not created with WAITING_DEPOSIT status"
echo "Order ID: ${order_id}"

print_step "3. Fund simulated order"
fund_response="$(
  post_json "/api/orders/${order_id}/fund" "$(jq -n \
    --arg buyerUserId "$BUYER_USER_ID" \
    --arg buyerAddress "$BUYER_ADDRESS" \
    --arg buyerPublicKey "$BUYER_PUBLIC_KEY" \
    '{
      buyer: {
        userId: $buyerUserId,
        address: $buyerAddress,
        publicKey: $buyerPublicKey
      },
      simulatedDepositTxid: "dev-simulated-deposit-txid"
    }'
  )"
)"
print_response "$fund_response"
assert_jq "$fund_response" '.order.status == "FUNDED"' "order was not funded"

print_step "4. Accept order"
accept_response="$(
  post_json "/api/orders/${order_id}/accept" "$(jq -n \
    --arg intermediaryUserId "$INTERMEDIARY_USER_ID" \
    --arg intermediaryAddress "$INTERMEDIARY_ADDRESS" \
    --arg intermediaryAlias "$INTERMEDIARY_ALIAS" \
    --arg updatedAt "$DEMO_TIMESTAMP" \
    '{
      intermediary: {
        userId: $intermediaryUserId,
        address: $intermediaryAddress,
        alias: $intermediaryAlias
      },
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
        limits: {
          maxOrderFiatMxn: 1000,
          maxDailyFiatMxn: 2000
        },
        isFrozen: false,
        updatedAt: $updatedAt
      },
      currentDailyVolumeFiatMxn: 0
    }'
  )"
)"
print_response "$accept_response"
assert_jq "$accept_response" '.order.status == "ACCEPTED"' "order was not accepted"

print_step "5. Purchase evidence"
purchase_response="$(
  post_json "/api/orders/${order_id}/purchase" "$(jq -n \
    --arg intermediaryUserId "$INTERMEDIARY_USER_ID" \
    --arg purchasedAt "$DEMO_TIMESTAMP" \
    '{
      intermediaryUserId: $intermediaryUserId,
      evidence: {
        type: "receipt",
        uri: "https://example.invalid/dev-receipt.png",
        hash: "sha256-dev-placeholder",
        notes: "Dev purchase evidence placeholder"
      },
      externalOrderId: "DEV-ORDER-123456",
      purchasedAt: $purchasedAt
    }'
  )"
)"
print_response "$purchase_response"
assert_jq "$purchase_response" '.order.status == "PURCHASED"' "order was not marked as purchased"

print_step "6. Ship evidence"
ship_response="$(
  post_json "/api/orders/${order_id}/ship" "$(jq -n \
    --arg intermediaryUserId "$INTERMEDIARY_USER_ID" \
    --arg shippedAt "$DEMO_TIMESTAMP" \
    '{
      intermediaryUserId: $intermediaryUserId,
      tracking: {
        carrier: "DEV_CARRIER",
        trackingNumber: "DEV-TRACK-123456",
        trackingUrl: "https://example.invalid/dev-tracking/DEV-TRACK-123456",
        notes: "Dev shipping evidence placeholder"
      },
      shippedAt: $shippedAt
    }'
  )"
)"
print_response "$ship_response"
assert_jq "$ship_response" '.order.status == "SHIPPED"' "order was not marked as shipped"

print_step "7. Release request"
release_request_response="$(
  post_json "/api/orders/${order_id}/release-request" "$(jq -n \
    --arg intermediaryUserId "$INTERMEDIARY_USER_ID" \
    --arg requestedAt "$DEMO_TIMESTAMP" \
    '{
      intermediaryUserId: $intermediaryUserId,
      message: "Dev release request after simulated shipment.",
      requestedAt: $requestedAt
    }'
  )"
)"
print_response "$release_request_response"
assert_jq "$release_request_response" '.order.status == "RELEASE_PENDING"' "release request did not move order to RELEASE_PENDING"

print_step "8. Release simulated escrow"
release_response="$(
  post_json "/api/orders/${order_id}/release" "$(jq -n \
    --arg buyerUserId "$BUYER_USER_ID" \
    --arg buyerAddress "$BUYER_ADDRESS" \
    --arg buyerPublicKey "$BUYER_PUBLIC_KEY" \
    --arg intermediaryUserId "$INTERMEDIARY_USER_ID" \
    --arg intermediaryAddress "$INTERMEDIARY_ADDRESS" \
    --arg intermediaryPublicKey "$INTERMEDIARY_PUBLIC_KEY" \
    '{
      buyerUserId: $buyerUserId,
      buyer: {
        userId: $buyerUserId,
        address: $buyerAddress,
        publicKey: $buyerPublicKey
      },
      intermediary: {
        userId: $intermediaryUserId,
        address: $intermediaryAddress,
        publicKey: $intermediaryPublicKey
      },
      simulatedReleaseTxid: "dev-simulated-release-txid",
      networkFeeXec: 10
    }'
  )"
)"
print_response "$release_response"
assert_jq "$release_response" '.order.status == "RELEASED"' "order was not released"

printf '\nHappy path completed successfully\n'
