#!/usr/bin/env bash
# 本机一条命令。不依赖 docker。已经在跑的分叉和页面会接着用。
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
WEB_PORT="${DEMO_WEB_PORT:-4317}"
if [[ ! "$WEB_PORT" =~ ^[1-9][0-9]{0,4}$ ]] || (( WEB_PORT > 65535 )); then
  echo "DEMO_WEB_PORT 应为 1 到 65535 的整数。" >&2
  exit 1
fi
WEB="http://127.0.0.1:$WEB_PORT"
if page=$(curl --noproxy '*' -s --max-time 2 "$WEB"); then
  if [[ "$page" != *"<title>同价发射</title>"* ]]; then
    echo "端口 $WEB_PORT 已被其他服务使用。请设置 DEMO_WEB_PORT 后再运行。" >&2
    exit 1
  fi
fi
ANVIL_PORT=18545 DEMO_JSON="$ROOT/web/public/demo.json" bash script/local-fork.sh
if [ ! -d web/node_modules ]; then
  (cd web && npm ci)
fi
if ! curl --noproxy '*' -sf --max-time 2 -o /dev/null "$WEB"; then
  nohup npm --prefix "$ROOT/web" run dev -- --host 127.0.0.1 --port "$WEB_PORT" --strictPort >/tmp/uniform-web-"$WEB_PORT".log 2>&1 &
  disown || true
  for _ in $(seq 1 30); do
    curl --noproxy '*' -sf --max-time 2 -o /dev/null "$WEB" && break
    sleep 1
  done
fi
if ! curl --noproxy '*' -sf --max-time 3 "$WEB/demo.json" | cmp -s - web/public/demo.json; then
  echo "端口 $WEB_PORT 没有提供本次演示数据。请查看 /tmp/uniform-web-$WEB_PORT.log 或更换 DEMO_WEB_PORT。" >&2
  exit 1
fi
OPEN=$(node -p 'require("./web/public/demo.json").open')
echo "页面 $WEB/?launcher=$OPEN"
echo "演示 $WEB/?demo=1"
