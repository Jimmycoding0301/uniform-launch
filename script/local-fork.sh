#!/usr/bin/env bash
# 只操作本机 anvil。不读取私钥，不向活网广播。
set -euo pipefail
export PATH="$PATH:/home/ubuntu/.foundry/bin"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RPC="${BSC_TESTNET_RPC_URL:-https://bsc-testnet-rpc.publicnode.com}"
PORT="${ANVIL_PORT:-18545}"
ANVIL_RPC="http://127.0.0.1:${PORT}"
DEMO_JSON="${DEMO_JSON:-$ROOT/web/public/demo.json}"
case "$ANVIL_RPC" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "拒绝广播：RPC 不是本机"; exit 1 ;;
esac
mkdir -p "$(dirname "$DEMO_JSON")" web/public

if ! cast block-number --rpc-url "$ANVIL_RPC" >/dev/null 2>&1; then
  nohup anvil --fork-url "$RPC" --port "$PORT" --chain-id 97 --auto-impersonate --silent >/tmp/anvil-"$PORT".log 2>&1 &
  disown || true
  for _ in $(seq 1 90); do
    cast block-number --rpc-url "$ANVIL_RPC" >/dev/null 2>&1 && break
    sleep 1
  done
fi

fund() {
  cast rpc anvil_setBalance "$1" 0x3635C9ADC5DEA00000 --rpc-url "$ANVIL_RPC" >/dev/null
}
for addr in \
  0x00000000000000000000000000000000C0DE0001 \
  0x00000000000000000000000000000000C0DE0002 \
  0x00000000000000000000000000000000C0DE0003 \
  0x00000000000000000000000000000000C0DE0004 \
  0x00000000000000000000000000000000C0DE0005
do
  fund "$addr"
done
for i in $(seq 0 8); do
  fund "$(printf "0x%040x" $((0xC0DE0010 + i)))"
done
ADMIN=$(cast call 0x0000Ed588dfc01749C20bA69b5f8c77d706E0000 "owner()(address)" --rpc-url "$ANVIL_RPC")
fund "$ADMIN"

healthy() {
  [ -f "$DEMO_JSON" ] || return 1
  local open code
  open=$(node -e 'const d=require(process.argv[1]); process.stdout.write(d.open||"")' "$DEMO_JSON")
  [ -n "$open" ] || return 1
  code=$(cast code "$open" --rpc-url "$ANVIL_RPC" 2>/dev/null || true)
  [ -n "$code" ] && [ "$code" != "0x" ]
}
if healthy; then
  echo "演示场还在 $ANVIL_RPC"
  exit 0
fi

LOG=$(mktemp)
forge script script/LocalFork.s.sol --sig "runScenes()" \
  --rpc-url "$ANVIL_RPC" --broadcast --unlocked \
  --sender 0x00000000000000000000000000000000C0DE0001 | tee "$LOG"

field() { awk -v key="$1" -v RS='\n' '$1 == key {print $2}' "$LOG" | tail -1; }
OPEN=$(field LAUNCH_OPEN)
DONE=$(field LAUNCH_DONE)
FAIL=$(field LAUNCH_FAIL)
test -n "$OPEN" && test -n "$DONE" && test -n "$FAIL"
DONE_END=$(cast call "$DONE" "endBlock()(uint64)" --rpc-url "$ANVIL_RPC")
FAIL_END=$(cast call "$FAIL" "endBlock()(uint64)" --rpc-url "$ANVIL_RPC")
DONE_END=${DONE_END%% *}
FAIL_END=${FAIL_END%% *}
NOW=$(cast block-number --rpc-url "$ANVIL_RPC")
NOW=${NOW%% *}
TARGET=$DONE_END
if [ "$FAIL_END" -gt "$TARGET" ]; then TARGET=$FAIL_END; fi
NEED=$((TARGET - NOW))
echo "当前区块 $NOW 目标 $TARGET 还要挖 $NEED"
if [ "$NEED" -gt 0 ]; then
  cast rpc anvil_mine "$NEED" --rpc-url "$ANVIL_RPC" >/dev/null
fi
CREATOR=0x00000000000000000000000000000000C0DE0001
settle_one() {
  local to="$1"
  local out hash status
  out=$(cast send "$to" "settle()" --gas-limit 8000000 --from "$CREATOR" --unlocked --rpc-url "$ANVIL_RPC" --json)
  hash=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["transactionHash"])' <<<"$out")
  status=$(cast receipt "$hash" --json --rpc-url "$ANVIL_RPC" | python3 -c 'import json,sys; raw=json.load(sys.stdin)["status"]; print(int(raw,16) if isinstance(raw,str) and raw.startswith("0x") else int(raw))')
  if [ "$status" != "1" ]; then
    echo "结算交易失败 $to $hash" >&2
    cast receipt "$hash" --rpc-url "$ANVIL_RPC" >&2 || true
    exit 1
  fi
  echo "结算 $to $hash"
}
settle_one "$DONE"
settle_one "$FAIL"
DONE_STATUS=$(cast call "$DONE" "statusCode()(uint8)" --rpc-url "$ANVIL_RPC")
FAIL_STATUS=$(cast call "$FAIL" "statusCode()(uint8)" --rpc-url "$ANVIL_RPC")
DONE_STATUS=${DONE_STATUS%% *}
FAIL_STATUS=${FAIL_STATUS%% *}
if [ "$DONE_STATUS" != "1" ] || [ "$FAIL_STATUS" != "2" ]; then
  echo "结算结果不对 已发射=$DONE_STATUS 失败=$FAIL_STATUS" >&2
  exit 1
fi
node --input-type=module << EOF
import { writeFileSync } from "node:fs";
const data = {
  localFork: true,
  rpc: "$ANVIL_RPC",
  open: "$OPEN",
  launched: "$DONE",
  settle: "$DONE",
  failed: "$FAIL",
};
writeFileSync("$DEMO_JSON", JSON.stringify(data, null, 2) + "\n");
EOF
echo "已写演示场 $DEMO_JSON"
echo "接单 $OPEN"
echo "已发射 $DONE"
echo "失败 $FAIL"
