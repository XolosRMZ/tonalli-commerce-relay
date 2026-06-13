#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required to run this script. Install jq and try again." >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is required." >&2
  exit 1
fi

if [[ "${TONALLI_AUTH_STORE:-}" != "prisma" ]]; then
  echo "Warning: TONALLI_AUTH_STORE is not prisma." >&2
fi

if [[ "${TONALLI_ORDER_STORE:-}" != "prisma" ]]; then
  echo "Warning: TONALLI_ORDER_STORE is not prisma." >&2
fi

if [[ "${TONALLI_EVIDENCE_STORE:-}" != "prisma" ]]; then
  echo "Warning: TONALLI_EVIDENCE_STORE is not prisma." >&2
fi

if [[ "${TONALLI_DISPUTE_STORE:-}" != "prisma" ]]; then
  echo "Warning: TONALLI_DISPUTE_STORE is not prisma." >&2
fi

if [[ "${TONALLI_AUTH_DEV_BYPASS:-}" != "true" ]]; then
  echo "Warning: TONALLI_AUTH_DEV_BYPASS is not true. auth-prisma-smoke.sh uses dev-valid-signature." >&2
fi

export BASE_URL

run_flow() {
  local title="$1"
  local script="$2"

  printf '\n== %s ==\n' "$title"
  bash "${SCRIPT_DIR}/${script}"
}

run_flow "Prisma auth smoke test" "auth-prisma-smoke.sh"
run_flow "Prisma orders smoke test" "orders-prisma-smoke.sh"
run_flow "Happy path with full Prisma mode" "happy-path.sh"
run_flow "Refund path with full Prisma mode" "refund-path.sh"
run_flow "Dispute path with full Prisma mode" "dispute-path.sh"

printf '\nFull Prisma stack flows completed successfully\n'
