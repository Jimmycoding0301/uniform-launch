#!/usr/bin/env bash
# 只操作本机 anvil。不读取私钥，不向活网广播。
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RPC="${BSC_TESTNET_RPC_URL:-https://bsc-testnet-rpc.publicnode.com}"
PORT="${ANVIL_PORT:-18545}"
if [[ ! "$PORT" =~ ^[1-9][0-9]{0,4}$ ]] || (( PORT > 65535 )); then
  echo "ANVIL_PORT 应为 1 到 65535 的整数。" >&2
  exit 1
fi
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

cast rpc anvil_nodeInfo --rpc-url "$ANVIL_RPC" >/dev/null || { echo "此端口没有运行本机 Anvil。" >&2; exit 1; }

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
  local addresses open done failed end buffer block
  addresses=$(node -e '
    const d = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    const inputs = [d.open, d.launched, d.failed];
    if (d.sceneVersion !== 2 || d.rpc !== process.argv[2] || !inputs.every(a => /^0x[0-9a-f]{40}$/i.test(a))) process.exit(1);
    console.log(inputs.join(" "));
  ' "$DEMO_JSON" "$ANVIL_RPC" 2>/dev/null) || return 1
  read -r open done failed <<<"$addresses"
  [ "$(cast call "$open" 'statusCode()(uint8)' --rpc-url "$ANVIL_RPC")" = 0 ] || return 1
  [ "$(cast call "$done" 'statusCode()(uint8)' --rpc-url "$ANVIL_RPC")" = 1 ] || return 1
  [ "$(cast call "$failed" 'statusCode()(uint8)' --rpc-url "$ANVIL_RPC")" = 2 ] || return 1
  [ "$(cast call "$failed" 'bidCount()(uint256)' --rpc-url "$ANVIL_RPC")" = 3 ] || return 1
  end=$(cast call "$open" 'endBlock()(uint64)' --rpc-url "$ANVIL_RPC") || return 1
  buffer=$(cast call "$open" 'CLOSE_BUFFER()(uint64)' --rpc-url "$ANVIL_RPC") || return 1
  block=$(cast block-number --rpc-url "$ANVIL_RPC") || return 1
  (( block + ${buffer%% *} < ${end%% *} ))
}
if healthy; then
  echo "演示场还在 $ANVIL_RPC"
else
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
  cast rpc anvil_mine "$NEED" --rpc-url "$ANVIL_RPC" --rpc-timeout 600 >/dev/null
fi
CREATOR=0x00000000000000000000000000000000C0DE0001
settle_one() {
  local to="$1"
  local out hash status
  local min_gas
  min_gas=$(cast call "$to" 'MIN_SETTLE_GAS()(uint256)' --rpc-url "$ANVIL_RPC")
  out=$(cast send "$to" "settle()" --gas-limit "$(( ${min_gas%% *} + 1000000 ))" --from "$CREATOR" --unlocked --rpc-url "$ANVIL_RPC" --json)
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
  sceneVersion: 2,
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
fi

OPEN=$(node -e 'const d=require(process.argv[1]); process.stdout.write(d.open||"")' "$DEMO_JSON")
DONE=$(node -e 'const d=require(process.argv[1]); process.stdout.write(d.launched||"")' "$DEMO_JSON")
FAIL=$(node -e 'const d=require(process.argv[1]); process.stdout.write(d.failed||"")' "$DEMO_JSON")
test -n "$OPEN" && test -n "$DONE" && test -n "$FAIL"

seed_if_empty() {
  local launcher="$1"
  local token vault accrued shown
  token=$(cast call "$launcher" "token()(address)" --rpc-url "$ANVIL_RPC")
  token=${token%% *}
  if [ -z "$token" ] || [ "$token" = "0x0000000000000000000000000000000000000000" ]; then
    echo "已发射场还没有代币" >&2
    exit 1
  fi
  vault=$(cast call 0x000042108465206185A077Edc3F3fd2b49060000 "getLaunchVault(address)(address,address)" "$token" --rpc-url "$ANVIL_RPC" | awk 'NR==1{print $1}')
  accrued=$(cast call "$vault" "accrued()(uint256)" --rpc-url "$ANVIL_RPC")
  accrued=${accrued%% *}
  if [ "$accrued" = "0" ]; then
    forge script script/LocalFork.s.sol --sig "seedVault(address)" "$launcher" \
      --rpc-url "$ANVIL_RPC" --broadcast --unlocked \
      --sender 0x00000000000000000000000000000000C0DE0004
    accrued=$(cast call "$vault" "accrued()(uint256)" --rpc-url "$ANVIL_RPC")
    accrued=${accrued%% *}
  else
    echo "金库已有余额 $accrued"
  fi
  if [ -z "$accrued" ] || [ "$accrued" = "0" ]; then
    echo "买卖之后金库仍是 0" >&2
    exit 1
  fi
  shown=$(python3 - "$accrued" << 'PY'
import sys
w = int(sys.argv[1])
frac = f"{w % 10**18:018d}"[:4]
print(f"{w // 10**18}.{frac}")
PY
)
  if [ "$shown" = "0.0000" ]; then
    echo "金库四位小数仍是 0（$accrued wei）" >&2
    exit 1
  fi
  echo "金库余额 $shown BNB"
}

seed_if_empty "$DONE"
echo "接单 $OPEN"
echo "已发射 $DONE"
echo "失败 $FAIL"
