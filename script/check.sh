#!/usr/bin/env bash
# 不广播。检查文档、模拟器和页面。forge 和网页测试另跑。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node script/check-links.mjs
node script/check-why.mjs
node script/check-evidence.mjs
node script/agent-scan.mjs
node agent/parse.test.mjs
node agent/edge.test.mjs
node agent/settle.test.mjs
node agent/mcp.test.mjs
node flap-ui/check.mjs
echo "快速检查通过"
