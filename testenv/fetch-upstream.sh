#!/usr/bin/env bash
# Fetch the upstream Bludit 3.22.0 cores used by the isolated test environments.
#
#   testenv/upstream/bludit-community  <- github.com/bludit/bludit tag 3.22.0
#   testenv/upstream/bludit-pro        <- local bludit-pro-3.22.0-20260510.zip
#
# Both are vendor sources and are git-ignored. Run this once after cloning.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
UP="$HERE/upstream"
mkdir -p "$UP"

COMMUNITY_URL="https://api.github.com/repos/bludit/bludit/zipball/3.22.0"
PRO_ZIP="$REPO/bludit-pro-3.22.0-20260510.zip"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo ">> Bludit Community 3.22.0"
if [ -d "$UP/bludit-community" ]; then
  echo "   already present, skipping"
else
  curl -sSL "$COMMUNITY_URL" -o "$WORK/community.zip"
  unzip -q "$WORK/community.zip" -d "$WORK/community"
  src="$(find "$WORK/community" -maxdepth 1 -mindepth 1 -type d | head -1)"
  cp -a "$src" "$UP/bludit-community"
fi

echo ">> Bludit Pro 3.22.0"
if [ -d "$UP/bludit-pro" ]; then
  echo "   already present, skipping"
else
  if [ ! -f "$PRO_ZIP" ]; then
    echo "   ERROR: $PRO_ZIP not found (proprietary source, not in git)" >&2
    exit 1
  fi
  unzip -q "$PRO_ZIP" -d "$WORK/pro"
  src="$(find "$WORK/pro" -maxdepth 1 -mindepth 1 -type d | head -1)"
  cp -a "$src" "$UP/bludit-pro"
fi

echo ">> done"
grep -h "BLUDIT_VERSION" "$UP/bludit-community/bl-kernel/boot/init.php" "$UP/bludit-pro/bl-kernel/boot/init.php"
