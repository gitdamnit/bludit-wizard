#!/usr/bin/env bash
# Verify a release ZIP is installable on Bludit Community *and* Pro, including
# the admin workspace that the API-only check used to miss.
#
# Checks per edition:
#   - ZIP integrity, PHP lint and the generated assets.json manifest
#   - API auth gate (401 / 200) and deletion refusal (405)
#   - login + /admin/plugin/pluginwizard render
#   - server-rendered dispatch action, page selector and first action label
#   - versioned asset URLs, and the served JS hash matches the ZIP
#   - native (non-AJAX) form POST fails safely, never "Unknown action."
#   - AJAX dispatch still reaches the AI handler (mock provider)
#   - settings.js and lib/netpolicy.php are present
# Then runs a focused Playwright smoke against the installed Community ZIP.
#
# Usage: scripts/verify-release-zip.sh [path-to-zip]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIP="${1:-$HERE/dist/bludit-wizard-1.1.0.zip}"
API_KEY="WIZIPCHECKKEY"
STAGE="$(mktemp -d)"
DBTMP="$(mktemp -d)"
COOKIES="$(mktemp)"
NAMES=""
cleanup() {
  for n in $NAMES; do docker rm -f "$n" >/dev/null 2>&1 || true; done
  rm -rf "$STAGE" "$DBTMP" "$COOKIES"
}
trap cleanup EXIT

echo ">> extracting $ZIP"
unzip -q "$ZIP" -d "$STAGE"
[ -f "$STAGE/wizard/plugin.php" ] || { echo "FAIL: archive has no wizard/plugin.php" >&2; exit 1; }
[ -f "$STAGE/wizard/metadata.json" ] || { echo "FAIL: archive has no wizard/metadata.json" >&2; exit 1; }
[ -f "$STAGE/wizard/assets.json" ] || { echo "FAIL: archive has no wizard/assets.json manifest" >&2; exit 1; }
for required in js/wizard.js js/settings.js css/wizard.css lib/netpolicy.php; do
  [ -f "$STAGE/wizard/$required" ] || { echo "FAIL: archive is missing wizard/$required" >&2; exit 1; }
done

echo ">> verifying assets.json against the extracted files"
python3 - "$STAGE/wizard" <<'PY'
import hashlib, json, os, sys
root = sys.argv[1]
with open(os.path.join(root, "assets.json"), encoding="utf-8") as fh:
    manifest = json.load(fh)
for rel, expected in manifest["files"].items():
    with open(os.path.join(root, rel), "rb") as fh:
        actual = hashlib.sha256(fh.read()).hexdigest()
    if actual != expected:
        raise SystemExit(f"FAIL: manifest mismatch for {rel}")
print(f"   manifest ok: {len(manifest['files'])} files, release {manifest['release']}")
PY

echo ">> lint"
docker run --rm -v "$STAGE/wizard":/w:ro php:8.2-cli php -l /w/plugin.php

{
  printf "%s\n" "<?php defined('BLUDIT') or die('Bludit CMS.'); ?>"
  printf '%s' "{\"provider\":\"compatible\",\"baseUrl\":\"http://127.0.0.1/mockai/v1\",\"model\":\"mock-model\",\"apiKey\":\"mockLlmKey\",\"wizardApiKey\":\"$API_KEY\",\"temperature\":\"0.3\",\"maxTokens\":\"2500\",\"systemPrompt\":\"x\",\"position\":1}"
} > "$DBTMP/db.php"

# Fetch the admin page, log in, and assert the workspace markers.
verify_admin_ui() {
  local port="$1" label="$2"
  local login token page src expected actual

  : > "$COOKIES"
  local attempt login token
  for attempt in 1 2 3 4 5 6; do
    login="$(curl -sS -c "$COOKIES" "http://localhost:$port/admin/login" || true)"
    token="$(printf '%s' "$login" | grep -o 'name="tokenCSRF" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//')"
    if [ -n "$token" ]; then
      break
    fi
    curl -sS -o /dev/null "http://localhost:$port/install.php?demo=true" || true
    sleep 2
  done
  [ -n "$token" ] || { echo "FAIL: [$label] no login CSRF token (install incomplete?)" >&2; return 1; }
  curl -sS -b "$COOKIES" -c "$COOKIES" -o /dev/null \
    -X POST "http://localhost:$port/admin/login" \
    --data-urlencode "tokenCSRF=$token" --data-urlencode "username=admin" --data-urlencode "password=demo123"

  local page_wait
  for page_wait in 1 2 3 4 5; do
    page="$(curl -sS -b "$COOKIES" "http://localhost:$port/admin/plugin/pluginwizard")"
    if printf '%s' "$page" | grep -q 'window.BW_CONFIG'; then
      break
    fi
    sleep 2
  done
  printf '%s' "$page" | grep -q 'window.BW_CONFIG' || { echo "FAIL: [$label] workspace did not render" >&2; return 1; }
  printf '%s' "$page" | grep -q '<input type="hidden" name="action" value="ai">' \
    || { echo "FAIL: [$label] dispatch fallback missing" >&2; return 1; }
  printf '%s' "$page" | grep -q 'id="bw-page-wrap">' \
    || { echo "FAIL: [$label] page selector is hidden server-side" >&2
         printf '   page title: '; printf '%s' "$page" | grep -o '<title>[^<]*' | head -1
         printf '   wrap: '; printf '%s' "$page" | grep -o 'id="bw-page-wrap"[^>]*' | head -1
         return 1; }
  printf '%s' "$page" | grep -q 'id="bw-run" type="submit">Generate Draft</' \
    || { echo "FAIL: [$label] initial action label is not Generate Draft" >&2; return 1; }
  printf '%s' "$page" | grep -q '?v=1.1.0' \
    || { echo "FAIL: [$label] assets are not versioned" >&2; return 1; }

  src="$(printf '%s' "$page" | grep -o '<script src="[^"]*wizard\.js[^"]*"' | head -1 | sed 's/.*src="//;s/"$//')"
  [ -n "$src" ] || { echo "FAIL: [$label] wizard.js not referenced" >&2; return 1; }
  expected="$(sha256sum "$STAGE/wizard/js/wizard.js" | cut -d' ' -f1)"
  actual="$(curl -sS "http://localhost:$port$src" | sha256sum | cut -d' ' -f1)"
  [ "$expected" = "$actual" ] || { echo "FAIL: [$label] served wizard.js differs from the ZIP" >&2; return 1; }

  for asset in "js/settings.js" "css/wizard.css" "lib/netpolicy.php" "assets.json"; do
    code="$(curl -sS -o /dev/null -w '%{http_code}' "http://localhost:$port/bl-plugins/wizard/$asset")"
    [ "$code" = "200" ] || { echo "FAIL: [$label] missing /$asset (HTTP $code)" >&2; return 1; }
  done

  local wiztoken native ajax native_wait
  for native_wait in 1 2 3; do
    page="$(curl -sS -b "$COOKIES" "http://localhost:$port/admin/plugin/pluginwizard")"
    wiztoken="$(printf '%s' "$page" | grep -o '"token":"[^"]*"' | head -1 | sed 's/"token":"//;s/"//')"
    [ -n "$wiztoken" ] || { echo "FAIL: [$label] no workspace CSRF token" >&2; return 1; }
    native="$(curl -sS -b "$COOKIES" -w '\n%{http_code}' -X POST "http://localhost:$port/admin/plugin/pluginwizard" \
      --data-urlencode "tokenCSRF=$wiztoken" --data-urlencode "action=ai" \
      --data-urlencode "task=ask_wizard" --data-urlencode "prompt=native-check")"
    if printf '%s' "$native" | grep -q 'did not finish loading'; then
      break
    fi
    sleep 2
  done
  printf '%s' "$native" | grep -q 'did not finish loading' \
    || { echo "FAIL: [$label] native POST did not show the recovery notice" >&2; return 1; }
  if printf '%s' "$native" | grep -q 'Unknown action'; then
    echo "FAIL: [$label] native POST returned Unknown action" >&2
    return 1
  fi

  curl -sS -X POST http://localhost:8090/__reset >/dev/null
  ajax="$(curl -sS -b "$COOKIES" -X POST "http://localhost:$port/admin/plugin/pluginwizard" \
    -H 'Content-Type: application/x-www-form-urlencoded' -H 'X-Requested-With: XMLHttpRequest' \
    --data-urlencode "tokenCSRF=$wiztoken" --data-urlencode "action=ai" \
    --data-urlencode "task=ask_wizard" --data-urlencode "prompt=zip-check")"
  printf '%s' "$ajax" | grep -q '"ok":true' \
    || { echo "FAIL: [$label] AJAX dispatch did not reach the AI handler: $ajax" >&2; return 1; }

  echo "   [$label] admin workspace checks PASS"
}

verify_image() {
  local image="$1" port="$2" label="$3"
  local name="bwzip-${label}-$$"
  NAMES="$NAMES $name"
  echo ">> [$label] fresh container on :$port ($image)"
  docker run -d --name "$name" --network bwtest_default -p "$port:80" "$image" >/dev/null
  sleep 4
  # The demo installer can race Apache startup on a cold image; retry briefly.
  local attempt install_code
  for attempt in 1 2 3 4 5; do
    install_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "http://localhost:$port/install.php?demo=true" || true)"
    if [ "$install_code" = "200" ] || [ "$install_code" = "302" ] || [ "$install_code" = "301" ]; then
      break
    fi
    sleep 2
  done
  sleep 1

  docker exec "$name" rm -rf /var/www/html/bl-plugins/wizard
  docker cp "$STAGE/wizard" "$name:/var/www/html/bl-plugins/wizard"
  docker exec "$name" chown -R www-data:www-data /var/www/html/bl-plugins/wizard
  docker exec "$name" mkdir -p /var/www/html/bl-content/databases/plugins/wizard
  docker cp "$DBTMP/db.php" "$name:/var/www/html/bl-content/databases/plugins/wizard/db.php"
  docker exec "$name" chown -R www-data:www-data /var/www/html/bl-content/databases/plugins/wizard

  local fail=0 code body
  code="$(curl -sS -o /dev/null -w '%{http_code}' "http://localhost:$port/api/wizard/site")"
  echo "   no-key   -> $code (expect 401)"; [ "$code" = "401" ] || fail=1
  code="$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $API_KEY" "http://localhost:$port/api/wizard/site")"
  echo "   with-key -> $code (expect 200)"; [ "$code" = "200" ] || fail=1
  body="$(curl -sS -H "Authorization: Bearer $API_KEY" "http://localhost:$port/api/wizard/pages")"
  echo "$body" | grep -q '"ok":true' || fail=1
  code="$(curl -sS -o /tmp/bw-delete-body.$$ -w '%{http_code}' -X DELETE -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' --data '{"confirm":true}' "http://localhost:$port/api/wizard/pages/nonexistent")"
  echo "   api-delete-refused -> $code (expect 405)"
  [ "$code" = "405" ] || fail=1
  grep -q 'deletion_not_supported' /tmp/bw-delete-body.$$ || fail=1
  rm -f /tmp/bw-delete-body.$$

  if [ "$fail" != "0" ]; then echo "   [$label] FAIL" >&2; return 1; fi
  verify_admin_ui "$port" "$label" || return 1
  echo "   [$label] PASS"
}

verify_image bwtest-community 8086 community
verify_image bwtest-pro       8087 pro

echo ">> Playwright smoke against the installed Community ZIP"
if [ -d "$HERE/tests/e2e/node_modules" ]; then
  (
    cd "$HERE/tests/e2e"
    BW_PORT=8086 BW_ADMIN_USER=admin BW_ADMIN_PASS=demo123 \
      BW_WIZARD_KEY="$API_KEY" BW_MOCK_URL="http://localhost:8090" \
      npx playwright test -g "server renders the dispatch fallback|workspace fails safely when wizard.js is blocked|twelve tasks in four categories" --reporter=line
  )
else
  echo "FAIL: tests/e2e/node_modules is missing; ZIP browser smoke cannot run" >&2
  exit 1
fi

echo ">> PASS: packaged plugin installs, renders and dispatches on Community and Pro"
