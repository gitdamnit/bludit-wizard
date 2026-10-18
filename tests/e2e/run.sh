#!/usr/bin/env bash
# Run the Playwright UI suite against one isolated target.
#
# Usage: tests/e2e/run.sh [target]      # target defaults to community
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
TARGET="${1:-community}"
STATE="$REPO/testenv/.state/$TARGET.env"

if [ ! -f "$STATE" ]; then
  echo "No state file $STATE. Run testenv/provision.sh first." >&2
  exit 2
fi

set -a
# shellcheck disable=SC1090
source "$STATE"
set +a

export BW_PORT="$PORT"
export BW_MOCK_URL="${BW_MOCK_URL:-http://localhost:8090}"
export BW_ADMIN_USER="${ADMIN_USER:-admin}"
export BW_ADMIN_PASS="${ADMIN_PASS:-demo123}"
export BW_WIZARD_KEY="${WIZARD_API_KEY:-}"

echo ">> Playwright UI suite against $TARGET (port $PORT)"
cd "$HERE"
npx playwright test
