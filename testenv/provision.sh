#!/usr/bin/env bash
# Provision one isolated Bludit test container:
#   1. run the Bludit installer (demo mode -> admin/demo123)
#   2. mark the Wizard plugin installed and seed a known provider + API key
#
# Usage: testenv/provision.sh <service> <port>
#   service: community | pro
set -euo pipefail

SERVICE="${1:?service required}"
PORT="${2:?port required}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE="docker compose -f $HERE/compose.yaml"
CONTAINER="bwtest-${SERVICE}-1"

# Test fixtures (not production credentials). Override WIZARD_API_KEY_ENV to
# seed an empty or different key (used by the "not configured" 503 target).
WIZARD_API_KEY="${WIZARD_API_KEY_ENV-WizardTestKey2026RC1}"
LLM_API_KEY="mockLlmKey"
BASE_URL="http://127.0.0.1/mockai/v1"
MODEL="mock-model"

echo ">> [$SERVICE] installing Bludit (demo mode) on :$PORT"
code="$(curl -sS -o /dev/null -w '%{http_code}' "http://localhost:$PORT/install.php?demo=true" || true)"
if [ "$code" != "302" ] && [ "$code" != "200" ]; then
  echo "   WARNING: installer returned HTTP $code (already installed?)"
fi

echo ">> [$SERVICE] seeding Wizard plugin database with API key '$WIZARD_API_KEY'"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/wizard"
{
  printf "%s\n" "<?php defined('BLUDIT') or die('Bludit CMS.'); ?>"
  printf '%s' "{\"provider\":\"compatible\",\"baseUrl\":\"$BASE_URL\",\"model\":\"$MODEL\",\"apiKey\":\"$LLM_API_KEY\",\"wizardApiKey\":\"$WIZARD_API_KEY\",\"temperature\":\"0.3\",\"maxTokens\":\"2500\",\"systemPrompt\":\"You are Bludit Wizard, a careful CMS assistant.\",\"position\":1}"
} > "$TMP/wizard/db.php"

$COMPOSE exec -T "$SERVICE" bash -lc 'mkdir -p /var/www/html/bl-content/databases/plugins/wizard'
docker cp "$TMP/wizard/db.php" "$CONTAINER:/var/www/html/bl-content/databases/plugins/wizard/db.php"
$COMPOSE exec -T "$SERVICE" bash -lc '
  chown www-data:www-data /var/www/html/bl-content/databases/plugins/wizard/db.php
  mkdir -p /var/www/html/bl-content/workspaces/wizard
  chown -R www-data:www-data /var/www/html/bl-content/workspaces/wizard
  echo "   db bytes: $(wc -c < /var/www/html/bl-content/databases/plugins/wizard/db.php)"'

# Persist state for the test suite.
mkdir -p "$HERE/.state"
cat > "$HERE/.state/${SERVICE}.env" <<EOF
SERVICE=$SERVICE
PORT=$PORT
BASE_URL=http://localhost:$PORT
ADMIN_USER=admin
ADMIN_PASS=demo123
EDITOR_USER=editor
EDITOR_PASS=editor123
WIZARD_API_KEY=$WIZARD_API_KEY
LLM_API_KEY=$LLM_API_KEY
MOCK_BASE_URL=$BASE_URL
EOF

# Add a non-admin "editor" account so tests can prove the provider actions
# require administrator authorization. Idempotent: overwritten on each run.
echo ">> [$SERVICE] ensuring editor (role=editor) account for authorization tests"
USERS_TMP="$TMP/users.php"
$COMPOSE exec -T "$SERVICE" cat /var/www/html/bl-content/databases/users.php > "$USERS_TMP"
python3 - "$USERS_TMP" <<'PY'
import json, sys, hashlib
p = sys.argv[1]
lines = open(p, encoding='utf-8').read().split('\n')
head = lines[0]
db = json.loads('\n'.join(lines[1:]))
salt = 'editorSalt123'
db['editor'] = {
    'nickname': 'Editor', 'firstName': 'Editor', 'lastName': '', 'role': 'editor',
    'password': hashlib.sha1(('editor123' + salt).encode()).hexdigest(), 'salt': salt,
    'email': '', 'registered': '2026-01-01 00:00:00', 'tokenRemember': '',
    'tokenAuth': 'editorAuthToken0001', 'tokenAuthTTL': '2009-03-15 14:00',
    'twitter': '', 'facebook': '', 'instagram': '', 'codepen': '', 'linkedin': '',
    'xing': '', 'telegram': '', 'github': '', 'gitlab': ''
}
open(p, 'w', encoding='utf-8').write(head + '\n' + json.dumps(db, indent=4))
print('   editor user written')
PY
docker cp "$USERS_TMP" "$CONTAINER:/var/www/html/bl-content/databases/users.php"
$COMPOSE exec -T "$SERVICE" bash -lc 'chown www-data:www-data /var/www/html/bl-content/databases/users.php'

echo ">> [$SERVICE] verifying /api/wizard auth gate"
printf '   no key      -> %s\n' "$(curl -sS -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/wizard/site")"
printf '   wrong key   -> %s\n' "$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer wrong" "http://localhost:$PORT/api/wizard/site")"
printf '   correct key -> %s\n' "$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $WIZARD_API_KEY" "http://localhost:$PORT/api/wizard/site")"
echo ">> [$SERVICE] done"
