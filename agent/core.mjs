import { createPublicClient, encodeFunctionData, getAddress, http, keccak256, toBytes } from "viem";
import { launcherAbi } from "./abi.mjs";
import { explain } from "./errors.mjs";
import { settle } from "../shared/settle.mjs";

const WAD = 10n ** 18n;
export const CHAIN_ID = 97;
export const GAS = 8_000_000n;
const AGENT = keccak256(toBytes("binance-agent-id"));
const ERC = keccak256(toBytes("erc-8004"));

export function parseBnb(text) {
  const raw = String(text).trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error("金额要用十进制");
  const [whole, frac = ""] = raw.split(".");
  if (frac.length > 18) throw new Error("小数最多 18 位");
  return BigInt(whole) * WAD + BigInt(frac.padEnd(18, "0") || "0");
}

export function formatBnb(wei) {
  const neg = wei < 0n;
  const v = neg ? -wei : wei;
  const whole = v / WAD;
  const frac = (v % WAD).toString().padStart(18, "0").slice(0, 6).replace(/0+$/, "");
  const body = frac ? `${whole}.${frac}` : `${whole}`;
  return neg ? `-${body}` : body;
}

function clientOf(rpc) {
  return createPublicClient({ transport: http(rpc) });
}

function addr(value) {
  return getAddress(String(value).toLowerCase());
}

function phaseOf(status, block, start, end) {
  if (status === 2) return "失败";
  if (status === 1) return "已发射";
  if (block < start) return "未开始";
  if (block >= end) return "待结算";
  if (block >= end - 20n) return "截单";
  return "接单";
}

function sourceName(id) {
  if (id === AGENT) return "Agent ID";
  if (id === ERC) return "ERC-8004";
  return "身份来源";
}

async function read(rpc, launcher) {
  const client = clientOf(rpc);
  const address = addr(launcher);
  const [block, status, bids, floor, clearing, start, end, poolQuote, token, pool, minQuote, preview, sourceCount] =
    await Promise.all([
      client.getBlockNumber(),
      client.readContract({ address, abi: launcherAbi, functionName: "statusCode" }),
      client.readContract({ address, abi: launcherAbi, functionName: "bidCount" }),
      client.readContract({ address, abi: launcherAbi, functionName: "floorPrice" }),
      client.readContract({ address, abi: launcherAbi, functionName: "clearingPrice" }),
      client.readContract({ address, abi: launcherAbi, functionName: "startBlock" }),
      client.readContract({ address, abi: launcherAbi, functionName: "endBlock" }),
      client.readContract({ address, abi: launcherAbi, functionName: "poolQuote" }),
      client.readContract({ address, abi: launcherAbi, functionName: "token" }),
      client.readContract({ address, abi: launcherAbi, functionName: "pool" }),
      client.readContract({ address, abi: launcherAbi, functionName: "minPoolQuote" }).catch(() => 4335714285714285715n),
      client.readContract({ address, abi: launcherAbi, functionName: "preview" }),
      client.readContract({ address, abi: launcherAbi, functionName: "identitySourceCount" }).catch(() => 0n),
    ]);
  const sources = [];
  const count = typeof sourceCount === "bigint" ? sourceCount : 0n;
  for (let i = 0n; i < count && i < 4n; i++) {
    try {
      const source = await client.readContract({
        address,
        abi: launcherAbi,
        functionName: "identitySources",
        args: [i],
      });
      sources.push(source);
    } catch {
      break;
    }
  }
  return {
    client,
    block,
    status: Number(status),
    bids,
    floor,
    clearing,
    start,
    end,
    poolQuote,
    token,
    pool,
    minQuote,
    previewOk: preview[0],
    previewPrice: preview[1],
    previewQuote: preview[2],
    sources,
  };
}

export async function status(rpc, launcher) {
  try {
    const snap = await read(rpc, launcher);
    const phase = phaseOf(snap.status, snap.block, snap.start, snap.end);
    const clearing = snap.status === 1 ? snap.clearing : snap.previewOk ? snap.previewPrice : 0n;
    return {
      ok: true,
      phase,
      block: snap.block.toString(),
      remainingBlocks: (snap.end > snap.block ? snap.end - snap.block : 0n).toString(),
      floorPrice: formatBnb(snap.floor),
      clearingPrice: formatBnb(clearing),
      bidCount: Number(snap.bids),
      seatsLeft: Number(32n - snap.bids),
      minPoolQuote: formatBnb(snap.minQuote),
      sources: snap.sources.map((item, index) => ({ index, address: item })),
    };
  } catch (error) {
    return explain(error);
  }
}

const legacyBids = [{
  type: "function",
  name: "getBids",
  stateMutability: "view",
  inputs: [],
  outputs: [
    { name: "agents", type: "address[]" },
    { name: "budgets", type: "uint256[]" },
    { name: "maxPrices", type: "uint256[]" },
  ],
}];

async function loadBook(client, address) {
  try {
    return await client.readContract({ address, abi: launcherAbi, functionName: "getBids" });
  } catch {
    const legacy = await client.readContract({ address, abi: legacyBids, functionName: "getBids" });
    return [legacy[0], legacy[1], legacy[2], [], []];
  }
}

function bookBids(book) {
  const budgets = book[1];
  const prices = book[2];
  return budgets.map((budget, index) => ({ index: BigInt(index), budget, maxPrice: prices[index] }));
}

export async function simulate(rpc, launcher, budgetText, priceText) {
  try {
    const snap = await read(rpc, launcher);
    const budget = parseBnb(budgetText);
    const maxPrice = parseBnb(priceText);
    if (budget < WAD / 100n || budget > 100n * WAD) {
      return { ok: false, reason: "预算不在范围内", next: "单笔 0.01 到 100 BNB。" };
    }
    if (maxPrice < snap.floor) return { ok: false, reason: "低于保留价，这笔不会入场", next: "把最高价提到保留价以上。" };
    if (snap.bids >= 32n) return { ok: false, reason: "名额已满", next: "这一场最多 32 笔。" };
    const phase = phaseOf(snap.status, snap.block, snap.start, snap.end);
    if (phase !== "接单") return { ok: false, reason: "窗口已关", next: "这一场已经不接出价。" };
    const bids = bookBids(await loadBook(snap.client, launcher));
    bids.push({ index: BigInt(bids.length), budget, maxPrice });
    const out = settle(snap.floor, bids);
    const mine = out.fills[out.fills.length - 1];
    return {
      ok: true,
      clearingPrice: formatBnb(out.clearingPrice),
      tokens: (mine.tokens / WAD).toString(),
      spend: formatBnb(mine.spend),
      refund: formatBnb(mine.refund),
      meetsMinPool: out.ok && out.poolQuote >= snap.minQuote,
      poolQuote: formatBnb(out.poolQuote),
    };
  } catch (error) {
    return explain(error);
  }
}

export async function identity(rpc, launcher, account, agentId) {
  try {
    const snap = await read(rpc, launcher);
    const results = [];
    for (let i = 0; i < snap.sources.length; i++) {
      const source = snap.sources[i];
      try {
        const got = await snap.client.readContract({
          address: source,
          abi: launcherAbi,
          functionName: "verify",
          args: [addr(account), BigInt(agentId)],
        });
        results.push({ index: i, ok: Boolean(got[0]), name: sourceName(got[1]) });
      } catch {
        results.push({ index: i, ok: false, name: "身份来源" });
      }
    }
    const passed = results.some((item) => item.ok);
    if (!passed) return { ok: false, reason: "身份不过", next: "换一个已登记的身份，或换一个身份来源。", results };
    return { ok: true, results };
  } catch (error) {
    return explain(error);
  }
}

function tx(launcher, functionName, args, value) {
  const data = encodeFunctionData({ abi: launcherAbi, functionName, args });
  return {
    ok: true,
    to: addr(launcher),
    value: value.toString(),
    valueBnb: formatBnb(value),
    data,
    gas: GAS.toString(),
    chainId: CHAIN_ID,
  };
}

function instruction(kind, launcher, extra) {
  return [
    "在 BNB Smart Chain 测试网操作。链编号 97。",
    "先确认这是测试网，再确认身份。币安 Agent ID 或 ERC-8004 有一个即可。两个都没有就停。",
    "不要改金额，不要多发一笔。先用 baw 预览，确认后再执行。",
    `合约：${launcher}`,
    extra,
    kind,
  ].join("\n");
}

export async function bidTx(rpc, launcher, budgetText, priceText, sourceIndex, agentId) {
  try {
    const budget = parseBnb(budgetText);
    const price = parseBnb(priceText);
    const built = tx(launcher, "bid", [price, Number(sourceIndex), BigInt(agentId)], budget);
    built.instruction = instruction("动作：出价。", launcher, `预算 ${budgetText} BNB，最高价 ${priceText} BNB/枚。`);
    return built;
  } catch (error) {
    return explain(error);
  }
}

export async function settleTx(rpc, launcher) {
  try {
    const snap = await read(rpc, launcher);
    const phase = phaseOf(snap.status, snap.block, snap.start, snap.end);
    if (phase !== "待结算") return { ok: false, reason: "还没到结算", next: "等结束区块过了再结算。" };
    const built = tx(launcher, "settle", [], 0n);
    built.instruction = instruction("动作：结算。燃料上限 8000000，不要用估算值。", launcher, "金额 0。");
    return built;
  } catch (error) {
    return explain(error);
  }
}

export async function claimTx(rpc, launcher) {
  try {
    const snap = await read(rpc, launcher);
    if (snap.status !== 1) return { ok: false, reason: "现在不能领取", next: "只有已发射才能领取。" };
    const built = tx(launcher, "claim", [], 0n);
    built.instruction = instruction("动作：领取。", launcher, "金额 0。");
    return built;
  } catch (error) {
    return explain(error);
  }
}

export async function refundTx(rpc, launcher) {
  try {
    const snap = await read(rpc, launcher);
    if (snap.status !== 2) return { ok: false, reason: "现在不能退款", next: "只有失败之后才能退款。" };
    const built = tx(launcher, "refund", [], 0n);
    built.instruction = instruction("动作：退款。", launcher, "金额 0。");
    return built;
  } catch (error) {
    return explain(error);
  }
}
