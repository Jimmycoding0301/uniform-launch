#!/usr/bin/env bash
# 只操作本机 anvil。不读取私钥，不向活网广播。
set -euo pipefail
export PATH="$PATH:/home/ubuntu/.foundry/bin"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RPC="${BSC_TESTNET_RPC_URL:-https://bsc-testnet-rpc.publicnode.com}"
ANVIL_RPC="http://127.0.0.1:18545"
mkdir -p web/public

if ! cast block-number --rpc-url "$ANVIL_RPC" >/dev/null 2>&1; then
  anvil --fork-url "$RPC" --port 18545 --chain-id 97 --auto-impersonate --silent &
  for _ in $(seq 1 60); do
    cast block-number --rpc-url "$ANVIL_RPC" >/dev/null 2>&1 && break
    sleep 1
  done
fi

for addr in 0x00000000000000000000000000000000C0DE0001 0x00000000000000000000000000000000C0DE0002 0x00000000000000000000000000000000C0DE0003 0x00000000000000000000000000000000C0DE0004; do
  cast rpc anvil_setBalance "$addr" 0x3635C9ADC5DEA00000 --rpc-url "$ANVIL_RPC" >/dev/null
done
ADMIN=$(cast call 0x0000Ed588dfc01749C20bA69b5f8c77d706E0000 "owner()(address)" --rpc-url "$ANVIL_RPC")
cast rpc anvil_setBalance "$ADMIN" 0x3635C9ADC5DEA00000 --rpc-url "$ANVIL_RPC" >/dev/null

forge script script/LocalFork.s.sol --rpc-url "$ANVIL_RPC" --broadcast --unlocked --sender 0x00000000000000000000000000000000C0DE0001 -vv
bash script/phase-shot.sh
