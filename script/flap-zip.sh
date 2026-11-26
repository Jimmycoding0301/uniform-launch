#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/flap-ui/launcher-detail"
OUT="$ROOT/dist-flap"
mkdir -p "$OUT"
rm -f "$OUT/launcher-ui.zip"
(cd "$SRC" && zip -X -j "$OUT/launcher-ui.zip" Component.tsx manifest.json i18n.json)
echo "$OUT/launcher-ui.zip"
