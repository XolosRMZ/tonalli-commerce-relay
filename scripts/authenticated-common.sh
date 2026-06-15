#!/usr/bin/env bash

BASE_URL="${BASE_URL:-http://localhost:3000}"
DEMO_TIMESTAMP="2026-06-12T20:00:00.000Z"

BUYER_USER_ID="ecash:qdevbuyeraddressplaceholder0000000000000000"
BUYER_ADDRESS="$BUYER_USER_ID"
BUYER_PUBLIC_KEY="dev-buyer-public-key-placeholder"
BUYER_ALIAS="devbuyer.xec"

INTERMEDIARY_USER_ID="ecash:qdevintermediaryaddressplaceholder000000"
INTERMEDIARY_ADDRESS="$INTERMEDIARY_USER_ID"
INTERMEDIARY_PUBLIC_KEY="dev-intermediary-public-key-placeholder"
INTERMEDIARY_ALIAS="devmerchant.xec"

ARBITRATOR_USER_ID="${TONALLI_TEST_ARBITRATOR_USER_ID:-ecash:qdevarbitratoraddressplaceholder00000000}"
ARBITRATOR_ADDRESS="$ARBITRATOR_USER_ID"
ARBITRATOR_PUBLIC_KEY="dev-arbitrator-public-key-placeholder"

AUTH_COOKIE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/tonalli-auth-cookies.XXXXXX")"
BUYER_COOKIE_JAR="${AUTH_COOKIE_DIR}/buyer.cookies"
INTERMEDIARY_COOKIE_JAR="${AUTH_COOKIE_DIR}/intermediary.cookies"
ARBITRATOR_COOKIE_JAR="${AUTH_COOKIE_DIR}/arbitrator.cookies"

cleanup_auth_cookies() {
  rm -rf "$AUTH_COOKIE_DIR"
}

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

post_json_with_cookies() {
  local cookie_jar="$1"
  local path="$2"
  local payload="$3"

  curl --fail-with-body --silent --show-error \
    -c "$cookie_jar" \
    -b "$cookie_jar" \
    -X POST "${BASE_URL}${path}" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

get_json() {
  local path="$1"

  curl --fail-with-body --silent --show-error "${BASE_URL}${path}"
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

authenticate_role() {
  local label="$1"
  local cookie_jar="$2"
  local address="$3"
  local alias="$4"

  print_step "Authenticate ${label}"
  local challenge_response
  challenge_response="$(
    post_json_with_cookies "$cookie_jar" "/api/auth/challenge" "$(jq -n \
      --arg address "$address" \
      --arg alias "$alias" \
      '{ address: $address, alias: $alias }'
    )"
  )"
  local nonce
  nonce="$(jq -r '.challenge.nonce' <<<"$challenge_response")"
  local verify_response
  verify_response="$(
    post_json_with_cookies "$cookie_jar" "/api/auth/verify" "$(jq -n \
      --arg nonce "$nonce" \
      '{ nonce: $nonce, signature: "dev-valid-signature" }'
    )"
  )"
  print_response "$verify_response"
  assert_jq "$verify_response" '.authenticated == true' "${label} did not authenticate"
}

expect_forbidden_with_cookies() {
  local cookie_jar="$1"
  local path="$2"
  local payload="$3"
  local message="$4"
  local body_file
  body_file="$(mktemp "${TMPDIR:-/tmp}/tonalli-forbidden.XXXXXX")"
  local status

  status="$(
    curl --silent --show-error \
      -c "$cookie_jar" \
      -b "$cookie_jar" \
      -X POST "${BASE_URL}${path}" \
      -H "Content-Type: application/json" \
      -d "$payload" \
      -o "$body_file" \
      -w "%{http_code}"
  )"

  if [[ "$status" != "403" ]]; then
    echo "Error: ${message}; expected 403, got ${status}" >&2
    cat "$body_file" >&2
    rm -f "$body_file"
    exit 1
  fi

  rm -f "$body_file"
}

create_quote() {
  post_json "/api/quote" '{
    "amount": 100,
    "currency": "MXN",
    "intermediaryFeePercent": 5,
    "platformFeePercent": 1,
    "networkFeeReserveXec": 100
  }'
}

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required to run this script. Install jq and try again." >&2
    exit 1
  fi
}
