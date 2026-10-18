#!/usr/bin/env bash
# Full isolated test run: bring up containers, provision, run PHP/API/security
# tests and the Playwright UI suite, and write raw results for reporting.
#
# Usage: tests/run-all.sh [label]
#   label: optional tag for the results files (e.g. baseline, after-fix)
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
COMPOSE="docker compose -f $REPO/testenv/compose.yaml"
LABEL="${1:-run}"
RAW="$REPO/reports/raw"
mkdir -p "$RAW"

echo "=============================================="
echo " Bludit Wizard test run: $LABEL"
echo "=============================================="

echo ">> starting isolated environments"
$COMPOSE up -d --force-recreate

echo ">> waiting for HTTP to answer"
for svc_port in "community 8081" "pro 8082" "subdir 8083" "nokey 8084" "mockai 8090"; do
  set -- $svc_port
  for i in $(seq 1 30); do
    if curl -sS -o /dev/null --max-time 2 "http://localhost:$2/" 2>/dev/null; then break; fi
    sleep 1
  done
done

echo ">> provisioning Bludit installs + plugin seed"
"$REPO/testenv/provision.sh" community 8081
"$REPO/testenv/provision.sh" pro 8082
WIZARD_API_KEY_ENV="" "$REPO/testenv/provision.sh" nokey 8084
"$REPO/testenv/provision-subdir.sh"

echo
echo ">> running PHP lint / API / security / static tests"
node "$REPO/tests/runner.mjs" --json "$RAW/results-$LABEL.json"
NODE_RC=$?

echo
echo ">> running Playwright UI suite (community)"
"$REPO/tests/e2e/run.sh" community || true
[ -f "$RAW/playwright.json" ] && cp "$RAW/playwright.json" "$RAW/playwright-$LABEL.json"

echo
echo ">> done ($LABEL). Raw results in $RAW"
exit $NODE_RC
