import { toFunctionSelector } from "viem";

const rows = [
  ["Closed()", "窗口已关", "这一场已经不接出价。"],
  ["Early()", "还没到结算", "等结束区块过了再结算。"],
  ["AlreadyBid()", "这个地址已经出过价", "一个地址只能出一笔。"],
  ["BadBudget()", "预算不在范围内", "单笔 0.01 到 100 BNB。"],
  ["BelowFloor()", "低于保留价，这笔不会入场", "把最高价提到保留价以上。"],
  ["Full()", "名额已满", "这一场最多 32 笔。"],
  ["NotAgent()", "身份不过", "换一个已登记的身份，或换一个身份来源。"],
  ["AgentAlreadyBid()", "这个身份已经出过价", "一个身份只能出一笔。"],
  ["InsufficientGas()", "结算燃料不够", "燃料上限用 8000000，不要用估算值。"],
  ["NothingToClaim()", "没有可领取的", "这一笔没有成交，或已经领过。"],
  ["NothingToRefund()", "没有可退的", "这一笔没有待退的预算。"],
  ["RefundUnavailable()", "现在不能退款", "只有失败之后才能退款。"],
];

export const reasons = Object.fromEntries(
  rows.map(([sig, reason, next]) => [toFunctionSelector(sig), { reason, next }]),
);

export function explain(error) {
  const text = [error?.shortMessage, error?.message, error?.details, error?.cause?.message].filter(Boolean).join(" ");
  const hit = text.match(/0x[0-9a-fA-F]{8}/);
  if (hit && reasons[hit[0]]) return { ok: false, ...reasons[hit[0]] };
  for (const [selector, item] of Object.entries(reasons)) {
    if (text.includes(selector)) return { ok: false, ...item };
  }
  if (text.includes("地址不对")) return { ok: false, reason: "地址不对", next: "检查合约地址或身份地址。" };
  if (/fetch|network|ECONN|ENOTFOUND|ETIMEDOUT|timeout|HTTP request failed/i.test(text)) {
    return { ok: false, reason: "读不到链", next: "换一个 RPC 地址后重试" };
  }
  return { ok: false, reason: "没有完成", next: "看上面的原因，改完再试。" };
}
