#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADDRESS="ecash:qbuyerdev"
ALIAS="buyer.xec"
SIGNATURE="dev-valid-signature"

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required to run this script. Install jq and try again." >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is required." >&2
  exit 1
fi

post_json() {
  local path="$1"
  local payload="$2"

  curl --silent --show-error \
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

challenge_response="$(
  post_json "/api/auth/challenge" "$(jq -n \
    --arg address "$ADDRESS" \
    --arg alias "$ALIAS" \
    '{
      address: $address,
      alias: $alias
    }'
  )"
)"

assert_jq "$challenge_response" '.challenge.nonce | type == "string" and length > 0' "challenge response did not include challenge.nonce"
nonce="$(jq -r '.challenge.nonce' <<<"$challenge_response")"

verify_payload="$(jq -n \
  --arg nonce "$nonce" \
  --arg signature "$SIGNATURE" \
  '{
    nonce: $nonce,
    signature: $signature
  }'
)"

verify_response="$(post_json "/api/auth/verify" "$verify_payload")"
assert_jq "$verify_response" '.valid == true' "first verification was not valid"

second_verify_response="$(post_json "/api/auth/verify" "$verify_payload")"
assert_jq "$second_verify_response" '.valid == false and .reason == "Challenge already used"' "second verification did not fail because the nonce was already used"

echo "Prisma auth smoke test completed successfully"
