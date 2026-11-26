import { language, languageHref, localizedHref, t } from "./locale";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPublicClient, http, isAddress, parseAbi, keccak256, toBytes, type Address } from "viem";
import { formatBnb, formatBnb4, formatPrice, formatRemain, formatTokens, parseBnb, tokensFor } from "./curve";
import { agentLabel } from "./names";
import { Roller, useReducedMotion, Zh } from "./motion";
import { PlotStage } from "./PlotStage";
import { pancakeSwapLink } from "./dex";
// @ts-expect-error 共享模拟器是普通 JavaScript，返回值在调用处收窄。
import { MAX_PRICE, settle as settleBids } from "../../shared/settle.mjs";
import { ADDR_STAGGER_MS, COPY_MS, RISK_LINE, SETTLE_MS, SWEEP_MS, USER_LINE } from "./theme";
import { ReceiptPanel } from "./ReceiptPanel";
import type { Action, Intent, Tracking } from "./receipts";
import { TESTNET, TESTNET_ROWS } from "./networks";
import { FundingProgress, PriceComparison, SettlementSummary, SimulationSummary, type Comparison } from "./AuctionFigures";

const ABI = [
  { type: "function", name: "admittedWalletCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "MAX_BIDS", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "MIN_SETTLE_GAS", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "status", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "floorPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "clearingPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "minPoolQuote", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "softCap", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "startBlock", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "endBlock", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "token", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "pool", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "poolQuote", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "vaultFactory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "creator", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
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
type WhyFile = Comparison;
const SCENES = [
  t("接单与清算价", "Bids and clearing price"),
  t("填写限价委托", "Set a bid limit"),
  t("模拟本笔出价", "Simulate your bid"),
  t("发射与交易税", "Launch and trading tax"),
  t("未达门槛，全额退款", "Below target, full refund"),
  t("对照两种发行价格", "Compare launch prices"),
];
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
  maxBids: number;
  rostered: boolean;
  minSettleGas: bigint;
  status: number;
  floor: bigint;
  clearing: bigint;
  softCap: bigint;
  minPoolQuote: bigint | null;
  start: bigint;
  end: bigint;
  token: Address;
  pool: Address;
  poolQuote: bigint;
  vaultFactory: Address;
  marketingRecipient: Address | null;
  previewOk: boolean;
  previewQuote: bigint;
  previewPrice: bigint;
  bids: Row[];
  sources: SourceInfo[];
};

const ZERO = "0x0000000000000000000000000000000000000000";
const trustedTestnetFactories = new Set<string>([
  TESTNET.launcherFactory.toLowerCase(),
]);
const marketingFactory = import.meta.env.VITE_MARKETING_LAUNCHER_FACTORY?.trim().toLowerCase();
if (marketingFactory && marketingFactory !== ZERO && isAddress(marketingFactory)) {
  trustedTestnetFactories.add(marketingFactory);
}
const PHASES = [
  { id: "wait", label: t("未开始", "Pending") },
  { id: "open", label: t("接单", "Open") },
  { id: "closed", label: t("截单", "Closed") },
  { id: "ready", label: t("待结算", "Ready") },
  { id: "done", label: t("已发射", "Launched") },
  { id: "failed", label: t("失败", "Failed") },
] as const;

export function App() {
  const params = new URLSearchParams(location.search);
  const [demo, setDemo] = useState<DemoFile | null>(null);
  const [demoState, setDemoState] = useState<"load" | "ready" | "missing">("load");
  const [block, setBlock] = useState(0n);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [rpcError, setRpcError] = useState(false);
  const [rpcNote, setRpcNote] = useState("");
  const [budget, setBudget] = useState("1");
  const [maxPrice, setMaxPrice] = useState("0.00003");
  const [sourceIndex, setSourceIndex] = useState(0);
  const [agentIdInput, setAgentIdInput] = useState("");
  const [sender, setSender] = useState(() => new URLSearchParams(location.search).get("account") || "");
  const [pending, setPending] = useState<{ scope: string; request: Tracking } | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [showPool, setShowPool] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFail, setCopyFail] = useState("");
  const [launchLine, setLaunchLine] = useState("");
  const [vault, setVault] = useState("");
  const [vaultBal, setVaultBal] = useState<bigint | null>(null);
  const [intro, setIntro] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const initialStatus = useRef<number | null>(null);
  const animStarted = useRef(false);
  const copyTimer = useRef(0);
  const reduced = useReducedMotion();

  const forceEmpty = params.get("empty") === "1";
  const testnetBoard = params.get("network") === "testnet" && !params.get("launcher");
  const demoOn = params.get("demo") === "1" || params.get("view") === "script";
  const [scene, setScene] = useState(() => {
    const requested = params.get("scene") ?? "";
    if (!demoOn || !/^[1-9]\d*$/.test(requested)) return 0;
    const number = Number(requested);
    return number <= SCENES.length ? number - 1 : 0;
  });
  const [why, setWhy] = useState<WhyFile | null>(null);
  const sceneAddress = [demo?.open, demo?.open, demo?.open, demo?.launched, demo?.failed, demo?.open][scene] || "";
  const launcher = (forceEmpty || testnetBoard ? "" : demoOn ? sceneAddress : params.get("launcher") || demo?.open || "") as Address;
  const publicTestnet = !demoOn && params.get("network") === "testnet";
  const localFork = !publicTestnet;
  const rpc = publicTestnet ? "https://bsc-testnet-rpc.publicnode.com" : demo?.rpc || "http://127.0.0.1:18545";
  const scope = `uniform.receipt.v1:${rpc}:${launcher.toLowerCase()}`;
  const restored = useMemo(() => {
    if (!publicTestnet || !launcher) return null;
    try {
      const saved = JSON.parse(sessionStorage.getItem(scope) || "null") as Tracking | null;
      return saved && saved.intent?.launcher.toLowerCase() === launcher.toLowerCase() &&
        isAddress(saved.intent.account, { strict: false }) && /^\d+$/.test(saved.afterBlock) ? saved : null;
    } catch { return null; }
  }, [publicTestnet, launcher, scope]);
  const tracking = pending?.scope === scope ? pending.request : restored;
  useEffect(() => {
    if (publicTestnet) return;
    fetch("/demo.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("missing"))))
      .then((data) => {
        setDemo(data);
        setDemoState("ready");
      })
      .catch(() => {
        setDemo({});
        setDemoState("missing");
      });
  }, [publicTestnet]);
  useEffect(() => {
    if (!demoOn) return;
    fetch("/why.json").then((r) => (r.ok ? r.json() : null)).then(setWhy).catch(() => setWhy(null));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        window.location.assign(localizedHref("/"));
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, [role=radiogroup]")) return;
      if (event.key === "ArrowRight") setScene((n) => Math.min(SCENES.length - 1, n + 1));
      if (event.key === "ArrowLeft") setScene((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [demoOn]);
  useEffect(() => {
    setCopied(false);
    setCopyFail("");
  }, [scene]);

  const seenLauncher = useRef("");
  useEffect(() => {
    if (!launcher) return;
    if (seenLauncher.current && seenLauncher.current !== launcher) {
      setSnap(null);
      setHoldSkel(true);
      setSourceIndex(0);
    }
    seenLauncher.current = launcher;
    setRpcNote("");
    setRpcError(false);
    const client = createPublicClient({ transport: http(rpc, { timeout: 8_000 }) });
    let stop = false;
    let inflight = false;
    let dead = false;
    let verifiedNetwork = false;
    let timer = 0;
    let cachedSources: SourceInfo[] | undefined;
    let marketingRecipient: Address | null = null;
    async function readSources() {
      if (cachedSources) return cachedSources;
      try {
        const count = await client.readContract({ address: launcher, abi: ABI, functionName: "identitySourceCount" });
        let complete = true;
        const sources = await Promise.all(Array.from({ length: Number(count) }, async (_, index) => {
          const address = await client.readContract({ address: launcher, abi: ABI, functionName: "identitySources", args: [BigInt(index)] });
          const [id, standIn] = await Promise.all([
            client.readContract({ address, abi: SOURCE_ABI, functionName: "SOURCE_ID" }).catch(() => null),
            client.readContract({ address, abi: SOURCE_ABI, functionName: "standIn" }).catch(() => null),
          ]);
          if (id === null || standIn === null) complete = false;
          return { sourceId: id ?? "0x", standIn: standIn ?? false } satisfies SourceInfo;
        }));
        // Sources are fixed at initialization. Retry partial or unsupported metadata on the next poll.
        if (complete) cachedSources = sources;
        return sources;
      } catch {
        return [];
      }
    }
    async function readBids() {
      try {
        return await client.readContract({ address: launcher, abi: ABI, functionName: "getBids" });
      } catch {
        const legacy = await client.readContract({ address: launcher, abi: LEGACY_BIDS, functionName: "getBids" });
        return [legacy[0], legacy[1], legacy[2], [], []] as const;
      }
    }
    const load = async () => {
      if (dead) {
        window.clearInterval(timer);
        return;
      }
      if (inflight) return;
      inflight = true;
      const slow = publicTestnet ? undefined : window.setTimeout(() => {
        if (!stop) setRpcError(true);
      }, 3000);
      try {
        if (publicTestnet && !verifiedNetwork) {
          if (!isAddress(launcher, { strict: false }) || await client.getChainId() !== TESTNET.chainId) {
            if (!stop) setRpcNote(t("请检查测试网和拍卖合约地址。", "Check the testnet and auction contract address."));
            dead = true;
            return;
          }
          const factory = await client.readContract({
            address: PORTAL, abi: parseAbi(["function getLauncher(address) view returns (address)"]),
            functionName: "getLauncher", args: [launcher],
          });
          if (!trustedTestnetFactories.has(factory.toLowerCase())) {
            if (!stop) setRpcNote(t("这个地址不属于同价发射的测试网工厂。", "This address is not an auction from the Uniform Launch testnet factory."));
            dead = true;
            return;
          }
          verifiedNetwork = true;
        }
        const [b, status, floor, clearing, softCap, minPoolQuote, start, end, token, pool, poolQuote, vaultFactory, preview, fills, got, sources, maxBids, minSettleGas, admittedWalletCount] = await Promise.all([
          client.getBlockNumber(),
          client.readContract({ address: launcher, abi: ABI, functionName: "status" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "floorPrice" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "clearingPrice" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "softCap" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "minPoolQuote" }).catch(() => null),
          client.readContract({ address: launcher, abi: ABI, functionName: "startBlock" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "endBlock" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "token" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "pool" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "poolQuote" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "vaultFactory" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "preview" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "getFills" }),
          readBids(),
          readSources(),
          client.readContract({ address: launcher, abi: ABI, functionName: "MAX_BIDS" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "MIN_SETTLE_GAS" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "admittedWalletCount" }).catch(() => 0n),
        ]);
        if (vaultFactory === ZERO && !marketingRecipient) {
          marketingRecipient = await client.readContract({ address: launcher, abi: ABI, functionName: "creator" }).catch(() => null);
        }
        if (stop) return;
        const agents = got[0] as Address[];
        const budgets = got[1] as bigint[];
        const prices = got[2] as bigint[];
        const sourceIds = got[3] as `0x${string}`[];
        const owed = fills[0] as bigint[];
        const quotes = fills[1] as bigint[];
        const pulled = fills[2] as boolean[];
        const next: Snap = {
          maxBids: Number(admittedWalletCount || maxBids),
          rostered: admittedWalletCount > 0n,
          minSettleGas,
          status: Number(status),
          floor: floor as bigint,
          clearing: clearing as bigint,
          softCap: softCap as bigint,
          minPoolQuote,
          start: start as bigint,
          end: end as bigint,
          token: token as Address,
          pool: pool as Address,
          poolQuote: poolQuote as bigint,
          vaultFactory: vaultFactory as Address,
          marketingRecipient,
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
        setRpcNote("");
        setSnap((prev) => (prev && sameSnap(prev, next) ? prev : next));
      } catch (error) {
        if (!stop) {
          const err = error as { shortMessage?: string; message?: string };
          const text = `${err.shortMessage || ""} ${err.message || ""}`;
          if (/returned no data/i.test(text)) {
            dead = true;
            setRpcError(false);
            setRpcNote(t("这个地址上没有这场拍卖。检查地址是不是这一场的合约。", "No auction found at this address. Check the auction contract."));
          } else {
            setRpcNote("");
            setRpcError(true);
          }
        }
      } finally {
        inflight = false;
        window.clearTimeout(slow);
      }
    };
    load();
    timer = window.setInterval(load, publicTestnet ? 5000 : 1000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [launcher, rpc, publicTestnet]);

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
  const preview = params.get("preview");
  const forced = preview && ["wait", "open", "closed", "ready", "done", "failed"].includes(preview) ? preview : null;
  const phase = forced ?? chainPhase;
  const previewing = forced != null && forced !== chainPhase;

  const clearingNow = snap && snap.status === 1 ? snap.clearing : snap?.previewOk ? snap.previewPrice : 0n;

  const budgetWei = parseBnb(budget);
  const priceWei = parseBnb(maxPrice);
  const sim = useMemo(() => {
    if (!demoOn || scene !== 2 || !snap || budgetWei == null || priceWei == null ||
        budgetWei < 10n ** 16n || budgetWei > 100n * 10n ** 18n || priceWei < snap.floor || priceWei > MAX_PRICE || snap.bids.length >= snap.maxBids) return null;
    const rows = snap.bids.map((row, index) => ({ index: BigInt(index), budget: row.budget, maxPrice: row.maxPrice }));
    rows.push({ index: BigInt(rows.length), budget: budgetWei, maxPrice: priceWei });
    return settleBids(500_000n * 10n ** 18n, snap.floor, rows) as {
      clearingPrice: bigint;
      poolQuote: bigint;
      fills: { tokens: bigint; spend: bigint; refund: bigint }[];
    };
  }, [demoOn, scene, snap, budgetWei, priceWei]);
  const bidReady =
    phase === "open" &&
    budgetWei !== null &&
    priceWei !== null &&
    snap !== null &&
    budgetWei >= 10n ** 16n &&
    budgetWei <= 100n * 10n ** 18n &&
    priceWei >= snap.floor && priceWei <= MAX_PRICE;
  const button =
    phase === "open" ? t("复制出价指令", "Copy bid instruction") : phase === "ready" ? t("复制结算指令", "Copy settlement instruction") : phase === "failed" ? t("复制退款指令", "Copy refund instruction") : phase === "done" ? t("复制领取指令", "Copy claim instruction") : "";

  const settledBids = publicTestnet && phase === "done" && snap ? snap.bids : [];
  const signer = sender.trim().toLowerCase();
  const signerClaimed = settledBids.some((bid) => bid.pulled && bid.agent.toLowerCase() === signer);
  const allClaimed = settledBids.length > 0 && settledBids.every((bid) => bid.pulled);
  const claimNotice = signerClaimed ? t("这个地址已领取。", "This address has already claimed.") : allClaimed ? t("本场出价均已领取。", "All bids have been claimed.") : "";

  const raised = snap ? snap.bids.reduce((sum, row) => sum + row.budget, 0n) : 0n;
  const poolSetsTarget = snap?.minPoolQuote != null && snap.minPoolQuote > snap.softCap;
  const targetRaise = poolSetsTarget ? snap.minPoolQuote! : snap?.softCap ?? 0n;
  const remain = snap ? (block >= snap.end ? 0n : snap.end - block) : 0n;

  useEffect(() => {
    if (!launcher || !snap || phase !== "ready") {
      setLaunchLine("");
      return;
    }
    const quote = snap.previewOk ? snap.previewQuote : 0n;
    if (quote === 0n) {
      setLaunchLine(t("未达下限将退款", "Below the launch minimum. Bids will be refunded."));
      return;
    }
    let stop = false;
    const client = createPublicClient({ transport: http(rpc, { timeout: 8_000 }) });
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
        if (!stop) setLaunchLine(floor.meetsCreateFloor && floor.meetsFloor ? t("达到发射下限", "Launch minimum reached") : t("未达下限将退款", "Below the launch minimum. Bids will be refunded."));
      } catch {
        if (!stop) setLaunchLine(t("未达下限将退款", "Below the launch minimum. Bids will be refunded."));
      }
    })();
    return () => {
      stop = true;
    };
  }, [launcher, phase, rpc, snap]);

  useEffect(() => {
    if (!snap || snap.vaultFactory === ZERO || snap.status !== 1 || snap.token === ZERO) {
      setVault("");
      return;
    }
    let stop = false;
    const client = createPublicClient({ transport: http(rpc, { timeout: 8_000 }) });
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

  useEffect(() => {
    if (!vault || vault === ZERO) {
      setVaultBal(null);
      return;
    }
    let stop = false;
    const client = createPublicClient({ transport: http(rpc, { timeout: 8_000 }) });
    client.readContract({
      address: vault as Address,
      abi: [{ type: "function", name: "accrued", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }] as const,
      functionName: "accrued",
    }).then((got) => {
      if (!stop) setVaultBal(got);
    }).catch(() => {
      if (!stop) setVaultBal(null);
    });
    return () => {
      stop = true;
    };
  }, [rpc, vault]);

  const operation: Action | null = phase === "open" ? "bid" : phase === "ready" ? "settle" : phase === "done" ? "claim" : phase === "failed" ? "refund" : null;
  const ercSource = sourceTag(snap?.sources[sourceIndex]?.sourceId ?? "") === "8004";
  const draft: Intent | null = operation && launcher ? {
    action: operation, launcher, account: publicTestnet ? sender.trim() : "",
    value: operation === "bid" ? String(budgetWei ?? "") : "0", limit: String(priceWei ?? ""),
    source: sourceIndex, id: ercSource && agentIdInput ? BigInt(agentIdInput).toString() : "",
  } : null;
  async function copyInstruction() {
    if (!snap || !draft || previewing || claimNotice || (publicTestnet && (!isAddress(sender.trim(), { strict: false }) || !block))) return;
    const picked = snap?.sources[sourceIndex];
    const sourceName = sourceTag(picked?.sourceId ?? "") || t(`来源 ${sourceIndex}`, `Source ${sourceIndex}`);
    const autoAgent = !picked || (sourceTag(picked.sourceId) === "Agent ID" && picked.standIn);
    const agentLine = autoAgent
      ? t("按钱包地址自动识别。合约能调用 tokenOfOwnerByIndex 时用 tokenId，否则用 uint160(你的地址)，把这个数作为第三参。", "Derive the third argument from the wallet. Use tokenId if tokenOfOwnerByIndex is supported, otherwise use uint160(wallet address).")
      : /^\d+$/.test(agentIdInput.trim())
        ? agentIdInput.trim()
        : t("（链上身份 token ID）", "(your on-chain identity token ID)");
    const settlementGasLimit = snap ? snap.minSettleGas + 1_000_000n : null;
    const action =
      phase === "open" || !snap
        ? t(
          `data: bid(uint256,uint8,uint256)\n- maxPrice wei: ${priceWei}\n- 最高价：${priceWei ? formatPrice(priceWei) : ""} BNB/枚\n- sourceIndex: ${sourceIndex}\n- 来源：${sourceName}\n- agentId: ${agentLine}\n- agentId 说明：真实 Agent ID 使用 NFT token ID，测试网替身按上面的规则确认。8004 填官方 Identity Registry 的编号，并且这个钱包必须是 ownerOf(agentId) 或 getAgentWallet(agentId)。同一来源的同一个 agentId 只能出一笔。\n- value wei: ${budgetWei}\n- 预算：${budget} BNB`,
          `data: bid(uint256,uint8,uint256)\n- maxPrice wei: ${priceWei}\n- Limit: ${priceWei ? formatPrice(priceWei) : ""} BNB/token\n- sourceIndex: ${sourceIndex}\n- Source: ${sourceName}\n- agentId: ${agentLine}\n- Use the NFT token ID for a real Agent ID. For a testnet stand-in, verify the ID as described above. For ERC-8004, use the official Identity Registry ID. This wallet must be ownerOf(agentId) or getAgentWallet(agentId). Each ID can bid once per source.\n- value wei: ${budgetWei}\n- Budget: ${budget} BNB`,
        )
        : phase === "ready"
          ? t(
            `data: settle()\n- value wei: 0\n- gas limit: ${settlementGasLimit}\n\n请使用该场的 gas limit。进入 settle 时如果剩余 gas 低于 ${snap.minSettleGas}，合约会回滚，拍卖状态保持开放。`,
            `data: settle()\n- value wei: 0\n- gas limit: ${settlementGasLimit}\n\nUse the gas limit for this auction. If less than ${snap.minSettleGas} gas remains on entry, settle reverts and the auction stays open.`,
          )
          : phase === "failed"
            ? "data: refund()\n- value wei: 0"
            : "data: claim()\n- value wei: 0";
    const localCommand = operation === "bid" ? `simulate --budget ${budget} --max-price ${maxPrice}` : `${operation}-tx`;
    const text = localFork
      ? t(
        `本地分叉彩排，只读取状态并预览，停止在签名前。\n在项目目录运行：node agent/cli.mjs ${localCommand} --launcher ${launcher} --rpc ${rpc} --json`,
        `Local fork rehearsal. Read and preview only. Stop before signing.\nFrom the project root, run: node agent/cli.mjs ${localCommand} --launcher ${launcher} --rpc ${rpc} --json`,
      )
      : t(
        `在 BNB Smart Chain 测试网操作。EVM chainId 是 97。发送地址必须是 ${sender.trim()}。

先跑 baw wallet chains 确认支持 BSC 测试网 97；如未列出就停止。核对钱包公开地址和 Developer Mode，并检查本笔操作在账户限额内。${operation === "bid" ? "按下面选定的来源校验该钱包的身份。" : ""}

然后只准备这一笔：
- to: ${launcher}
- ${action}
- binanceChainId: 钱包支持列表返回的测试网 id

先 contract-call preview，把模拟结果给我。我确认之后再 execute。不要改金额，不要多发一笔。`,
        `Use BNB Smart Chain Testnet, EVM chain ID 97. The sending address must be ${sender.trim()}.

Run baw wallet chains. Stop if BSC Testnet 97 is absent. Confirm the wallet address, Developer Mode and account limits.${operation === "bid" ? " Verify the wallet identity against the selected source." : ""}

Prepare only this transaction:
- to: ${launcher}
- ${action}
- binanceChainId: the testnet ID returned by the wallet

Run contract-call preview and show me the simulation. Wait for my confirmation before execute. Use the specified amount and send only one transaction.`,
      );
    try {
      await navigator.clipboard.writeText(text);
      setCopyFail("");
      setCopied(true);
    } catch {
      setCopyFail(text);
      setCopied(false);
    }
    if (publicTestnet) {
      const request = { intent: draft, afterBlock: block.toString() };
      setPending({ scope, request });
      try { sessionStorage.setItem(scope, JSON.stringify(request)); } catch { /* In-memory tracking still works. */ }
    }
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), COPY_MS);
  }

  const failed = phase === "failed";
  const marketing = snap?.vaultFactory === ZERO;
  const sceneLabels = SCENES;
  const estimate = quoteLine(snap, budgetWei, priceWei, clearingNow);

  const budgetNote = noteBudget(budget);
  const priceNote = snap ? notePrice(maxPrice, snap.floor) : { error: false, text: "", wei: "" };
  const showIntro = intro && !reduced && !!snap;

  return (
    <div className={["page", showIntro ? "intro" : "", demoOn ? "demo" : ""].filter(Boolean).join(" ")} data-scene={demoOn ? scene + 1 : undefined} data-phase={phase}>
      {snap ? <div className="dock-fade" aria-hidden="true" /> : null}
      <a className="skip" href="#desk">{t("跳到拍卖", "Skip to auction")}</a>
      <header className="top">
        <div className="mast-brand">
          <svg className="brand-symbol" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M2 4h6v15l4 4h6v6h-9l-7-7zm11 0h6v12h5V4h6v16l-3 3h-8l-6-6z" />
          </svg>
          <b>Uniform Launch</b>
          <nav className="mast-links" aria-label={t("工作台导航", "Auction navigation")}>
            <a className="script-link" href={localizedHref("/?demo=1")} aria-current={demoOn ? "page" : undefined}>{t("演示脚本", "Demo")}</a>
            <a className="script-link" href={localizedHref("/?network=testnet")} aria-current={testnetBoard ? "page" : undefined}>{t("发射回执", "Receipts")}</a>
            <a className="language-switch" href={languageHref(demoOn ? scene : undefined)} hrefLang={t("en", "zh")}
              aria-label={t("Switch to English", "切换到中文")} lang={t("en", "zh")}>{t("EN", "中文")}</a>
          </nav>
        </div>
        <span className="top-meta">
          {snap?.rostered && <span className="meta-line">{t("名单场", "Wallet roster required")}</span>}
          {snap?.sources.some((item) => item.standIn) ? <span className="meta-line"><Zh text={t("测试网 Agent ID 为替身", "Testnet Agent ID is a stand-in")} /></span> : null}
          <span className="meta-line network-label">{localFork ? <Zh text={t("本地分叉，不是测试网", "Local fork")} /> : t("BSC 测试网", "BSC Testnet")}</span>
          {block > 0n && <span className="meta-line">{t("区块 ", "Block ")}{groupFull(block)}</span>}
          {rpcNote ? <span className="meta-line"><Zh text={rpcNote} /></span> : rpcError ? <span className="meta-line"><Zh text={t("刚刚没刷新成功，正在重试。", "Refresh failed. Retrying.")} /></span> : null}
        </span>
      </header>
      <p className="status-line"><Zh text={mobileStatus(localFork, snap?.sources.some((item) => item.standIn))} /></p>
      <main className="screen" id="desk">
        {!launcher && !rpcError && !demoOn && params.get("network") === "testnet" && <TestnetBoard />}
        {!launcher && !rpcError && !demoOn && params.get("network") !== "testnet" && <Empty />}
        {demoOn && demoState === "load" && !launcher && <p className="status-line"><Zh text={t("正在读演示场。", "Loading the demo auctions.")} /></p>}
        {demoOn && demoState === "missing" && <DemoMissing />}
        {launcher && !snap && rpcNote && (
          <div className="grid">
            <div>
              <h1>{t("同价发射", "Uniform Launch")}</h1>
              <p><Zh text={rpcNote} /></p>
              <p><a className="back-link" href={localizedHref("/?demo=1")}>{t("打开演示脚本", "Open the demo")}</a></p>
            </div>
          </div>
        )}
        {launcher && !snap && !rpcNote && (rpcError || holdSkel) && (
          <div className="grid">
            <div className="col-form">
              <h1>{t("同价发射", "Uniform Launch")}</h1>
              {language === "zh" && <p className="en">Uniform Launch</p>}
              <p className="user-line"><Zh text={USER_LINE} /></p>
              <form className="ticket" onSubmit={(event) => { event.preventDefault(); void copyInstruction(); }}>
                <label htmlFor="budget">{t("预算", "Budget")}</label>
                <div className="window">
                  <input id="budget" value={budget} inputMode="decimal" autoComplete="off" spellCheck={false} onChange={(e) => setBudget(e.target.value)} />
                  <span className="unit">BNB</span>
                </div>
                <label htmlFor="price">{t("最高价", "Max price")}</label>
                <div className="window">
                  <input id="price" value={maxPrice} inputMode="decimal" autoComplete="off" spellCheck={false} onChange={(e) => setMaxPrice(e.target.value)} />
                  <span className="unit">{t("BNB/枚", "BNB/token")}</span>
                </div>
                <p className="help" role="status">{rpcError ? t("读取失败，正在重试。", "Read failed. Retrying.") : publicTestnet ? t("正在读取测试网拍卖。", "Reading the testnet auction.") : t("正在读取本场拍卖。", "Reading the auction.")}</p>
                <button className="primary" type="button" disabled>{t("等待读取拍卖", "Loading auction")}</button>
                <p className="risk"><Zh text={RISK_LINE} /></p>
              </form>
            </div>
            <div className="col-chart">
              <div className="skel plot" />
            </div>
          </div>
        )}
        {snap && (
          <div className="grid auction">
            <div className="auction-head">
              <div>
                <h1>{t("同价发射", "Uniform Launch")}</h1>
                <p className="user-line">{t("基于代理身份的统一价格拍卖。窗口结束时，所有成交者以同一价格结算。", "One verified identity, one bid. Every winning bid settles at the same price.")}</p>
              </div>
              <ol className="phases" aria-label={t("拍卖阶段", "Auction phases")}>
                {PHASES.map((item) => (
                  <li key={item.id} className={phaseClass(item.id, phase)} aria-current={phaseClass(item.id, phase) === "now" ? "step" : undefined}>
                    {item.label}
                  </li>
                ))}
              </ol>
            </div>
            <div className="col-form">
              <section className="order-panel" aria-label={t("拍卖操作", "Auction actions")}>
                <div className="panel-title">
                  <h2>{failed ? t("退款", "Refund") : phase === "done" ? t("领取", "Claim") : t("出价委托", "Bid ticket")}</h2>
                  <span>{PHASES.find((item) => item.id === phase)?.label}</span>
                </div>
                <div className="metrics">
                  <div><small>{phase === "done" || failed ? t("拍卖窗口", "Bidding window") : t("距截拍", "Time left")}</small>
                    {phase === "done" || failed ? <b>{t("已结束", "Closed")}</b> : <b className="clock"><Roller text={formatRemain(remain)} /></b>}
                  </div>
                  <div className="floor"><small>{t("保留价 BNB/枚", "Reserve · BNB/token")}</small><b>{formatPrice(snap.floor)}</b></div>
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
                    {publicTestnet && button && <label className="sender-field">{t("代理钱包公开地址 ", "Agent wallet address ")}<span className="window"><input type="text" value={sender} pattern="0x[0-9a-fA-F]{40}" required
                        autoComplete="off" spellCheck={false} placeholder="0x…" onChange={event => setSender(event.target.value.trim())} /></span>
                    </label>}
                    {phase === "failed" ? (
                      <div className="result-card">
                        <h2>{t("退款回执", "Refund receipt")}</h2>
                        <div className="result-row"><span>{t("没有成交", "No fills")}</span><b>{snap.bids.length} {t("笔出价", "bids")}</b></div>
                        <div className="result-row"><span>{t("可退总额", "Available to refund")}</span><b>{formatBnb(snap.bids.reduce((sum, bid) => sum + (bid.pulled ? 0n : bid.budget), 0n))} BNB</b></div>
                        <div className="result-row"><span>{t("实际入池", "Pooled")}</span><b>{formatBnb(snap.poolQuote)} BNB</b></div>
                        <p className="help">{t("每位出价者可取回自己的全部预算。", "Each bidder can reclaim their full budget.")}</p>
                      </div>
                    ) : phase === "done" ? (
                      <div className="result-card">
                        <h2>{t("成交回执", "Settlement receipt")}</h2>
                        <div className="result-row"><span>{t("开盘价", "Launch price")}</span><b>{formatPrice(snap.clearing)} {t("BNB/枚", "BNB/token")}</b></div>
                        <div className="result-row"><span>{t("入池 BNB", "Pool funding")}</span><b>{formatBnb(snap.poolQuote)} BNB</b></div>
                        {showToken && snap.token !== ZERO && <Addr label={t("代币", "Token")} value={snap.token} local={!!localFork} />}
                        {showPool && snap.pool !== ZERO && <Addr label={t("池子", "Pool")} value={snap.pool} local={!!localFork} swap={snap.token !== ZERO && !localFork ? pancakeSwapLink(snap.token) : ""} />}
                        {!marketing && vault && vault !== ZERO && <Addr label={t("金库", "Vault")} value={vault} local={!!localFork} />}
                        {!marketing && vaultBal !== null && <div className="result-row"><span>{t("金库余额", "Vault balance")}</span><b>{formatBnb4(vaultBal)} BNB</b></div>}
                      </div>
                    ) : (
                      <>
                    <div className="order-input"><label htmlFor="budget">{t("预算", "Budget")}</label>
                    <div className={`${budgetNote.error && phase === "open" ? "window bad" : "window"}${phase === "open" ? "" : " ro"}`}>
                      <input id="budget" value={budget} readOnly={phase !== "open"} inputMode="decimal" autoComplete="off" spellCheck={false} aria-invalid={phase === "open" && budgetNote.error} aria-describedby="budget-help" onChange={(e) => setBudget(e.target.value)} />
                      <span className="unit">BNB</span>
                    </div>
                    <p id="budget-help" className={phase === "open" && budgetNote.error ? "help bad" : "help"} role={phase === "open" && budgetNote.error ? "alert" : undefined}><Zh text={phase === "open" ? budgetNote.text : " "} /></p>
                    </div>
                    <div className="order-input"><label htmlFor="price">{t("最高价", "Max price")}</label>
                    <div className={`${priceNote.error && phase === "open" ? "window bad" : "window"}${phase === "open" ? "" : " ro"}`}>
                      <input id="price" value={maxPrice} readOnly={phase !== "open"} inputMode="decimal" autoComplete="off" spellCheck={false} placeholder={formatPrice(snap.floor)} aria-invalid={phase === "open" && priceNote.error} aria-describedby="price-help" onChange={(e) => setMaxPrice(e.target.value)} />
                      <span className="unit">{t("BNB/枚", "BNB/token")}</span>
                    </div>
                    <p id="price-help" className={phase === "open" && priceNote.error ? "help bad" : "help"} role={phase === "open" && priceNote.error ? "alert" : undefined}><Zh text={phase === "open" ? priceNote.text : " "} /></p>
                    </div>
                    <label id="source-label">{t("身份来源", "Identity source")}</label>
                    <div
                      className="seg"
                      role="radiogroup"
                      aria-labelledby="source-label"
                      data-on={sourceIndex === 1 ? "1" : "0"}
                      data-lock={phase === "open" ? "0" : "1"}
                      onKeyDown={(event) => {
                        if (phase !== "open") return;
                        if (event.key === "ArrowRight" && snap.sources.length > 1) setSourceIndex(1);
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
                    <label htmlFor="agent">{t("代理编号", "Agent ID")}</label>
                    {snap.sources[sourceIndex] && !snap.sources[sourceIndex].standIn ? (
                      <div className={phase === "open" ? "window" : "window ro"}>
                        <input id="agent" required={publicTestnet && phase === "open"} maxLength={78} value={agentIdInput} readOnly={phase !== "open"} inputMode="numeric" autoComplete="off" spellCheck={false} placeholder={t("链上身份 token ID", "On-chain identity token ID")} onChange={(e) => setAgentIdInput(e.target.value.replace(/[^\d]/g, ""))} />
                      </div>
                    ) : (
                      <p className="id-lock" id="agent">{t("按钱包地址自动识别", "Detected from wallet address")}<i>{t("只读", "Read only")}</i></p>
                    )}
                    <p className="estimate"><Zh text={phase === "open" ? estimate : " "} /></p>
                      </>
                    )}
                  </div>
                  <div className="action">
                    {phase === "open" && snap.bids.length >= snap.maxBids ? (
                      <div className="notice">{t(`本场出价已满 ${snap.maxBids} 笔。`, `All ${snap.maxBids} bid slots are filled.`)}</div>
                    ) : phase === "wait" ? (
                      <div className="notice">{t("开始后可以复制出价指令。", "Bid instructions become available when bidding opens.")}</div>
                    ) : phase === "closed" ? (
                      <div className="notice">{t("已停止接单，等待结算。", "Bidding has closed. Awaiting settlement.")}</div>
                    ) : claimNotice ? (
                      <div className="notice" role="status">{claimNotice}</div>
                    ) : button ? (
                      <button className="primary" type="submit" aria-live="polite" disabled={previewing}>
                        <span>{copied ? t("已复制", "Copied") : button}</span>
                      </button>
                    ) : null}
                    {phase === "open" && snap.bids.length < snap.maxBids && <p className="risk"><Zh text={RISK_LINE} /></p>}
                    {phase === "ready" && <p className="help"><Zh text={t("结算要用的燃料上限已写在指令里，照指令发。", "The settlement instruction includes the required gas limit.")} /></p>}
                  </div>
                </form>
                {copyFail && !claimNotice && (
                  <>
                    <p className="help bad"><i className="mark" />{t("没复制上。长按下面的指令全选复制。", "Copy failed. Select and copy the instruction below.")}</p>
                    <textarea className="paste" readOnly value={copyFail} />
                  </>
                )}
                <ReceiptPanel key={`${scope}:${scene}`} rpc={rpc} local={localFork} draft={draft} tracking={tracking} />
              </section>
            </div>
            <div className="col-main">
            <div className="col-chart">
              {demoOn && scene === 5 ? (
                <PriceComparison data={why} />
              ) : demoOn && scene === 3 && phase === "done" ? (
                <SettlementSummary price={snap.clearing} proceeds={snap.poolQuote} />
              ) : failed ? (
                <FundingProgress raised={raised} eligible={snap.previewOk ? snap.previewQuote : 0n} minimum={snap.minPoolQuote} />
              ) : (
                <>
                  {demoOn && scene === 2 ? (
                    <SimulationSummary simulation={sim} selectedPrice={budgetWei === 10n ** 18n ? priceWei : null}
                      onPreset={(price) => { setBudget("1"); setMaxPrice(price); }} />
                  ) : (
                    <div className="chart-head">
                      <div>
                        <div className="kicker">{phase === "done" ? t("统一开盘价", "Uniform launch price") : t("当前清算价", "Current clearing price")}<span>{t("BNB / 枚", "BNB / token")}</span></div>
                        <div className={clearingNow > 0n ? "chart-price" : "chart-price dim"}>
                          {phase !== "wait" && clearingNow > 0n ? <Roller text={formatPrice(clearingNow)} /> : t("未形成", "Pending")}
                        </div>
                      </div>
                      <div className="market-note">
                        <div><strong>{t("已募 ", "Raised ")}{formatBnb(raised)} BNB</strong><span aria-hidden="true"> · </span>
                          <span title={poolSetsTarget ? t("最低入池额", "Minimum pool funding") : t("按保留价售完所需的最低预算", "Budget needed to sell out at the reserve price")}>{t("门槛 ", "Target ")}{formatBnb(targetRaise)} BNB</span></div>
                        <small><span>{poolSetsTarget ? t("按最低入池额", "Pool minimum") : t("按保留价售完", "Reserve sellout")}{t("，", ", ")}</span><span>{phase === "done" ? t("实际入池", "Pooled") : t("预计入池", "Est. pool")} {formatBnb(phase === "done" ? snap.poolQuote : snap.previewQuote)} BNB</span></small>
                      </div>
                    </div>
                  )}
                  {previewing && <p className="fail-line">{t("画面预览。链上这场处于其他阶段。", "Preview only. The on-chain auction is in a different phase.")}</p>}
                  {clearingNow === 0n && snap.bids.length > 0 && phase !== "wait" && (
                    <p className="fail-line">{t("已提交预算尚不能按保留价售完，清算价未形成。", "Demand at the reserve price is too low to clear the auction.")}</p>
                  )}
                  <div className="plot-wrap">
                    <PlotStage
                      bids={phase === "wait" ? [] : snap.bids}
                      floor={snap.floor}
                      clearing={phase === "wait" || failed ? null : clearingNow > 0n ? clearingNow : null}
                      yourPrice={phase === "open" ? priceWei : null}
                      hideEmpty={phase === "wait"}
                    />
                    {phase === "wait" && <div className="empty note">{t("接单还没开始，开始区块 ", "Bidding opens at block ")}{groupFull(snap.start)}{t("。", ".")}</div>}
                  </div>
                </>
              )}
            </div>
            <div className="col-bids">
              <div className="ledger-heading"><h2>{t("出价簿", "Bid book")}</h2><span>{snap.bids.length} {t(`/ ${snap.maxBids} 笔`, `/ ${snap.maxBids} bids`)}</span></div>
              <ul className="facts">
                <li><span>{t("出售", "For sale")}</span><span>{t("500,000 枚", "500,000 tokens")}</span></li>
                <li><span>{t("入池代币", "Pool tokens")}</span><span>{t("500,000 枚", "500,000 tokens")}</span></li>
                <li><span>{t("买入税 / 卖出税", "Buy / sell tax")}</span><span>3% / 3%</span></li>
                {marketing && <li><span>{t("税款分配", "Tax allocation")}</span><span>{t("100% 付给创建者用于营销", "100% to the creator for marketing")}</span></li>}
              </ul>
              {phase === "done" && marketing && snap.marketingRecipient && snap.marketingRecipient !== ZERO && (
                <Addr label={t("营销收款人", "Marketing recipient")} value={snap.marketingRecipient} local={localFork} />
              )}
              <BidTable rows={snap.bids} phase={phase} clearing={clearingNow} />
            </div>
            </div>
          </div>
        )}
      </main>
      {demoOn && (
        <nav className="demo-bar" aria-label={t("演示导航", "Demo navigation")}>
          <div className="scene-track" role="group" aria-label={t("跳转到演示场景", "Jump to a demo scene")}>
            {sceneLabels.map((text, index) => <button type="button" key={index} aria-label={t(`第 ${index + 1} 幕，${text}`, `Scene ${index + 1}: ${text}`)}
              aria-current={scene === index ? "step" : undefined} className={scene === index ? "on" : ""} disabled={demoState === "missing"}
              onClick={() => setScene(index)}>{String(index + 1).padStart(2, "0")}</button>)}
          </div>
          <p aria-live="polite">{demoState === "missing" ? t("还没有演示场。先跑演示命令。", "Run the demo setup to create the auctions.") : t(`第 ${scene + 1} / ${SCENES.length} 幕 ${sceneLabels[scene]}`, `${scene + 1} / ${SCENES.length}  ${sceneLabels[scene]}`)}</p>
          <div>
            <button type="button" onClick={() => setScene((n) => Math.max(0, n - 1))} disabled={demoState === "missing" || scene === 0}>{t("上一幕", "Back")}</button>
            <button type="button" className="next" onClick={() => setScene((n) => Math.min(SCENES.length - 1, n + 1))} disabled={demoState === "missing" || scene === SCENES.length - 1}>{t("下一幕", "Next")}</button>
          </div>
        </nav>
      )}
    </div>
  );

}

function TestnetBoard() {
  const launch = TESTNET.publicLaunch;
  return (
    <div className="grid testnet-board">
      <section className="public-launch" aria-labelledby="public-launch-title">
        <h1 id="public-launch-title">{t("公开测试网发射", "Public testnet launch")}</h1>
        <p className="public-launch-amount">4.45 <span>tBNB</span></p>
        <p className="public-launch-caption">{t("实际入池，区块 145,040,241", "Added to the pool at block 145,040,241")}</p>
        <p>{t("出价者已领取 500,000 枚。", "The bidder claimed 500,000 tokens.")}</p>
        <a className="public-launch-primary" href={localizedHref(`/?network=testnet&launcher=${launch.launcher}`)}>{t("查看公开拍卖 ", "View public auction ")}<span aria-hidden="true">↗</span></a>
        <div className="public-launch-links">
          <a href={`${TESTNET.explorer}/tx/${launch.createTx}`} target="_blank" rel="noreferrer">{t("BscScan 创建回执 ↗", "Creation receipt ↗")}</a>
          <a href={`${TESTNET.explorer}/tx/${launch.bidTx}`} target="_blank" rel="noreferrer">{t("BscScan 出价回执 ↗", "Bid receipt ↗")}</a>
          <a href={`${TESTNET.explorer}/tx/${launch.settlementTx}`} target="_blank" rel="noreferrer">{t("BscScan 发射回执 ↗", "Launch receipt ↗")}</a>
          <a href={`${TESTNET.explorer}/tx/${launch.claimTx}`} target="_blank" rel="noreferrer">{t("BscScan 领取回执 ↗", "Claim receipt ↗")}</a>
        </div>
      </section>
      <section className="plaque" aria-labelledby="testnet-contract-title">
        <h2 id="testnet-contract-title">{t("测试网合约", "Testnet contracts")}</h2>
        {TESTNET_ROWS.map((row) => (
          <div className="row" key={row.address}>
            <span className="name">{row.name}</span>
            <span className="addr">{row.address.slice(0, 6)}…{row.address.slice(-4)}</span>
            {row.standIn && <span className="tag">{t("替身", "Stand-in")}</span>}
            <button type="button" onClick={() => navigator.clipboard.writeText(row.address)}>{t("复制", "Copy")}</button>
            <a href={`https://testnet.bscscan.com/address/${row.address}`} target="_blank" rel="noreferrer">BscScan</a>
          </div>
        ))}
      </section>
    </div>
  );
}

function DemoMissing() {
  return (
    <div className="grid">
      <div>
        <h1>{t("同价发射", "Uniform Launch")}</h1>
        {language === "zh" && <p className="en">Uniform Launch</p>}
        <p className="user-line"><Zh text={USER_LINE} /></p>
      </div>
      <div className="plot-wrap empty-plot">
        <div className="empty stack">
          <p><Zh text={t("还没有演示场。先跑演示命令，再刷新页面。", "Run the demo setup, then refresh to load the auctions.")} /></p>
          <a className="back-link" href={localizedHref("/?network=testnet")}>{t("查看公开发射回执", "View public launch receipts")}</a>
        </div>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="grid">
      <div>
        <h1>{t("同价发射", "Uniform Launch")}</h1>
        {language === "zh" && <p className="en">Uniform Launch</p>}
        <p className="user-line"><Zh text={USER_LINE} /></p>
      </div>
      <div className="plot-wrap empty-plot">
        <svg className="plot" viewBox="0 0 640 360" preserveAspectRatio="none" aria-hidden="true">
          <line className="baseline" x1="78" y1="332" x2="622" y2="332" />
        </svg>
        <div className="empty">
          <p><Zh text={t("还没有这场拍卖。", "Auction not found.")} /></p>
          <a className="back-link" href={localizedHref("/?demo=1")}>{t("打开演示脚本", "Open the demo")}</a>
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
        <span>{t("代理", "Agent")}</span>
        <span>{t("预算", "Budget")}</span>
        <span>{t("限价", "Limit")}</span>
        <span>{t("状态", "Status")}</span>
      </div>
      {rows.map((row) => {
        const mark = rowMark(row, phase, clearing);
        const label = agentLabel(row.agent);
        const id = row.agent.toLowerCase();
        return (
          <div className={`${fresh.has(id) ? "bid fresh" : "bid"} ${mark.label === t("价内", "In range") || mark.label === t("待领取", "Claimable") ? "in" : mark.label === t("边际", "Marginal") ? "mid" : mark.label === t("价外", "Out of range") ? "out" : ""}`} key={row.agent}>
            <i className={mark.dot} />
            <span className={label.named ? "agent-name" : "agent-addr"} title={row.agent}>
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
  if (localFork && standIn) return t("本地分叉，测试网 Agent ID 为替身", "Local fork · testnet Agent ID stand-in");
  if (localFork) return t("本地分叉，不是测试网", "Local fork");
  return t("BNB Chain 测试网", "BNB Chain Testnet");
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
      ? { label: t("已退回", "Refunded"), dot: "dot off", tone: "tone-mute" }
      : { label: t("待退款", "Refund due"), dot: "dot off", tone: "tone-text" };
  }
  if (phase === "done") {
    if (row.pulled && row.tokensOwed === 0n && row.quoteOwed === 0n) {
      return { label: t("已领取", "Claimed"), dot: "dot in", tone: "tone-active" };
    }
    if (row.tokensOwed > 0n) return { label: t("待领取", "Claimable"), dot: "dot in", tone: "tone-active" };
    return { label: t("未成交", "No fill"), dot: "dot off", tone: "tone-mute" };
  }
  if (clearing === 0n) return { label: t("待定", "Pending"), dot: "dot off", tone: "tone-mute" };
  if (row.maxPrice > clearing) return { label: t("价内", "In range"), dot: "dot in", tone: "tone-active" };
  if (row.maxPrice === clearing) return { label: t("边际", "Marginal"), dot: "dot mid", tone: "tone-text" };
  return { label: t("价外", "Out of range"), dot: "dot off", tone: "tone-mute" };
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
  if (!raw.trim()) return { error: false, text: t("单笔 0.01 到 100 BNB。", "0.01–100 BNB per bid."), wei: "" };
  const value = parseBnb(raw);
  if (value === null) return { error: true, text: t("用十进制数字，例如 1.5。", "Enter a decimal amount, e.g. 1.5."), wei: "" };
  if (value < 10n ** 16n) return { error: true, text: t("单笔至少 0.01 BNB。", "Minimum 0.01 BNB per bid."), wei: "" };
  if (value > 100n * 10n ** 18n) return { error: true, text: t("单笔最多 100 BNB。", "Maximum 100 BNB per bid."), wei: "" };
  return { error: false, text: t("单笔 0.01 到 100 BNB。", "0.01–100 BNB per bid."), wei: groupFull(value) };
}

function notePrice(raw: string, floor: bigint): { error: boolean; text: string; wei: string } {
  if (!raw.trim()) return { error: false, text: t(`不能低于保留价 ${formatPrice(floor)}。`, `Minimum order price: ${formatPrice(floor)}.`), wei: "" };
  const value = parseBnb(raw);
  if (value === null) return { error: true, text: t("用十进制数字，例如 0.00003。", "Enter a decimal price, e.g. 0.00003."), wei: "" };
  if (value > MAX_PRICE) return { error: true, text: t("限价超过合约允许范围。", "Limit exceeds the contract cap."), wei: "" };
  if (value < floor) return { error: true, text: t("低于保留价，这笔不会入场。", "Below reserve. This bid cannot enter."), wei: "" };
  return { error: false, text: t(`不能低于保留价 ${formatPrice(floor)}。`, `Minimum order price: ${formatPrice(floor)}.`), wei: groupFull(value) };
}

function groupFull(value: bigint): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function sameSnap(a: Snap, b: Snap) {
  if (a.maxBids !== b.maxBids || a.rostered !== b.rostered || a.minSettleGas !== b.minSettleGas) return false;
  if (a.status !== b.status || a.floor !== b.floor || a.clearing !== b.clearing || a.softCap !== b.softCap || a.minPoolQuote !== b.minPoolQuote) return false;
  if (a.start !== b.start || a.end !== b.end || a.token !== b.token || a.pool !== b.pool || a.poolQuote !== b.poolQuote) return false;
  if (a.vaultFactory !== b.vaultFactory || a.marketingRecipient !== b.marketingRecipient || a.previewQuote !== b.previewQuote) return false;
  if (a.previewOk !== b.previewOk || a.previewPrice !== b.previewPrice || a.bids.length !== b.bids.length) return false;
  if (a.sources.length !== b.sources.length) return false;
  if (a.sources.some((item, i) => item.sourceId !== b.sources[i].sourceId || item.standIn !== b.sources[i].standIn)) return false;
  return a.bids.every((row, i) => row.agent === b.bids[i].agent && row.budget === b.bids[i].budget && row.maxPrice === b.bids[i].maxPrice && row.pulled === b.bids[i].pulled && row.tokensOwed === b.bids[i].tokensOwed && row.quoteOwed === b.bids[i].quoteOwed && row.sourceId === b.bids[i].sourceId);
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
  if (budgetWei === null || priceWei === null) return t("按 BNB 填写预算和最高价。", "Enter your budget and limit in BNB.");
  if (priceWei > MAX_PRICE) return t("限价超过合约允许范围。", "Limit exceeds the contract cap.");
  if (priceWei < snap.floor) return t("低于保留价，这笔不会入场。", "Below reserve. This bid cannot enter.");
  if (clearing === 0n) return t("清算价未形成。", "No clearing price yet.");
  if (priceWei < clearing) return t("低于当前清算价，按现价不会成交。", "Below the current clearing price. No fill at this price.");
  if (priceWei === clearing) return t("限价等于当前清算价，可能部分成交或不成交。", "At the clearing price. A partial fill or no fill is possible.");
  return t(`按当前清算价可得约 ${formatTokens(tokensFor(budgetWei, clearing))} 枚。`, `At this price, an estimated ${formatTokens(tokensFor(budgetWei, clearing))} tokens.`);
}

function Addr({ label, value, swap, local }: { label: string; value: string; swap?: string; local?: boolean }) {
  return (
    <div className="addr show">
      <span className="addr-label">{label}</span>
      <span className="addr-value">{value.slice(0, 6)}…{value.slice(-4)}</span>
      <button type="button" aria-label={t(`复制${label}地址`, `Copy ${label.toLowerCase()} address`)} onClick={() => navigator.clipboard.writeText(value)}>{t("复制", "Copy")}</button>
      {!local && (
        <a href={`https://testnet.bscscan.com/address/${value}`} target="_blank" rel="noreferrer">
          BscScan
        </a>
      )}
      {swap && (
        <a href={swap} target="_blank" rel="noreferrer">
          PancakeSwap
        </a>
      )}
    </div>
  );
}
