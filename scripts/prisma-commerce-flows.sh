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

if [[ "${TONALLI_ORDER_STORE:-}" != "prisma" ]]; then
  echo "Warning: TONALLI_ORDER_STORE is not prisma." >&2
fi

if [[ "${TONALLI_EVIDENCE_STORE:-}" != "prisma" ]]; then
  echo "Warning: TONALLI_EVIDENCE_STORE is not prisma." >&2
fi

if [[ "${TONALLI_DISPUTE_STORE:-}" != "prisma" ]]; then
  echo "Warning: TONALLI_DISPUTE_STORE is not prisma." >&2
fi

export BASE_URL

run_flow() {
  local title="$1"
  local script="$2"

  printf '\n== %s ==\n' "$title"
  bash "${SCRIPT_DIR}/${script}"
}

run_flow "Prisma orders smoke test" "orders-prisma-smoke.sh"
run_flow "Happy path with Prisma" "happy-path.sh"
run_flow "Refund path with Prisma" "refund-path.sh"
run_flow "Dispute path with Prisma" "dispute-path.sh"

printf '\nAll Prisma commerce flows completed successfully\n'
