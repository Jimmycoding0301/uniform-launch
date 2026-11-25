#!/usr/bin/env bash
# 只操作本机 anvil。不读取私钥，不向活网广播。
set -euo pipefail
export PATH="$PATH:/home/ubuntu/.foundry/bin"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ANVIL_RPC="http://127.0.0.1:18545"

cast block-number --rpc-url "$ANVIL_RPC" >/dev/null

for i in $(seq 1 32); do
  addr=$(printf "0x%040x" $((0xC0DE1000 + i)))
  cast rpc anvil_setBalance "$addr" 0xDE0B6B3A7640000 --rpc-url "$ANVIL_RPC" >/dev/null
done
for addr in 0x00000000000000000000000000000000C0DE0001 0x00000000000000000000000000000000C0DE2001 0x00000000000000000000000000000000C0DE2002 0x00000000000000000000000000000000C0DE2003; do
  cast rpc anvil_setBalance "$addr" 0x3635C9ADC5DEA00000 --rpc-url "$ANVIL_RPC" >/dev/null
done
ADMIN=$(cast call 0x0000Ed588dfc01749C20bA69b5f8c77d706E0000 "owner()(address)" --rpc-url "$ANVIL_RPC")
cast rpc anvil_setBalance "$ADMIN" 0x3635C9ADC5DEA00000 --rpc-url "$ANVIL_RPC" >/dev/null

LOG=$(mktemp)
forge script script/PhaseShot.s.sol --rpc-url "$ANVIL_RPC" --broadcast --unlocked --sender 0x00000000000000000000000000000000C0DE0001 -vv | tee "$LOG"

READY=$(awk '/PHASE_READY / {print $2}' "$LOG" | tail -1)
CLOSED=$(awk '/PHASE_CLOSED / {print $2}' "$LOG" | tail -1)
test -n "$READY"
test -n "$CLOSED"
# 日志里的区块号来自模拟，链上的开始区块更晚。以链上读数为准。
READY_END=$(cast call "$READY" "endBlock()(uint64)" --rpc-url "$ANVIL_RPC")
CLOSED_END=$(cast call "$CLOSED" "endBlock()(uint64)" --rpc-url "$ANVIL_RPC")
READY_END=${READY_END%% *}
CLOSED_END=${CLOSED_END%% *}
NOW=$(cast block-number --rpc-url "$ANVIL_RPC")
CLOSE_LO=$((CLOSED_END - 15))
TARGET=$CLOSE_LO
if [ "$READY_END" -gt "$TARGET" ]; then TARGET=$READY_END; fi
if [ "$TARGET" -ge "$CLOSED_END" ]; then
  echo "窗口对不上 ready=$READY_END closed=$CLOSED_END" >&2
  exit 1
fi
NEED=$((TARGET - NOW))
if [ "$NEED" -lt 0 ]; then
  echo "已经过了目标区块 now=$NOW target=$TARGET" >&2
  exit 1
fi
if [ "$NEED" -gt 0 ]; then
  cast rpc anvil_mine "$NEED" --rpc-url "$ANVIL_RPC" >/dev/null
fi
echo "PHASE_HEAD $(cast block-number --rpc-url "$ANVIL_RPC")"
grep PHASE_ "$LOG"
