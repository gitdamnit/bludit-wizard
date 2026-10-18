#!/usr/bin/env bash
# Build the distributable Bludit plugin ZIP.
#
# The archive contains a single top-level `wizard/` directory (the Bludit plugin
# directory) with only the files shipped to users: plugin.php, metadata.json,
# README.md, CHANGELOG.md, LICENSE, languages/, js/, css/, lib/ and a generated
# assets.json manifest (hashes for deployment verification).
#
# Usage: scripts/build-release.sh [label]     # label defaults to 1.1.0
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="${1:-1.1.0}"
OUT="$HERE/dist/bludit-wizard-${LABEL}.zip"

PLUGIN_FILES=(plugin.php metadata.json README.md CHANGELOG.md LICENSE languages js css lib)

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$STAGE/wizard"
for item in "${PLUGIN_FILES[@]}"; do
    if [ ! -e "$HERE/wizard/$item" ]; then
        echo "ERROR: missing wizard/$item" >&2
        exit 1
    fi
    cp -a "$HERE/wizard/$item" "$STAGE/wizard/"
done

# Deployment manifest: lets an operator confirm that the files actually served
# by a host match this release (GET /bl-plugins/wizard/assets.json).
python3 - "$STAGE/wizard" "$LABEL" <<'PY'
import hashlib
import json
import os
import sys

root, release = sys.argv[1], sys.argv[2]
tracked = ["plugin.php", "metadata.json", "js/wizard.js", "js/settings.js",
           "css/wizard.css", "lib/netpolicy.php"]
with open(os.path.join(root, "metadata.json"), encoding="utf-8") as fh:
    version = json.load(fh)["version"]
files = {}
for rel in tracked:
    with open(os.path.join(root, rel), "rb") as fh:
        files[rel] = hashlib.sha256(fh.read()).hexdigest()
manifest = {"name": "bludit-wizard", "release": release, "version": version, "files": files}
with open(os.path.join(root, "assets.json"), "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, indent=2, sort_keys=True)
    fh.write("\n")
PY

# Reproducible, non-executable, world-unreadable-free permissions.
find "$STAGE/wizard" -type d -exec chmod 755 {} +
find "$STAGE/wizard" -type f -exec chmod 644 {} +

mkdir -p "$HERE/dist"
rm -f "$OUT"
( cd "$STAGE" && zip -qr -X "$OUT" wizard )

echo "Built: $OUT"
echo "Version: $(python3 -c "import json;print(json.load(open('$HERE/wizard/metadata.json'))['version'])")"
unzip -l "$OUT"
