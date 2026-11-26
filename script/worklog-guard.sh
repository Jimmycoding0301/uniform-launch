#!/usr/bin/env bash
# 读 docs/work-log.md 第一行开工时间，和当前 UTC 比分钟数。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/docs/work-log.md"
line="$(head -n 1 "$LOG")"
start="${line#开工：}"
start_epoch="$(date -u -d "$start" +%s)"
now_epoch="$(date -u +%s)"
mins="$(( (now_epoch - start_epoch) / 60 ))"
echo "工作时长 ${mins} 分钟"
if [ "$mins" -lt 120 ]; then
  echo "还差 $((120 - mins)) 分钟"
  exit 1
fi
echo "已满 120 分钟"
