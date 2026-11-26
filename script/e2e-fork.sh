#!/usr/bin/env bash
# 在本机 anvil 分叉上把七个阶段跑完。不是本机地址就退出。
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RPC="${BSC_TESTNET_RPC_URL:-https://bsc-testnet-rpc.publicnode.com}"
ANVIL_RPC="http://127.0.0.1:18546"
export UNIFORM_RPC_URL="$ANVIL_RPC"
case "$ANVIL_RPC" in
  *127.0.0.1*|*localhost*) ;;
  *) echo "拒绝广播：RPC 不是本机"; exit 1 ;;
esac

for pid in $(ps -eo pid,args | awk '/anvil/ && /--port 18546/ && !/awk/ {print $1}'); do
  kill "$pid" 2>/dev/null || true
done
sleep 1
anvil --fork-url "$RPC" --port 18546 --chain-id 97 --auto-impersonate --silent &
for _ in $(seq 1 90); do
  cast block-number --rpc-url "$ANVIL_RPC" >/dev/null 2>&1 && break
  sleep 1
done

for addr in \
  0x00000000000000000000000000000000C0DE0001 \
  0x00000000000000000000000000000000C0DE0002 \
  0x00000000000000000000000000000000C0DE0003 \
  0x00000000000000000000000000000000C0DE0004 \
  0x00000000000000000000000000000000C0DE0005
do
  cast rpc anvil_setBalance "$addr" 0x21E19E0C9BAB2400000 --rpc-url "$ANVIL_RPC" >/dev/null
done

ADMIN=$(cast call 0x0000Ed588dfc01749C20bA69b5f8c77d706E0000 "owner()(address)" --rpc-url "$ANVIL_RPC")
cast rpc anvil_setBalance "$ADMIN" 0x3635C9ADC5DEA00000 --rpc-url "$ANVIL_RPC" >/dev/null
cast rpc anvil_impersonateAccount "$ADMIN" --rpc-url "$ANVIL_RPC" >/dev/null
cast send 0x000042108465206185A077Edc3F3fd2b49060000 \
  "setLauncherFactoryMultiplier(address,uint16,bool)" \
  0xE82642aC5c3B3B4b7D4cDeaf6a251Dc0BB7AcEfd 10000 true \
  --from "$ADMIN" --unlocked --rpc-url "$ANVIL_RPC" >/dev/null
cast send 0x000042108465206185A077Edc3F3fd2b49060000 \
  "setVaultFactoryMultiplier(address,uint16,bool)" \
  0x2EF7a93b2fE4FBF520D5210b3ea39a72E5133dc6 10000 true \
  --from "$ADMIN" --unlocked --rpc-url "$ANVIL_RPC" >/dev/null

rm -f deployments/bsc-testnet-e2e.json
SENDER=0x00000000000000000000000000000000C0DE0001
record() {
  python3 - "$1" << 'PY'
import json, sys, glob, os
label = sys.argv[1]
files = [p for p in glob.glob("broadcast/E2ETestnet.s.sol/97/*.json") if not p.endswith(".lock")]
path = max(files, key=os.path.getmtime)
data = json.load(open(path))
hashes = [tx["hash"] for tx in data.get("transactions", [])]
state = {}
try:
    state = json.load(open("deployments/bsc-testnet-e2e.json"))
except FileNotFoundError:
    pass
state.setdefault("txs", {})[label] = hashes
json.dump(state, open("deployments/bsc-testnet-e2e.json", "w"), indent=2)
print(label, " ".join(hashes))
PY
}
run() {
  local sig="$1"
  local label="$2"
  echo "== $label =="
  forge script script/E2ETestnet.s.sol --sig "$sig" \
    --rpc-url "$ANVIL_RPC" --broadcast --unlocked --sender "$SENDER" \
    --gas-limit 16000000
  record "$label"
}

run "create()" "create"
run "bid()" "bid-alice"
run "bid()" "bid-bob"
run "bid()" "bid-carol"
LAUNCHER=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("deployments/bsc-testnet-e2e.json","utf8")).launcher)')
END=$(cast call "$LAUNCHER" "endBlock()(uint256)" --rpc-url "$ANVIL_RPC" | awk '{print $1}')
NOW=$(cast block-number --rpc-url "$ANVIL_RPC" | awk '{print $1}')
if [ "$END" -gt "$NOW" ]; then
  cast rpc anvil_mine $((END - NOW)) --rpc-url "$ANVIL_RPC" >/dev/null
fi
run "settle()" "settle"
run "claim()" "claim"
cast rpc evm_increaseTime 172800 --rpc-url "$ANVIL_RPC" >/dev/null
cast rpc anvil_mine 1 --rpc-url "$ANVIL_RPC" >/dev/null
run "trade()" "trade"
run "withdraw()" "withdraw"
echo "== show =="
forge script script/E2ETestnet.s.sol --sig "show()" --rpc-url "$ANVIL_RPC" --sender "$SENDER"
echo "记录在 deployments/bsc-testnet-e2e.json"
python3 - << 'PY'
import json
print(json.dumps(json.load(open("deployments/bsc-testnet-e2e.json")), indent=2))
PY
