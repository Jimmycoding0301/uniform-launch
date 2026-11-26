#!/usr/bin/env bash
# 本机一条命令。不依赖 docker。已经在跑的分叉和页面会接着用。
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -n "${DEMO_WEB_PORT:-}" ]] && { [[ ! "$DEMO_WEB_PORT" =~ ^[1-9][0-9]{0,4}$ ]] || (( DEMO_WEB_PORT > 65535 )); }; then
  echo "DEMO_WEB_PORT 应为 1 到 65535 的整数。" >&2
  exit 1
fi
DEMO_JSON="$ROOT/web/public/demo.json" bash script/local-fork.sh
if [ ! -d web/node_modules ]; then
  (cd web && npm ci)
fi
WEB_PORT=$(node --input-type=module <<'NODE'
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
const demo = JSON.parse(readFileSync("web/public/demo.json", "utf8"));
const explicit = process.env.DEMO_WEB_PORT;
const previous = Number(/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/.exec(demo.webOrigin || "")?.[1]);
const port = Number(explicit) || (previous <= 65535 && previous) || 4317;
const url = `http://127.0.0.1:${port}`;
let reusable = false;
try {
  const doc = await fetch(url + "/demo.json", {signal: AbortSignal.timeout(2000)});
  const served = await doc.json();
  reusable = ["rpc", "open", "launched", "failed", "sceneVersion"].every(key => served[key] === demo[key]);
} catch { /* An unused port or another service is handled below. */ }
function probe(port) {
  return new Promise((resolve, reject) => {
    const socket = createServer();
    socket.on("error", error => error.code === "EADDRINUSE" ? resolve(null) : reject(error));
    socket.listen(port, "127.0.0.1", () => {
      const assigned = socket.address().port;
      socket.close(() => resolve(assigned));
    });
  });
}
let selected = reusable ? port : await probe(port);
if (!selected && !explicit) selected = await probe(0);
if (!selected) {
  console.error(`端口 ${port} 已被其他服务使用。请更换 DEMO_WEB_PORT。`);
  process.exit(1);
}
console.log(selected);
NODE
)
WEB="http://127.0.0.1:$WEB_PORT"
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
node --input-type=module - "$WEB" <<'NODE'
import { readFileSync, renameSync, writeFileSync } from "node:fs";
const path = "web/public/demo.json";
const demo = JSON.parse(readFileSync(path, "utf8"));
if (demo.webOrigin !== process.argv[2]) {
  demo.webOrigin = process.argv[2];
  const tmp = path + "." + process.pid;
  writeFileSync(tmp, JSON.stringify(demo, null, 2) + "\n");
  renameSync(tmp, path);
}
NODE
OPEN=$(node -p 'require("./web/public/demo.json").open')
echo "页面 $WEB/?launcher=$OPEN"
echo "演示 $WEB/?demo=1"
