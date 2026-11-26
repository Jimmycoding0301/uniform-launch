#!/usr/bin/env bash
# Build the public testnet site for this repository's GitHub Pages path.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
target="${1:-$root/web/dist-pages}"
case "$target" in /*) ;; *) target="$PWD/$target" ;; esac
if [[ -e "$target" ]]; then
  echo "Choose a new output directory: $target" >&2
  exit 1
fi

VITE_PUBLIC_SITE=1 npm --prefix "$root/web" run build -- --base /uniform-launch/ --outDir "$target"
mkdir -p "$target/walkthrough/en" "$target/walkthrough/zh"
cp "$root"/qa/submission/scene-*.png "$target/walkthrough/zh/"
cp "$root"/qa/submission/en/scene-*.png "$target/walkthrough/en/"
cp "$root/web/public/agent.json" "$root/web/public/llms.txt" "$root/web/public/why.json" "$target/"
touch "$target/.nojekyll"
