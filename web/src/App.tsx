import { useEffect, useMemo, useRef, useState } from "react";
import { createPublicClient, http, type Address } from "viem";
import { buildStepPath, formatBnb, formatPrice } from "./curve";
import {
  ADDR_STAGGER_MS,
  CLEARING_GLOW_BLUR_PX,
  CLEARING_GLOW_OPACITY,
  COLOR_BG,
  RISK_LINE,
  SETTLE_MS,
  USER_LINE,
} from "./theme";

const ABI = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "status", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "floorPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "clearingPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "softCap", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "bidCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "startBlock", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "endBlock", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "token", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "pool", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "preview", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }, { type: "uint256" }, { type: "uint256" }] },
  {
    type: "function",
    name: "getBids",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }, { type: "uint256[]" }, { type: "uint256[]" }],
  },
] as const;

type DemoFile = { localFork?: boolean; rpc?: string; open?: string; settle?: string; failed?: string };
type Snap = {
  name: string;
  status: number;
  floor: bigint;
  clearing: bigint;
  softCap: bigint;
  start: bigint;
  end: bigint;
  token: Address;
  pool: Address;
  previewOk: boolean;
  previewPrice: bigint;
  bids: { agent: Address; budget: bigint; maxPrice: bigint }[];
};

const ZERO = "0x0000000000000000000000000000000000000000";

export function App() {
  const params = new URLSearchParams(location.search);
  const [demo, setDemo] = useState<DemoFile | null>(null);
  const [block, setBlock] = useState(0n);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [rpcError, setRpcError] = useState(false);
  const [budget, setBudget] = useState("1");
  const [maxPrice, setMaxPrice] = useState("");
  const [hashInput, setHashInput] = useState("");
  const [hashNote, setHashNote] = useState("");
  const [progress, setProgress] = useState(0);
  const [showToken, setShowToken] = useState(false);
  const [showPool, setShowPool] = useState(false);
  const initialStatus = useRef<number | null>(null);
  const animStarted = useRef(false);

  const forceEmpty = params.get("empty") === "1";
  const launcher = (forceEmpty ? "" : params.get("launcher") || demo?.open || "") as Address;
  const rpc = demo?.rpc || "http://127.0.0.1:18545";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    fetch("/demo.json").then((r) => (r.ok ? r.json() : null)).then(setDemo).catch(() => setDemo({}));
  }, []);

  useEffect(() => {
    if (!launcher) return;
    const client = createPublicClient({ transport: http(rpc) });
    let stop = false;
    const load = async () => {
      try {
        const b = await client.getBlockNumber();
        const [name, status, floor, clearing, softCap, start, end, token, pool, preview, got] = await Promise.all([
          client.readContract({ address: launcher, abi: ABI, functionName: "name" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "status" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "floorPrice" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "clearingPrice" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "softCap" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "startBlock" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "endBlock" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "token" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "pool" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "preview" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "getBids" }),
        ]);
        if (stop) return;
        const agents = got[0] as Address[];
        const budgets = got[1] as bigint[];
        const prices = got[2] as bigint[];
        setBlock(b);
        setRpcError(false);
        setSnap({
          name: name as string,
          status: Number(status),
          floor: floor as bigint,
          clearing: clearing as bigint,
          softCap: softCap as bigint,
          start: start as bigint,
          end: end as bigint,
          token: token as Address,
          pool: pool as Address,
          previewOk: preview[0] as boolean,
          previewPrice: preview[1] as bigint,
          bids: agents.map((agent, i) => ({ agent, budget: budgets[i], maxPrice: prices[i] })),
        });
      } catch {
        if (!stop) setRpcError(true);
      }
    };
    load();
    const timer = setInterval(load, 3000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [launcher, rpc]);

  useEffect(() => {
    if (!snap) return;
    if (initialStatus.current === null) {
      initialStatus.current = snap.status;
      if (snap.status === 1) {
        setProgress(1);
        setShowToken(true);
        setShowPool(true);
      }
      return;
    }
    if (initialStatus.current === 0 && snap.status === 1 && !animStarted.current) {
      animStarted.current = true;
      if (reduced) {
        setProgress(1);
        setShowToken(true);
        setShowPool(true);
        return;
      }
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / SETTLE_MS);
        setProgress(t);
        if (t < 1) requestAnimationFrame(step);
        else {
          setShowToken(true);
          window.setTimeout(() => setShowPool(true), ADDR_STAGGER_MS);
        }
      };
      requestAnimationFrame(step);
    }
  }, [snap, reduced]);

  const phase = useMemo(() => {
    if (!snap) return "empty";
    if (snap.status === 2) return "failed";
    if (snap.status === 1) return "done";
    if (block < snap.start) return "wait";
    if (block >= snap.end) return "ready";
    if (block >= snap.end - 20n) return "closed";
    return "open";
  }, [snap, block]);

  const clearingNow = snap && snap.status === 1 ? snap.clearing : snap?.previewOk ? snap.previewPrice : 0n;
  const path = useMemo(() => {
    if (!snap) return null;
    return buildStepPath(snap.bids, 700, 420, snap.floor, clearingNow > 0n ? clearingNow : null, snap.status === 1 ? progress : 0);
  }, [snap, clearingNow, progress]);

  const button = phase === "open" ? "复制出价指令" : phase === "ready" ? "复制结算指令" : phase === "failed" ? "复制退款指令" : phase === "done" ? "复制领取指令" : "";

  async function copyInstruction() {
    if (!snap || !launcher) return;
    const budgetWei = BigInt(Math.round(Number(budget) * 1e18));
    const priceWei = maxPrice ? BigInt(maxPrice) : snap.floor;
    const action =
      phase === "open"
        ? `data: bid(uint256) ，maxPrice = ${priceWei}\n- value wei: ${budgetWei}`
        : phase === "ready"
          ? "data: settle()\n- value wei: 0"
          : phase === "failed"
            ? "data: refund()\n- value wei: 0"
            : "data: claim()\n- value wei: 0";
    const text = `在 BNB Smart Chain 测试网操作。EVM chainId 是 97。

先做完这三步，缺一步就停止，不要发交易：
1. 跑 baw wallet chains。确认有 BSC 测试网。没有就停，不要改用 56。
2. 跑 baw wallet agent-id。没有 Agent ID 就停，让我去币安 App 领取。
3. 跑 baw wallet settings。Developer Mode 要开着，余额不能超限。

然后只准备这一笔：
- to: ${launcher}
- ${action}
- binanceChainId: 第 1 步看到的测试网 id

先 contract-call preview，把模拟结果给我。我确认之后再 execute。不要改金额，不要多发一笔。`;
    await navigator.clipboard.writeText(text);
  }

  async function checkHash() {
    if (!hashInput || !launcher) return;
    try {
      const client = createPublicClient({ transport: http(rpc) });
      const tx = await client.getTransaction({ hash: hashInput as `0x${string}` });
      const ok = tx.to?.toLowerCase() === launcher.toLowerCase();
      setHashNote(ok ? "交易已核对。" : "这笔交易对不上当前指令");
    } catch {
      setHashNote("这笔交易对不上当前指令");
    }
  }

  const failed = phase === "failed";
  return (
    <div className="page" style={{ backgroundColor: COLOR_BG }}>
      <header className="top">
        <b>同价</b>
        <span>{demo?.localFork ? "本地分叉，不是测试网" : "BSC 测试网"} · {block.toString()}</span>
      </header>
      <section className="screen">
        {!launcher && !rpcError && (
          <div className="grid">
            <div>
              <h1>同价</h1>
              <p className="user-line">{USER_LINE}</p>
            </div>
            <div className="plot-wrap">
              <svg className="plot" viewBox="0 0 700 420">
                <line className="axis" x1="8" y1="36" x2="8" y2="392" />
                <line className="axis" x1="8" y1="392" x2="684" y2="392" />
              </svg>
              <div className="empty">还没有这场拍卖</div>
            </div>
          </div>
        )}
        {rpcError && <p className="user-line">测试网读取失败</p>}
        {snap && (
          <div className="grid">
            <div>
              <h1>{snap.name || "同价"}</h1>
              <p className="user-line">{USER_LINE}</p>
              <div className="stats">
                <div>保留价<span>{formatPrice(snap.floor)}</span></div>
                <div>软顶<span>{formatBnb(snap.softCap)} BNB</span></div>
                <div>剩余区块<span>{block >= snap.end ? "0" : (snap.end - block).toString()}</span></div>
              </div>
              {phase === "open" && (
                <>
                  <label>预算 BNB<input value={budget} onChange={(e) => setBudget(e.target.value)} /></label>
                  <label>最高价 wei<input value={maxPrice} placeholder={snap.floor.toString()} onChange={(e) => setMaxPrice(e.target.value)} /></label>
                </>
              )}
              {button && (
                <button className="primary" disabled={rpcError} onClick={copyInstruction}>
                  {button}
                </button>
              )}
              {button && <p className="risk">{RISK_LINE}</p>}
              {phase === "wait" && <p className="user-line">窗口还没开</p>}
              {phase === "closed" && <p className="user-line">已停止接单</p>}
              {phase === "ready" && <p className="user-line">等待结算</p>}
            </div>
            <div>
              <div className="plot-wrap">
                <svg className="plot" viewBox="0 0 700 420">
                  {path && (
                    <>
                      <line className="axis" x1={path.left} y1={path.top} x2={path.left} y2={path.bottom} />
                      <line className="axis" x1={path.left} y1={path.bottom} x2={path.right} y2={path.bottom} />
                      {path.ticks.map((t) => (
                        <text className="tick" key={t.text + t.y} x={path.left - 8} y={t.y + 4} textAnchor="end">{t.text}</text>
                      ))}
                      {path.d && <path className={failed ? "step failed" : "step"} d={path.d} />}
                      <line className="reserve" x1={path.left} x2={path.right} y1={path.reserveY} y2={path.reserveY} />
                      {path.clearingY != null && !failed && (
                        <>
                          <line className="clear-glow" x1={path.left} x2={path.right} y1={path.clearingY} y2={path.clearingY} strokeWidth={6} style={{ filter: `blur(${CLEARING_GLOW_BLUR_PX}px)`, opacity: CLEARING_GLOW_OPACITY }} />
                          <line className="clear-line" x1={path.left} x2={path.right} y1={path.clearingY} y2={path.clearingY} />
                          <text className="price-label" x={path.right - 4} y={path.labelY} textAnchor="end">{path.label}</text>
                        </>
                      )}
                    </>
                  )}
                </svg>
                {snap.bids.length === 0 && phase !== "failed" && <div className="empty">还没有出价</div>}
                {failed && <div className="fail-copy">未达保留价，出价全额退回</div>}
              </div>
              <div className="addrs">
                {showToken && snap.token !== ZERO && (
                  <div className="addr show">
                    <span>代币 {short(snap.token)}</span>
                    <button onClick={() => navigator.clipboard.writeText(snap.token)}>复制</button>
                    <a href={`https://testnet.bscscan.com/address/${snap.token}`} target="_blank" rel="noreferrer">浏览器</a>
                  </div>
                )}
                {showPool && snap.pool !== ZERO && (
                  <div className="addr show">
                    <span>池子 {short(snap.pool)}</span>
                    <button onClick={() => navigator.clipboard.writeText(snap.pool)}>复制</button>
                    <a href={`https://testnet.bscscan.com/address/${snap.pool}`} target="_blank" rel="noreferrer">浏览器</a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
      <section className="list">
        <h2>出价</h2>
        {snap?.bids.map((b) => (
          <div className="row" key={b.agent + b.maxPrice.toString()}>
            <span>{short(b.agent)}</span>
            <span>{formatBnb(b.budget)} BNB</span>
            <span>{b.maxPrice.toString()}</span>
          </div>
        ))}
      </section>
      <section className="hash">
        <label>贴交易哈希核对
          <input value={hashInput} onChange={(e) => setHashInput(e.target.value)} onBlur={checkHash} />
        </label>
        {hashNote && <p className="note">{hashNote}</p>}
      </section>
    </div>
  );
}

function short(a: string) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}
