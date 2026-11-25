import { writeFileSync } from "node:fs";
import { settle } from "../shared/settle.mjs";

const W = 10n ** 18n;
const floor = 10n ** 13n;
const bids = [
  { index: 0n, who: "第一笔", budget: 20n * W, maxPrice: 10n ** 16n },
  { index: 1n, who: "第二笔", budget: 20n * W, maxPrice: 10n ** 16n },
  { index: 2n, who: "第三笔", budget: 1n * W, maxPrice: 2n * 10n ** 13n },
];

function isqrt(n) {
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

function format(wei) {
  const whole = wei / W;
  const frac = (wei % W).toString().padStart(18, "0").slice(0, 8).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

const uniform = settle(floor, bids);
const filled = uniform.fills.filter((fill) => fill.tokens > 0n);
const uniformPrices = filled.map(() => uniform.clearingPrice);

function curve(quoteTarget) {
  const ratio = (uniform.clearingPrice * W) / floor;
  const sqrtRatio = isqrt(ratio * W);
  const quote = (quoteTarget * W) / (sqrtRatio - W);
  let token = (quote * W) / floor;
  const k = quote * token;
  const steps = [];
  let q = quote;
  let t = token;
  for (const bid of bids) {
    const start = (q * W) / t;
    if (start > bid.maxPrice) {
      steps.push({ who: bid.who, spent: 0n, tokens: 0n, start, end: start, avg: 0n });
      continue;
    }
    const cap = isqrt((bid.maxPrice * k) / W);
    const room = cap > q ? cap - q : 0n;
    const spent = room < bid.budget ? room : bid.budget;
    const nextQ = q + spent;
    const nextT = k / nextQ;
    const tokens = t - nextT;
    const end = (nextQ * W) / nextT;
    const avg = tokens === 0n ? 0n : (spent * W) / tokens;
    steps.push({ who: bid.who, spent, tokens, start, end, avg });
    q = nextQ;
    t = nextT;
  }
  const paid = steps.filter((step) => step.tokens > 0n);
  const first = paid[0];
  const last = paid[paid.length - 1];
  const high = last.avg > first.avg ? last.avg : first.avg;
  const low = last.avg > first.avg ? first.avg : last.avg;
  return {
    quoteReserve: format(quote),
    tokenReserve: format(token),
    firstAvg: format(first.avg),
    lastAvg: format(last.avg),
    ratio: Number((high * 10000n) / low) / 10000,
    gap: format(high - low),
    steps: steps.map((step) => ({
      who: step.who,
      spent: format(step.spent),
      avg: format(step.avg),
      start: format(step.start),
      end: format(step.end),
    })),
  };
}

const sameRaise = curve(40n * W);
const allBudgets = curve(41n * W);
const out = {
  label: "模拟，参数见脚本",
  floor: format(floor),
  clearing: format(uniform.clearingPrice),
  poolQuote: format(uniform.poolQuote),
  uniformRatio: 1,
  recommended: "sameRaise",
  sameRaise,
  allBudgets,
};
writeFileSync(new URL("../web/public/why.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
