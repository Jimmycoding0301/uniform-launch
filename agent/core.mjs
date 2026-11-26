import { createPublicClient, encodeFunctionData, getAddress, http, keccak256, toBytes } from "viem";
import { launcherAbi } from "./abi.mjs";
import { explain } from "./errors.mjs";
import { SELL_AMOUNT, MAX_PRICE, settle } from "../shared/settle.mjs";

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
  return createPublicClient({ transport: http(rpc, { timeout: 8_000 }) });
}

function addr(value) {
  try {
    return getAddress(String(value).toLowerCase());
  } catch {
    throw new Error("地址不对");
  }
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
  const [block, status, bids, floor, clearing, start, end, poolQuote, token, pool, minQuote, preview, sourceCount, maxBids, minSettleGas, admittedWalletCount] =
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
      client.readContract({ address, abi: launcherAbi, functionName: "minPoolQuote" }).catch(() => null),
      client.readContract({ address, abi: launcherAbi, functionName: "preview" }),
      client.readContract({ address, abi: launcherAbi, functionName: "identitySourceCount" }).catch(() => 0n),
      client.readContract({ address, abi: launcherAbi, functionName: "MAX_BIDS" }),
      client.readContract({ address, abi: launcherAbi, functionName: "MIN_SETTLE_GAS" }),
      client.readContract({ address, abi: launcherAbi, functionName: "admittedWalletCount" }).catch(() => 0n),
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
    maxBids: admittedWalletCount || maxBids,
    admittedWalletCount,
    minSettleGas,
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
      seatsLeft: Number(snap.bids >= snap.maxBids ? 0n : snap.maxBids - snap.bids),
      minPoolQuote: snap.minQuote === null ? null : formatBnb(snap.minQuote),
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
    if (maxPrice > MAX_PRICE) return { ok: false, reason: "限价超过合约上限", next: "请降低最高价。" };
    if (maxPrice < snap.floor) return { ok: false, reason: "低于保留价，这笔不会入场", next: "把最高价提到保留价以上。" };
    if (snap.bids >= snap.maxBids) return { ok: false, reason: "名额已满", next: `这一场最多 ${snap.maxBids} 笔。` };
    const phase = phaseOf(snap.status, snap.block, snap.start, snap.end);
    if (phase !== "接单") return { ok: false, reason: "窗口已关", next: "这一场已经不接出价。" };
    const bids = bookBids(await loadBook(snap.client, addr(launcher)));
    bids.push({ index: BigInt(bids.length), budget, maxPrice });
    const out = settle(SELL_AMOUNT, snap.floor, bids);
    const mine = out.fills[out.fills.length - 1];
    return {
      ok: true,
      clearingPrice: formatBnb(out.clearingPrice),
      tokens: (mine.tokens / WAD).toString(),
      spend: formatBnb(mine.spend),
      refund: formatBnb(mine.refund),
      meetsMinPool: snap.minQuote === null ? null : out.ok && out.poolQuote >= snap.minQuote,
      poolQuote: formatBnb(out.poolQuote),
    };
  } catch (error) {
    return explainInput(error);
  }
}

function explainInput(error) {
  const text = String(error?.message || "");
  if (text.includes("十进制") || text.includes("小数")) {
    return { ok: false, reason: text, next: "按 BNB 填写，例如 1 或 0.00003。" };
  }
  if (text.includes("身份编号")) {
    return { ok: false, reason: "身份编号要用整数", next: "正式 Agent ID 填 NFT token ID，ERC-8004 填登记编号。测试网替身使用钱包地址编号。" };
  }
  return explain(error);
}

function agentIdOf(agentId) {
  try {
    if (!/^\d+$/.test(String(agentId).trim())) throw new Error("bad");
    return BigInt(agentId);
  } catch {
    const error = new Error("身份编号要用整数");
    throw error;
  }
}

export async function identity(rpc, launcher, account, agentId) {
  try {
    const id = agentIdOf(agentId);
    const who = addr(account);
    const snap = await read(rpc, launcher);
    if (snap.admittedWalletCount && !await snap.client.readContract({
      address: addr(launcher), abi: launcherAbi, functionName: "admittedWallet", args: [who],
    })) return { ok: false, reason: "不在本场名单", next: "核对该场拍卖登记的钱包。", results: [] };
    const results = [];
    for (let i = 0; i < snap.sources.length; i++) {
      const source = snap.sources[i];
      try {
        const got = await snap.client.readContract({
          address: source,
          abi: launcherAbi,
          functionName: "verify",
          args: [who, id],
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
    return explainInput(error);
  }
}

function tx(launcher, functionName, args, value, gas = GAS) {
  const data = encodeFunctionData({ abi: launcherAbi, functionName, args });
  return {
    ok: true,
    to: addr(launcher),
    value: value.toString(),
    valueBnb: formatBnb(value),
    data,
    gas: gas.toString(),
    chainId: CHAIN_ID,
  };
}

function instruction(kind, launcher, extra) {
  return [
    "在 BNB Smart Chain 测试网操作。链编号 97。",
    "先做完这三步，缺一步就停止，不要发交易：",
    "1. 跑 baw wallet chains。确认有 BSC 测试网。没有就停，不要改用 56。",
    "2. 确认身份。币安 Agent ID 或 ERC-8004 有一个即可。两个都没有就停。",
    "3. 跑 baw wallet settings。Developer Mode 要开着，余额不能超限。",
    "然后只准备这一笔。不要改金额，不要多发一笔。先用 baw 预览，确认后再执行。",
    `合约：${launcher}`,
    extra,
    kind,
  ].join("\n");
}

export async function bidTx(rpc, launcher, budgetText, priceText, sourceIndex, agentId, from) {
  try {
    const budget = parseBnb(budgetText);
    const price = parseBnb(priceText);
    if (price > MAX_PRICE) return { ok: false, reason: "限价超过合约上限", next: "请降低最高价。" };
    const sourceText = String(sourceIndex).trim();
    if (!/^\d+$/.test(sourceText) || Number(sourceText) > 255) {
      return { ok: false, reason: "来源编号不对", next: "从 0 开始，按身份来源列表选，不能大于 255。" };
    }
    const id = agentIdOf(agentId);
    if (from) {
      const balance = await clientOf(rpc).getBalance({ address: addr(from) });
      if (balance < budget) {
        return {
          ok: false,
          reason: "余额不够",
          next: `还差 ${formatBnb(budget - balance)} BNB。补足后再生成交易。`,
        };
      }
    }
    const built = tx(launcher, "bid", [price, Number(sourceText), id], budget);
    built.instruction = instruction("动作：出价。", launcher, `预算 ${budgetText} BNB，最高价 ${priceText} BNB/枚。`);
    return built;
  } catch (error) {
    return explainInput(error);
  }
}

export async function settleTx(rpc, launcher) {
  try {
    const snap = await read(rpc, launcher);
    const phase = phaseOf(snap.status, snap.block, snap.start, snap.end);
    if (phase !== "待结算") return { ok: false, reason: "还没到结算", next: "等结束区块过了再结算。" };
    const built = tx(launcher, "settle", [], 0n, snap.minSettleGas + 1_000_000n);
    built.instruction = instruction(`动作：结算。燃料上限 ${built.gas}，不要用估算值。`, launcher, "金额 0。");
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
