#!/usr/bin/env bash
# 本机一条命令。不依赖 docker。已经在跑的分叉和页面会接着用。
set -euo pipefail
export PATH="$PATH:/home/ubuntu/.foundry/bin"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ANVIL_RPC="http://127.0.0.1:18545"
WEB="http://127.0.0.1:4317"
if ! cast block-number --rpc-url "$ANVIL_RPC" >/dev/null 2>&1; then
  bash script/local-fork.sh
fi
if ! curl -sf -o /dev/null "$WEB"; then
  (cd web && npm run dev -- --host 0.0.0.0 --port 4317 >/tmp/uniform-web.log 2>&1 &)
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null "$WEB" && break
    sleep 1
  done
fi
OPEN=$(node -e 'const d=require("./web/public/demo.json"); process.stdout.write(d.open||"")' 2>/dev/null || true)
CODE=$(cast code "${OPEN:-0x0000000000000000000000000000000000000000}" --rpc-url "$ANVIL_RPC" 2>/dev/null || true)
if [ -z "$OPEN" ] || [ -z "$CODE" ] || [ "$CODE" = "0x" ]; then
  bash script/local-fork.sh
  OPEN=$(node -e 'const d=require("./web/public/demo.json"); process.stdout.write(d.open||"")')
fi
node --input-type=module << EOF
import { readFileSync, writeFileSync } from "node:fs";
const path = "web/public/demo.json";
const data = JSON.parse(readFileSync(path, "utf8"));
data.localFork = true;
data.rpc = "$ANVIL_RPC";
writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
EOF
echo "页面 $WEB/?launcher=$OPEN"
echo "演示 $WEB/?demo=1"
