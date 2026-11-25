import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { settle } from "../shared/settle.mjs";

const require = createRequire(new URL("../agent/package.json", import.meta.url));
const { createPublicClient, http } = require("viem");
const W = 10n ** 18n;
const demo = JSON.parse(readFileSync(new URL("../web/public/demo.json", import.meta.url), "utf8"));
const client = createPublicClient({ transport: http(demo.rpc) });
const abi = [
  { type: "function", name: "floorPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "getBids",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { type: "address[]" },
      { type: "uint256[]" },
      { type: "uint256[]" },
      { type: "bytes32[]" },
      { type: "uint256[]" },
    ],
  },
];
const floor = await client.readContract({ address: demo.open, abi, functionName: "floorPrice" });
const book = await client.readContract({ address: demo.open, abi, functionName: "getBids" });
const bids = book[1].map((budget, index) => ({
  index: BigInt(index),
  who: `第 ${index + 1} 笔`,
  budget,
  maxPrice: book[2][index],
}));

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

const raised = bids.reduce((sum, bid) => sum + bid.budget, 0n);
const sameRaise = curve(uniform.poolQuote);
const allBudgets = curve(raised);
const out = {
  label: "模拟，参数见脚本",
  source: demo.open,
  floor: format(floor),
  clearing: format(uniform.clearingPrice),
  poolQuote: format(uniform.poolQuote),
  uniformRatio: 1,
  recommended: "sameRaise",
  bids: bids.map((bid) => ({ budget: format(bid.budget), maxPrice: format(bid.maxPrice) })),
  sameRaise,
  allBudgets,
};
writeFileSync(new URL("../web/public/why.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
