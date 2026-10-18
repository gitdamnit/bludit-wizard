#!/usr/bin/env bash
# Provision the subdirectory install (Bludit served from /blog) used to test
# GPT Action API compatibility when Bludit is NOT at the domain root.
#
# Usage: testenv/provision-subdir.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE="docker compose -f $HERE/compose.yaml"
CONTAINER="bwtest-subdir-1"
PORT=8083
SUBDIR="blog"
WIZARD_API_KEY="WizardTestKey2026RC1"

echo ">> [subdir] relocating Bludit into /$SUBDIR inside the container"
$COMPOSE exec -T subdir bash -lc "
  set -e
  cd /var/www/html
  rm -rf $SUBDIR
  mkdir -p $SUBDIR
  find . -maxdepth 1 -mindepth 1 ! -name $SUBDIR -exec cp -a {} $SUBDIR/ \;
  sed -i 's#RewriteBase /#RewriteBase /$SUBDIR/#' $SUBDIR/.htaccess
  echo '   copied:' \$(ls -A $SUBDIR | wc -l) 'entries, RewriteBase:' \$(grep RewriteBase $SUBDIR/.htaccess | head -1)"

echo ">> [subdir] installing Bludit in /$SUBDIR"
code="$(curl -sS -o /dev/null -w '%{http_code}' "http://localhost:$PORT/$SUBDIR/install.php?demo=true" || true)"
echo "   install HTTP $code"
code="$(curl -sS -o /dev/null -w '%{http_code}' "http://localhost:$PORT/$SUBDIR/install.php?demo=true" || true)"
echo "   install HTTP $code (already installed expected)"

echo ">> [subdir] seeding Wizard plugin database"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
{
  printf "%s\n" "<?php defined('BLUDIT') or die('Bludit CMS.'); ?>"
  printf '%s' "{\"provider\":\"compatible\",\"baseUrl\":\"http://127.0.0.1/mockai/v1\",\"model\":\"mock-model\",\"apiKey\":\"mockLlmKey\",\"wizardApiKey\":\"$WIZARD_API_KEY\",\"temperature\":\"0.3\",\"maxTokens\":\"2500\",\"systemPrompt\":\"You are Bludit Wizard, a careful CMS assistant.\",\"position\":1}"
} > "$TMP/db.php"
$COMPOSE exec -T subdir bash -lc "mkdir -p /var/www/html/$SUBDIR/bl-content/databases/plugins/wizard"
docker cp "$TMP/db.php" "$CONTAINER:/var/www/html/$SUBDIR/bl-content/databases/plugins/wizard/db.php"
$COMPOSE exec -T subdir bash -lc "chown -R www-data:www-data /var/www/html/$SUBDIR/bl-content"

echo ">> [subdir] probing API base paths"
printf '   /blog/api/wizard/site -> %s\n' "$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $WIZARD_API_KEY" "http://localhost:$PORT/$SUBDIR/api/wizard/site")"
printf '   /api/wizard/site      -> %s\n' "$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $WIZARD_API_KEY" "http://localhost:$PORT/api/wizard/site")"

mkdir -p "$HERE/.state"
cat > "$HERE/.state/subdir.env" <<EOF
SERVICE=subdir
PORT=$PORT
SUBDIR=$SUBDIR
BASE_URL=http://localhost:$PORT/$SUBDIR
ADMIN_USER=admin
ADMIN_PASS=demo123
WIZARD_API_KEY=$WIZARD_API_KEY
EOF
echo ">> [subdir] done"
