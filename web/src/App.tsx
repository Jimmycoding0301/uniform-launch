import { useEffect, useMemo, useRef, useState } from "react";
import { createPublicClient, http, keccak256, toBytes, type Address } from "viem";
import { formatBnb, formatPrice, formatRemain, formatTokens, parseBnb, tokensFor } from "./curve";
import { agentLabel } from "./names";
import { Roller, useReducedMotion, Zh } from "./motion";
import { PlotStage } from "./PlotStage";
import { ScriptPage } from "./ScriptPage";
import { pancakeSwapLink } from "./dex";
import { ADDR_STAGGER_MS, COPY_MS, MIN_SETTLE_GAS, RISK_LINE, SETTLE_GAS_LIMIT, SETTLE_MS, SWEEP_MS, USER_LINE } from "./theme";
import { TESTNET_ROWS } from "./networks";

const ABI = [
  { type: "function", name: "status", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "floorPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "clearingPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "softCap", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "startBlock", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "endBlock", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "token", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "pool", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "poolQuote", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "vaultFactory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "preview", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }, { type: "uint256" }, { type: "uint256" }] },
  {
    type: "function",
    name: "getBids",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }, { type: "uint256[]" }, { type: "uint256[]" }, { type: "bytes32[]" }, { type: "uint256[]" }],
  },
  {
    type: "function",
    name: "getFills",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256[]" }, { type: "uint256[]" }, { type: "bool[]" }],
  },
  { type: "function", name: "identitySourceCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "identitySources", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

const LEGACY_BIDS = [
  {
    type: "function",
    name: "getBids",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }, { type: "uint256[]" }, { type: "uint256[]" }],
  },
] as const;

const SOURCE_ABI = [
  { type: "function", name: "SOURCE_ID", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "standIn", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
] as const;

const PORTAL = "0x000042108465206185A077Edc3F3fd2b49060000" as Address;
const SELL = 500_000n * 10n ** 18n;
const SUPPLY = 1_000_000n * 10n ** 18n;
const PORTAL_ABI = [
  {
    type: "function",
    name: "getLaunchVault",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "address" }, { type: "address" }],
  },
  {
    type: "function",
    name: "launchQuoteConfig",
    stateMutability: "view",
    inputs: [{ type: "uint8" }, { type: "address" }],
    outputs: [{ type: "bool" }, { type: "uint256" }],
  },
  {
    type: "function",
    name: "graduationFloorV2ForLauncher",
    stateMutability: "view",
    inputs: [
      {
        type: "tuple",
        components: [
          { name: "quoteToken", type: "address" },
          { name: "quotePriceUsd", type: "uint256" },
          { name: "poolQuote", type: "uint256" },
          { name: "poolToken", type: "uint256" },
          { name: "totalSupply", type: "uint256" },
          { name: "vaultFactory", type: "address" },
        ],
      },
      { type: "address" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "meetsFloor", type: "bool" },
          { name: "floorUsdWad", type: "uint256" },
          { name: "quoteUsdWad", type: "uint256" },
          { name: "multiplierBps", type: "uint16" },
          { name: "meetsCreateFloor", type: "bool" },
          { name: "createFloorUsdWad", type: "uint256" },
        ],
      },
    ],
  },
] as const;

type DemoFile = { localFork?: boolean; rpc?: string; open?: string; launched?: string; settle?: string; failed?: string };
type Row = {
  agent: Address;
  budget: bigint;
  maxPrice: bigint;
  tokensOwed: bigint;
  quoteOwed: bigint;
  pulled: boolean;
  sourceId: `0x${string}`;
};
type SourceInfo = { sourceId: `0x${string}`; standIn: boolean };
type Snap = {
  status: number;
  floor: bigint;
  clearing: bigint;
  softCap: bigint;
  start: bigint;
  end: bigint;
  token: Address;
  pool: Address;
  poolQuote: bigint;
  vaultFactory: Address;
  previewOk: boolean;
  previewQuote: bigint;
  previewPrice: bigint;
  bids: Row[];
  sources: SourceInfo[];
};

const ZERO = "0x0000000000000000000000000000000000000000";
const PHASES = [
  { id: "wait", label: "未开始" },
  { id: "open", label: "接单" },
  { id: "closed", label: "截单" },
  { id: "ready", label: "待结算" },
  { id: "done", label: "已发射" },
  { id: "failed", label: "失败" },
] as const;

export function App() {
  const params = new URLSearchParams(location.search);
  const [demo, setDemo] = useState<DemoFile | null>(null);
  const [block, setBlock] = useState(0n);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [rpcError, setRpcError] = useState(false);
  const [budget, setBudget] = useState("1");
  const [maxPrice, setMaxPrice] = useState("0.00003");
  const [sourceIndex, setSourceIndex] = useState(0);
  const [agentIdInput, setAgentIdInput] = useState("");
  const [hashInput, setHashInput] = useState("");
  const [hashNote, setHashNote] = useState("");
  const [hashOpen, setHashOpen] = useState(false);
  const [hashReceipt, setHashReceipt] = useState<{ hash: string; block: string; amount: string; limit: string } | null>(null);
  const [hashBusy, setHashBusy] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showPool, setShowPool] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFail, setCopyFail] = useState("");
  const [launchLine, setLaunchLine] = useState("");
  const [vault, setVault] = useState("");
  const [intro, setIntro] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const initialStatus = useRef<number | null>(null);
  const animStarted = useRef(false);
  const copyTimer = useRef(0);
  const reduced = useReducedMotion();

  const forceEmpty = params.get("empty") === "1";
  const testnetBoard = params.get("network") === "testnet" && !params.get("launcher");
  const launcher = (forceEmpty || testnetBoard ? "" : params.get("launcher") || demo?.open || "") as Address;
  const rpc = demo?.rpc || "http://127.0.0.1:18545";
  useEffect(() => {
    fetch("/demo.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setDemo)
      .catch(() => setDemo({}));
  }, []);

  useEffect(() => {
    if (!launcher) return;
    const client = createPublicClient({ transport: http(rpc) });
    let stop = false;
    const load = async () => {
      const slow = window.setTimeout(() => {
        if (!stop) setRpcError(true);
      }, 3000);
      try {
        const b = await client.getBlockNumber();
        const [status, floor, clearing, softCap, start, end, token, pool, poolQuote, vaultFactory, preview, fills] = await Promise.all([
          client.readContract({ address: launcher, abi: ABI, functionName: "status" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "floorPrice" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "clearingPrice" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "softCap" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "startBlock" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "endBlock" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "token" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "pool" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "poolQuote" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "vaultFactory" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "preview" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "getFills" }),
        ]);
        let got: readonly [readonly Address[], readonly bigint[], readonly bigint[], readonly `0x${string}`[], readonly bigint[]];
        try {
          got = await client.readContract({ address: launcher, abi: ABI, functionName: "getBids" });
        } catch {
          const legacy = await client.readContract({ address: launcher, abi: LEGACY_BIDS, functionName: "getBids" });
          got = [legacy[0], legacy[1], legacy[2], [], []];
        }
        if (stop) return;
        const sources: SourceInfo[] = [];
        try {
          const sourceCount = (await client.readContract({
            address: launcher,
            abi: ABI,
            functionName: "identitySourceCount",
          })) as bigint;
          for (let i = 0; i < Number(sourceCount); i++) {
            const source = (await client.readContract({
              address: launcher,
              abi: ABI,
              functionName: "identitySources",
              args: [BigInt(i)],
            })) as Address;
            let sourceId = "0x" as `0x${string}`;
            let standIn = false;
            try {
              sourceId = (await client.readContract({ address: source, abi: SOURCE_ABI, functionName: "SOURCE_ID" })) as `0x${string}`;
            } catch {
              sourceId = "0x";
            }
            try {
              standIn = Boolean(await client.readContract({ address: source, abi: SOURCE_ABI, functionName: "standIn" }));
            } catch {
              standIn = false;
            }
            sources.push({ sourceId, standIn });
          }
        } catch {
          sources.length = 0;
        }
        const agents = got[0] as Address[];
        const budgets = got[1] as bigint[];
        const prices = got[2] as bigint[];
        const sourceIds = got[3] as `0x${string}`[];
        const owed = fills[0] as bigint[];
        const quotes = fills[1] as bigint[];
        const pulled = fills[2] as boolean[];
        const next: Snap = {
          status: Number(status),
          floor: floor as bigint,
          clearing: clearing as bigint,
          softCap: softCap as bigint,
          start: start as bigint,
          end: end as bigint,
          token: token as Address,
          pool: pool as Address,
          poolQuote: poolQuote as bigint,
          vaultFactory: vaultFactory as Address,
          previewOk: preview[0] as boolean,
          previewQuote: preview[2] as bigint,
          previewPrice: preview[1] as bigint,
          bids: agents.map((agent, i) => ({
            agent,
            budget: budgets[i],
            maxPrice: prices[i],
            tokensOwed: owed[i] ?? 0n,
            quoteOwed: quotes[i] ?? 0n,
            pulled: Boolean(pulled[i]),
            sourceId: sourceIds[i] ?? "0x",
          })),
          sources,
        };
        setBlock((prev) => (prev === b ? prev : (b as bigint)));
        setRpcError(false);
        setSnap((prev) => (prev && sameSnap(prev, next) ? prev : next));
      } catch {
        if (!stop) setRpcError(true);
      } finally {
        window.clearTimeout(slow);
      }
    };
    load();
    const timer = setInterval(load, 1000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [launcher, rpc]);

  const status = snap?.status;
  useEffect(() => {
    if (status === undefined) return;
    if (initialStatus.current === null) {
      initialStatus.current = status;
      if (status === 1) {
        setShowToken(true);
        setShowPool(true);
      }
      return;
    }
    if (initialStatus.current === 0 && status === 1 && !animStarted.current) {
      animStarted.current = true;
      const base = reduced ? 0 : SETTLE_MS + SWEEP_MS;
      window.setTimeout(() => setShowToken(true), base);
      window.setTimeout(() => setShowPool(true), base + (reduced ? 0 : ADDR_STAGGER_MS));
    }
  }, [status, reduced]);

  const introOnce = useRef(false);
  const skelSince = useRef(0);
  const [holdSkel, setHoldSkel] = useState(false);
  useEffect(() => {
    if (!launcher || snap) {
      if (!skelSince.current) {
        setHoldSkel(false);
        return;
      }
      const wait = Math.max(0, 400 - (Date.now() - skelSince.current));
      const timer = window.setTimeout(() => {
        skelSince.current = 0;
        setHoldSkel(false);
      }, wait);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      skelSince.current = Date.now();
      setHoldSkel(true);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [launcher, snap]);
  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      const el = event.target;
      if (!(el instanceof HTMLElement) || el.closest("button.primary")) return;
      const dock = document.querySelector("button.primary");
      if (!dock) return;
      const rect = el.getBoundingClientRect();
      const dockTop = dock.getBoundingClientRect().top;
      if (rect.bottom > dockTop - 12) el.scrollIntoView({ block: "center", inline: "nearest" });
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, []);
  useEffect(() => {
    if (!hashReceipt && !hashNote) return;
    document.querySelector(".hash .result-card, .hash .help")?.scrollIntoView({ block: "center" });
  }, [hashReceipt, hashNote]);
  useEffect(() => {
    if (!snap || reduced || introOnce.current) return;
    introOnce.current = true;
    window.setTimeout(() => setIntro(false), 1600);
  }, [snap, reduced]);

  const chainPhase = useMemo(() => {
    if (!snap) return "empty";
    if (snap.status === 2) return "failed";
    if (snap.status === 1) return "done";
    if (block < snap.start) return "wait";
    if (block >= snap.end) return "ready";
    if (block >= snap.end - 20n) return "closed";
    return "open";
  }, [snap, block]);
  const phase = params.get("preview") || chainPhase;

  const clearingNow = snap && snap.status === 1 ? snap.clearing : snap?.previewOk ? snap.previewPrice : 0n;

  const budgetWei = parseBnb(budget);
  const priceWei = parseBnb(maxPrice);
  const bidReady =
    phase === "open" &&
    budgetWei !== null &&
    priceWei !== null &&
    snap !== null &&
    budgetWei >= 10n ** 16n &&
    budgetWei <= 100n * 10n ** 18n &&
    priceWei >= snap.floor;
  const button =
    phase === "open" ? "复制出价指令" : phase === "ready" ? "复制结算指令" : phase === "failed" ? "复制退款指令" : phase === "done" ? "复制领取指令" : "";

  const raised = snap ? snap.bids.reduce((sum, row) => sum + row.budget, 0n) : 0n;
  const capPct = snap && snap.softCap > 0n ? Math.min(100, Number((raised * 10000n) / snap.softCap) / 100) : 0;
  const remain = snap ? (block >= snap.end ? 0n : snap.end - block) : 0n;

  useEffect(() => {
    if (!launcher || !snap || phase !== "ready") {
      setLaunchLine("");
      return;
    }
    const quote = snap.previewOk ? snap.previewQuote : 0n;
    if (quote === 0n) {
      setLaunchLine("未达下限将退款");
      return;
    }
    let stop = false;
    const client = createPublicClient({ transport: http(rpc) });
    (async () => {
      try {
        const config = await client.readContract({
          address: PORTAL,
          abi: PORTAL_ABI,
          functionName: "launchQuoteConfig",
          args: [0, ZERO],
        });
        const price = config[0] && config[1] > 0n ? config[1] : 700n * 10n ** 18n;
        const floor = await client.readContract({
          address: PORTAL,
          abi: PORTAL_ABI,
          functionName: "graduationFloorV2ForLauncher",
          args: [
            {
              quoteToken: ZERO,
              quotePriceUsd: price,
              poolQuote: quote,
              poolToken: SELL,
              totalSupply: SUPPLY,
              vaultFactory: snap.vaultFactory,
            },
            launcher,
          ],
        });
        if (!stop) setLaunchLine(floor.meetsCreateFloor && floor.meetsFloor ? "达到发射下限" : "未达下限将退款");
      } catch {
        if (!stop) setLaunchLine("未达下限将退款");
      }
    })();
    return () => {
      stop = true;
    };
  }, [launcher, phase, rpc, snap]);

  useEffect(() => {
    if (!snap || snap.status !== 1 || snap.token === ZERO) {
      setVault("");
      return;
    }
    let stop = false;
    const client = createPublicClient({ transport: http(rpc) });
    client
      .readContract({ address: PORTAL, abi: PORTAL_ABI, functionName: "getLaunchVault", args: [snap.token] })
      .then((got) => {
        if (!stop) setVault((got as readonly [Address, Address])[0]);
      })
      .catch(() => {
        if (!stop) setVault("");
      });
    return () => {
      stop = true;
    };
  }, [rpc, snap]);

  async function copyInstruction() {
    if (!launcher) return;
    const picked = snap?.sources[sourceIndex];
    const sourceName = picked ? sourceTag(picked.sourceId) || `来源 ${sourceIndex}` : `来源 ${sourceIndex}`;
    const autoAgent = !picked || sourceTag(picked.sourceId) !== "8004";
    const agentLine = autoAgent
      ? "按钱包地址自动识别。合约能调用 tokenOfOwnerByIndex 时用 tokenId，否则用 uint160(你的地址)，把这个数作为第三参。"
      : /^\d+$/.test(agentIdInput.trim())
        ? agentIdInput.trim()
        : "（你在 ERC-8004 登记的编号）";
    const action =
      phase === "open" || !snap
        ? `data: bid(uint256,uint8,uint256)\n- maxPrice wei: ${priceWei}\n- 最高价：${priceWei ? formatPrice(priceWei) : ""} BNB/枚\n- sourceIndex: ${sourceIndex}\n- 来源：${sourceName}\n- agentId: ${agentLine}\n- agentId 说明：Agent ID 不用手填，按上面的规则从钱包地址得出。8004 填官方 Identity Registry 的编号，并且这个钱包必须是 ownerOf(agentId) 或 getAgentWallet(agentId)。同一来源的同一个 agentId 只能出一笔。\n- value wei: ${budgetWei}\n- 预算：${budget} BNB`
        : phase === "ready"
          ? `data: settle()\n- value wei: 0\n- gas limit: ${SETTLE_GAS_LIMIT}\n\ngas limit 固定为 ${SETTLE_GAS_LIMIT}，不要用节点估算值。估算往往只有一两百万。进入 settle 时如果剩余 gas 低于 ${MIN_SETTLE_GAS}，合约直接回滚，这场拍卖保持开放，不会被记成失败。${SETTLE_GAS_LIMIT} 扣掉基础 gas 后仍高于这条线，也够一次发射。`
          : phase === "failed"
            ? "data: refund()\n- value wei: 0"
            : "data: claim()\n- value wei: 0";
    const text = `在 BNB Smart Chain 测试网操作。EVM chainId 是 97。

先做完这三步，缺一步就停止，不要发交易：
1. 跑 baw wallet chains。确认有 BSC 测试网。没有就停，不要改用 56。
2. 确认身份。币安 Agent ID 或 ERC-8004 官方登记，有一个即可。两个都没有就停。Agent ID 可跑 baw wallet agent-id。ERC-8004 要能拿出官方 Identity Registry 的 agentId。
3. 跑 baw wallet settings。Developer Mode 要开着，余额不能超限。

然后只准备这一笔：
- to: ${launcher}
- ${action}
- binanceChainId: 第 1 步看到的测试网 id

先 contract-call preview，把模拟结果给我。我确认之后再 execute。不要改金额，不要多发一笔。`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyFail("");
      setCopied(true);
    } catch {
      setCopyFail(text);
      setCopied(false);
    }
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), COPY_MS);
  }

  async function checkHash() {
    if (!launcher) return;
    const hash = hashInput.trim();
    setHashReceipt(null);
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      setHashNote("哈希是 0x 开头的 66 位字符。");
      return;
    }
    setHashBusy(true);
    setHashNote("");
    try {
      const client = createPublicClient({ transport: http(rpc) });
      const tx = await client.getTransaction({ hash: hash as `0x${string}` });
      const receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` });
      if (tx.to?.toLowerCase() !== launcher.toLowerCase()) {
        setHashNote("这笔交易对不上当前指令。检查是否发到了 chainId 97 的这场合约。");
        return;
      }
      if (receipt.status === "reverted") {
        setHashNote("这笔交易在链上失败了，出价没有进场。按指令重新发一次。");
        return;
      }
      const bidSelector = keccak256(toBytes("bid(uint256,uint8,uint256)")).slice(0, 10);
      const limit = tx.input.startsWith(bidSelector) ? formatPrice(BigInt(`0x${tx.input.slice(10, 74)}`)) : "";
      setHashReceipt({
        hash,
        block: groupFull(receipt.blockNumber),
        amount: formatBnb(tx.value),
        limit,
      });
      setHashNote("");
    } catch {
      setHashNote("这笔交易对不上当前指令。检查是否发到了 chainId 97 的这场合约。");
    } finally {
      setHashBusy(false);
    }
  }

  const failed = phase === "failed";
  const estimate = quoteLine(snap, budgetWei, priceWei, clearingNow);

  const budgetNote = noteBudget(budget);
  const priceNote = snap ? notePrice(maxPrice, snap.floor) : { error: false, text: "", wei: "" };
  const showIntro = intro && !reduced && !!snap;
  const scriptView = params.get("view") === "script";

  if (scriptView) {
    return (
      <div className="page scroll">
        <a className="skip" href="#script">跳到脚本</a>
        <header className="top">
          <b>
            同价发射
            <a className="script-link" href={demo?.open ? `/?launcher=${demo.open}` : "/"}>返回拍卖</a>
          </b>
          <span className="top-meta">{demo?.localFork ? <Zh text="本地分叉，不是测试网" /> : "BSC 测试网"}</span>
        </header>
        <main className="screen" id="script">
          <ScriptPage demo={demo} />
        </main>
      </div>
    );
  }

  return (
    <div className={showIntro ? "page intro" : "page"}>
      {snap ? <div className="dock-fade" aria-hidden="true" /> : null}
      <a className="skip" href="#desk">跳到拍卖</a>
      <header className="top">
        <b>
          同价发射
          <a className="script-link" href="/?view=script">演示脚本</a>
        </b>
        <span className="top-meta">
          {snap?.sources.some((item) => item.standIn) ? <span className="meta-line"><Zh text="测试网 Agent ID 为替身" /></span> : null}
          <span className="meta-line">{demo?.localFork ? <Zh text="本地分叉，不是测试网" /> : "BSC 测试网"}</span>
          {block > 0n && <span className="meta-line">区块 {groupFull(block)}</span>}
          {rpcError ? <span className="meta-line"><Zh text="刚刚没刷新成功，正在重试。" /></span> : null}
        </span>
      </header>
      <p className="status-line"><Zh text={mobileStatus(demo?.localFork, snap?.sources.some((item) => item.standIn))} /></p>
      <main className="screen" id="desk">
        {!launcher && !rpcError && params.get("network") === "testnet" && <TestnetBoard />}
        {!launcher && !rpcError && params.get("network") !== "testnet" && <Empty />}
        {launcher && !snap && (rpcError || holdSkel) && (
          <div className="grid">
            <div className="col-form">
              <h1>同价发射</h1>
              <p className="en">Uniform Launch</p>
              <p className="user-line"><Zh text={USER_LINE} /></p>
              <form className="ticket" onSubmit={(event) => { event.preventDefault(); void copyInstruction(); }}>
                <label htmlFor="budget">预算</label>
                <div className="window">
                  <input id="budget" value={budget} inputMode="decimal" autoComplete="off" spellCheck={false} onChange={(e) => setBudget(e.target.value)} />
                  <span className="unit">BNB</span>
                </div>
                <label htmlFor="price">最高价</label>
                <div className="window">
                  <input id="price" value={maxPrice} inputMode="decimal" autoComplete="off" spellCheck={false} onChange={(e) => setMaxPrice(e.target.value)} />
                  <span className="unit">BNB/枚</span>
                </div>
                <p className="help">链上读数还没到。指令里的金额用你现在填的。</p>
                <button className="primary" type="submit">{copied ? "已复制" : "复制出价指令"}</button>
                <p className="risk"><Zh text={RISK_LINE} /></p>
              </form>
            </div>
            <div className="col-chart">
              <div className="skel plot" />
            </div>
          </div>
        )}
        {snap && (
          <div className="grid">
            <div className="brand-mobile">
              <h1 className="brand-title">同价发射</h1>
              <p className="user-line"><Zh text={USER_LINE} /></p>
            </div>
            <div className="col-form">
              <div>
                <div className="brand-desk">
                <h1>同价发射</h1>
                <p className="en">Uniform Launch</p>
                <p className="user-line"><Zh text={USER_LINE} /></p>
                </div>
                <ol className="phases">
                  {PHASES.map((item) => (
                    <li key={item.id} className={phaseClass(item.id, phase)} aria-current={phaseClass(item.id, phase) === "now" ? "step" : undefined}>
                      {item.label}
                    </li>
                  ))}
                </ol>
                <div className="cap">
                  <span>已募</span>
                  <span>
                    {formatBnb(raised)} / {formatBnb(snap.softCap)} BNB
                  </span>
                </div>
                <div className="bar" aria-hidden="true">
                  <i style={{ transform: `scaleX(${capPct / 100})` }} />
                </div>
                <div className="metrics">
                <div>
                  <b className="clock"><Roller text={formatRemain(remain)} /></b>
                  <small>剩余 {groupFull(remain)} 块，每块 0.75 秒</small>
                </div>
                  <div className="floor">
                    <b>{formatPrice(snap.floor)}</b>
                    <small>保留价 BNB/枚</small>
                  </div>
                </div>
                <form
                  className="ticket"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (phase === "open" && !bidReady) {
                      document.getElementById(budgetNote.error ? "budget" : "price")?.focus();
                      return;
                    }
                    if (button) void copyInstruction();
                  }}
                >
                  <div className="fields">
                    {phase === "failed" ? (
                      <div className="result-card">
                        <h2>没有成交</h2>
                        <p className="help">未达保留价。出价按原数退回，退回后这一行会写成已退回。</p>
                      </div>
                    ) : phase === "done" ? (
                      <div className="result-card">
                        <h2>成交回执</h2>
                        <div className="result-row"><span>开盘价</span><b>{formatPrice(snap.clearing)} BNB/枚</b></div>
                        <div className="result-row"><span>成交量</span><b>{formatBnb(snap.previewQuote > 0n ? snap.previewQuote : snap.poolQuote)} BNB</b></div>
                        <div className="result-row"><span>入池 BNB</span><b>{formatBnb(snap.poolQuote)} BNB</b></div>
                        {showToken && snap.token !== ZERO && <Addr label="代币" value={snap.token} />}
                        {showPool && snap.pool !== ZERO && <Addr label="池子" value={snap.pool} swap={snap.token !== ZERO ? pancakeSwapLink(snap.token) : ""} />}
                        {vault && vault !== ZERO && <Addr label="Flap Vault" value={vault} />}
                      </div>
                    ) : (
                      <>
                    <label htmlFor="budget">预算</label>
                    <div className={`${budgetNote.error && phase === "open" ? "window bad" : "window"}${phase === "open" ? "" : " ro"}`}>
                      <input id="budget" value={budget} readOnly={phase !== "open"} inputMode="decimal" autoComplete="off" spellCheck={false} aria-invalid={phase === "open" && budgetNote.error} aria-describedby="budget-help" onChange={(e) => setBudget(e.target.value)} />
                      <span className="unit">BNB</span>
                    </div>
                    <p id="budget-help" className={phase === "open" && budgetNote.error ? "help bad" : "help"} role={phase === "open" && budgetNote.error ? "alert" : undefined}><Zh text={phase === "open" ? budgetNote.text : " "} /></p>
                    <label htmlFor="price">最高价</label>
                    <div className={`${priceNote.error && phase === "open" ? "window bad" : "window"}${phase === "open" ? "" : " ro"}`}>
                      <input id="price" value={maxPrice} readOnly={phase !== "open"} inputMode="decimal" autoComplete="off" spellCheck={false} placeholder={formatPrice(snap.floor)} aria-invalid={phase === "open" && priceNote.error} aria-describedby="price-help" onChange={(e) => setMaxPrice(e.target.value)} />
                      <span className="unit">BNB/枚</span>
                    </div>
                    <p id="price-help" className={phase === "open" && priceNote.error ? "help bad" : "help"} role={phase === "open" && priceNote.error ? "alert" : undefined}><Zh text={phase === "open" ? priceNote.text : " "} /></p>
                    <label id="source-label">身份来源</label>
                    <div
                      className="seg"
                      role="radiogroup"
                      aria-labelledby="source-label"
                      data-on={sourceIndex === 1 ? "1" : "0"}
                      data-lock={phase === "open" ? "0" : "1"}
                      onKeyDown={(event) => {
                        if (phase !== "open") return;
                        if (event.key === "ArrowRight") setSourceIndex(1);
                        if (event.key === "ArrowLeft") setSourceIndex(0);
                      }}
                    >
                      <i className="thumb" />
                      {(snap.sources.length > 0 ? snap.sources : [{ sourceId: BINANCE_SOURCE, standIn: false }, { sourceId: ERC8004_SOURCE, standIn: false }]).slice(0, 2).map((item, index) => (
                        <button
                          key={item.sourceId + index}
                          type="button"
                          role="radio"
                          aria-checked={sourceIndex === index}
                          tabIndex={phase === "open" && sourceIndex === index ? 0 : -1}
                          onClick={() => phase === "open" && setSourceIndex(index)}
                        >
                          {sourceTag(item.sourceId) || (index === 0 ? "Agent ID" : "8004")}
                        </button>
                      ))}
                    </div>
                    <label htmlFor="agent">代理编号</label>
                    {sourceTag(snap.sources[sourceIndex]?.sourceId ?? "") === "8004" ? (
                      <div className={phase === "open" ? "window" : "window ro"}>
                        <input id="agent" value={agentIdInput} readOnly={phase !== "open"} inputMode="numeric" autoComplete="off" spellCheck={false} placeholder="你在 ERC-8004 登记的编号" onChange={(e) => setAgentIdInput(e.target.value.replace(/[^\d]/g, ""))} />
                      </div>
                    ) : (
                      <p className="id-lock" id="agent">按钱包地址自动识别<i>只读</i></p>
                    )}
                    <p className="estimate"><Zh text={phase === "open" ? estimate : " "} /></p>
                    {phase === "open" && <p className="field-help"><Zh text="编号怎么填，写在复制出的指令里。" /></p>}
                      </>
                    )}
                  </div>
                  <div className="action">
                    {phase === "open" && snap.bids.length >= 32 ? (
                      <div className="notice">本场出价已满 32 笔，不再接新单。</div>
                    ) : phase === "wait" ? (
                      <div className="notice">开始后可以复制出价指令。</div>
                    ) : phase === "closed" ? (
                      <div className="notice">已停止接单，等待结算。</div>
                    ) : button ? (
                      <button className="primary" type="submit" aria-live="polite">
                        <span>{copied ? "已复制" : button}</span>
                      </button>
                    ) : null}
                    {phase === "open" && snap.bids.length < 32 && <p className="risk"><Zh text={RISK_LINE} /></p>}
                    {phase === "ready" && <p className="help"><Zh text="结算要用的燃料上限已写在指令里，照指令发。" /></p>}
                  </div>
                </form>
                {copyFail && (
                  <>
                    <p className="help bad"><i className="mark" />没复制上。长按下面的指令全选复制。</p>
                    <textarea className="paste" readOnly value={copyFail} />
                  </>
                )}
                <button type="button" className="hash-toggle" aria-expanded={hashOpen} onClick={() => setHashOpen((open) => !open)}>
                  <Zh text="已发送？贴哈希核对" />
                </button>
                {hashOpen && (
                  <div className="hash">
                    <label htmlFor="txhash">交易哈希</label>
                    <div className={hashNote.startsWith("哈希") ? "window bad" : "window"}>
                      <input id="txhash" value={hashInput} spellCheck={false} autoComplete="off" onChange={(e) => setHashInput(e.target.value)} />
                    </div>
                    {hashNote && <p className="help bad" role="status"><i className="mark" />{hashNote}</p>}
                    <button className="text-btn" type="button" onClick={() => void checkHash()} disabled={hashBusy}>
                      {hashBusy ? "核对中…" : "核对"}
                    </button>
                    {hashReceipt && (
                      <div className="result-card">
                        <h2>交易已核对</h2>
                        <div className="result-row"><span>交易</span><b>{hashReceipt.hash.slice(0, 6)}…{hashReceipt.hash.slice(-4)}</b></div>
                        <div className="result-row"><span>区块</span><b>{hashReceipt.block}</b></div>
                        <div className="result-row"><span>出价</span><b>{hashReceipt.amount} BNB</b></div>
                        {hashReceipt.limit && <div className="result-row"><span>限价</span><b>{hashReceipt.limit} BNB/枚</b></div>}
                        {demo?.localFork ? (
                          <p className="help">本地分叉上的交易，BscScan 还没有这笔。</p>
                        ) : (
                          <a href={`https://testnet.bscscan.com/tx/${hashReceipt.hash}`} target="_blank" rel="noreferrer">BscScan</a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="col-chart">
              <div className="chart-head">
                <div>
                  <div className="kicker">{failed ? "结果" : phase === "done" ? "开盘价 BNB/枚" : "当前清算价 BNB/枚"}</div>
                  <div className={phase !== "wait" && clearingNow > 0n && !failed ? "chart-price" : "chart-price dim"}>
                    {failed ? "没有成交" : phase === "wait" ? "未形成" : clearingNow > 0n ? <Roller text={formatPrice(clearingNow)} /> : "未形成"}
                  </div>
                  {failed && <p className="fail-line"><Zh text="未达保留价，出价全额退回。" /></p>}
                </div>
                <div className="axis-note" />
              </div>
              <div className="plot-wrap">
                <PlotStage
                  bids={params.get("preview") === "wait" ? [] : snap.bids}
                  floor={snap.floor}
                  clearing={params.get("preview") === "wait" || failed ? null : clearingNow > 0n ? clearingNow : null}
                  failed={failed}
                  settle={snap.status === 1}
                  intro={showIntro}
                  reduced={reduced}
                  yourPrice={phase === "open" ? priceWei : null}
                  hideEmpty={phase === "wait"}
                />
                {phase === "wait" && <div className="empty">接单还没开始，开始区块 {groupFull(snap.start)}。</div>}
              </div>
            </div>
            <div className="col-bids">
              <h2 className="group-title">本场参数</h2>
              <ul className="facts">
                <li><span>出售</span><span>500,000 枚</span></li>
                <li><span>入池代币</span><span>500,000 枚</span></li>
                <li><span>买入税 / 卖出税</span><span>3% / 3%</span></li>
                <li><span>本场出价</span><span>{snap.bids.length} / 32</span></li>
              </ul>
              <BidTable rows={snap.bids} phase={phase} clearing={clearingNow} />
            </div>
          </div>
        )}
      </main>
    </div>
  );

}

function TestnetBoard() {
  return (
    <div className="grid">
      <div>
        <h1>同价发射</h1>
        <p className="en">Uniform Launch</p>
        <p className="user-line"><Zh text={USER_LINE} /></p>
      </div>
      <div className="plaque">
        <p>工厂已部署，Flap 开通权限后开第一场。</p>
        {TESTNET_ROWS.map((row) => (
          <div className="row" key={row.address}>
            <span className="name">{row.name}</span>
            <span className="addr">{row.address.slice(0, 6)}…{row.address.slice(-4)}</span>
            {row.standIn && <span className="tag">替身</span>}
            <button type="button" onClick={() => navigator.clipboard.writeText(row.address)}>复制</button>
            <a href={`https://testnet.bscscan.com/address/${row.address}`} target="_blank" rel="noreferrer">BscScan</a>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="grid">
      <div>
        <h1>同价发射</h1>
        <p className="en">Uniform Launch</p>
        <p className="user-line"><Zh text={USER_LINE} /></p>
      </div>
      <div className="plot-wrap empty-plot">
        <svg className="plot" viewBox="0 0 640 360" preserveAspectRatio="none" aria-hidden="true">
          <line className="axis" x1="78" y1="18" x2="78" y2="332" />
          <line className="axis" x1="78" y1="332" x2="622" y2="332" />
        </svg>
        <div className="empty">
          <p><Zh text="还没有这场拍卖。" /></p>
          <a href="/?view=script">打开演示脚本</a>
        </div>
      </div>
    </div>
  );
}

function BidTable({ rows, phase, clearing }: { rows: Row[]; phase: string; clearing: bigint }) {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const ids = rows.map((row) => row.agent.toLowerCase());
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const arrived = ids.filter((id) => !seen.current?.has(id));
    for (const id of ids) seen.current.add(id);
    if (arrived.length === 0) return;
    setFresh(new Set(arrived));
    const timer = window.setTimeout(() => setFresh(new Set()), 1200);
    return () => window.clearTimeout(timer);
  }, [rows]);
  return (
    <div className="bids">
      <div className="bid head">
        <span />
        <span>代理</span>
        <span>预算</span>
        <span>限价</span>
        <span>状态</span>
      </div>
      {rows.map((row) => {
        const mark = rowMark(row, phase, clearing);
        const label = agentLabel(row.agent);
        const id = row.agent.toLowerCase();
        return (
          <div className={`${fresh.has(id) ? "bid fresh" : "bid"} ${mark.label === "价内" || mark.label === "待领取" ? "in" : mark.label === "边际" ? "mid" : mark.label === "价外" ? "out" : ""}`} key={row.agent}>
            <i className={mark.dot} />
            <span className={label.named ? "agent-name" : "agent-addr"}>
              {label.text}
              {sourceTag(row.sourceId) && <i className="src-tag">{sourceTag(row.sourceId)}</i>}
            </span>
            <span>{formatBnb(row.budget)} BNB</span>
            <span>{formatPrice(row.maxPrice)}</span>
            <span className={mark.tone}>{mark.label}</span>
          </div>
        );
      })}
    </div>
  );
}

const BINANCE_SOURCE = keccak256(toBytes("binance-agent-id"));
const ERC8004_SOURCE = keccak256(toBytes("erc-8004"));

function mobileStatus(localFork: boolean | undefined, standIn: boolean | undefined): string {
  if (localFork && standIn) return "本地分叉，测试网 Agent ID 为替身";
  if (localFork) return "本地分叉，不是测试网";
  return "BNB Chain 测试网";
}

function sourceTag(sourceId: string): string {
  const id = sourceId.toLowerCase();
  if (id === BINANCE_SOURCE) return "Agent ID";
  if (id === ERC8004_SOURCE) return "8004";
  return "";
}

function rowMark(row: Row, phase: string, clearing: bigint): { label: string; dot: string; tone: string } {
  if (phase === "failed") {
    return row.pulled
      ? { label: "已退回", dot: "dot off", tone: "tone-mute" }
      : { label: "待退款", dot: "dot off", tone: "tone-text" };
  }
  if (phase === "done") {
    if (row.pulled && row.tokensOwed === 0n && row.quoteOwed === 0n) {
      return { label: "已领取", dot: "dot in", tone: "tone-gold" };
    }
    if (row.tokensOwed > 0n) return { label: "待领取", dot: "dot in", tone: "tone-gold" };
    return { label: "未成交", dot: "dot off", tone: "tone-mute" };
  }
  if (clearing === 0n) return { label: "待定", dot: "dot off", tone: "tone-mute" };
  if (row.maxPrice > clearing) return { label: "价内", dot: "dot in", tone: "tone-gold" };
  if (row.maxPrice === clearing) return { label: "边际", dot: "dot mid", tone: "tone-text" };
  return { label: "价外", dot: "dot off", tone: "tone-mute" };
}

function phaseClass(id: string, phase: string) {
  if (phase === "failed") {
    if (id === "failed") return "now";
    if (id === "done") return "future";
    return "past";
  }
  const order = ["wait", "open", "closed", "ready", "done"];
  if (id === "failed") return "future";
  const cur = order.indexOf(phase);
  const at = order.indexOf(id);
  if (at < cur) return "past";
  if (at === cur) return "now";
  return "future";
}

function noteBudget(raw: string): { error: boolean; text: string; wei: string } {
  if (!raw.trim()) return { error: false, text: "单笔 0.01 到 100 BNB。", wei: "" };
  const value = parseBnb(raw);
  if (value === null) return { error: true, text: "用十进制数字，例如 1.5。", wei: "" };
  if (value < 10n ** 16n) return { error: true, text: "单笔至少 0.01 BNB。", wei: "" };
  if (value > 100n * 10n ** 18n) return { error: true, text: "单笔最多 100 BNB。", wei: "" };
  return { error: false, text: "单笔 0.01 到 100 BNB。", wei: groupFull(value) };
}

function notePrice(raw: string, floor: bigint): { error: boolean; text: string; wei: string } {
  if (!raw.trim()) return { error: false, text: `不能低于保留价 ${formatPrice(floor)}。`, wei: "" };
  const value = parseBnb(raw);
  if (value === null) return { error: true, text: "用十进制数字，例如 0.00003。", wei: "" };
  if (value < floor) return { error: true, text: "低于保留价，这笔不会入场。", wei: "" };
  return { error: false, text: `不能低于保留价 ${formatPrice(floor)}。`, wei: groupFull(value) };
}

function groupFull(value: bigint): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function sameSnap(a: Snap, b: Snap) {
  if (a.status !== b.status || a.floor !== b.floor || a.clearing !== b.clearing || a.softCap !== b.softCap) return false;
  if (a.start !== b.start || a.end !== b.end || a.token !== b.token || a.pool !== b.pool || a.poolQuote !== b.poolQuote) return false;
  if (a.vaultFactory !== b.vaultFactory || a.previewQuote !== b.previewQuote) return false;
  if (a.previewOk !== b.previewOk || a.previewPrice !== b.previewPrice || a.bids.length !== b.bids.length) return false;
  if (a.sources.length !== b.sources.length) return false;
  if (a.sources.some((item, i) => item.sourceId !== b.sources[i].sourceId || item.standIn !== b.sources[i].standIn)) return false;
  return a.bids.every((row, i) => row.agent === b.bids[i].agent && row.budget === b.bids[i].budget && row.maxPrice === b.bids[i].maxPrice && row.pulled === b.bids[i].pulled && row.tokensOwed === b.bids[i].tokensOwed && row.sourceId === b.bids[i].sourceId);
}

function Skeleton() {
  return (
    <div className="grid" aria-hidden="true">
      <div>
        <div className="skel w1" />
        <div className="skel w2" />
        <div className="skel w3" />
        <div className="skel w2" />
      </div>
      <div className="skel plot" />
    </div>
  );
}

function quoteLine(snap: Snap | null, budgetWei: bigint | null, priceWei: bigint | null, clearing: bigint) {
  if (!snap) return "";
  if (budgetWei === null || priceWei === null) return "按 BNB 填写预算和最高价。";
  if (priceWei < snap.floor) return "低于保留价，这笔不会入场。";
  if (clearing === 0n) return "清算价未形成。";
  if (priceWei < clearing) return "低于当前清算价，按现价不会成交。";
  return `按当前清算价可得约 ${formatTokens(tokensFor(budgetWei, clearing))} 枚。`;
}

function Addr({ label, value, swap }: { label: string; value: string; swap?: string }) {
  return (
    <div className="addr show">
      <span className="addr-label">{label}</span>
      <span className="addr-value">{value.slice(0, 6)}…{value.slice(-4)}</span>
      <button type="button" aria-label={`复制${label}地址`} onClick={() => navigator.clipboard.writeText(value)}>复制</button>
      <a href={`https://testnet.bscscan.com/address/${value}`} target="_blank" rel="noreferrer">
        BscScan
      </a>
      {swap && (
        <a href={swap} target="_blank" rel="noreferrer">
          PancakeSwap
        </a>
      )}
    </div>
  );
}
