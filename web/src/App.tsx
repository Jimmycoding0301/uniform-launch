import { useEffect, useMemo, useRef, useState } from "react";
import { createPublicClient, http, type Address } from "viem";
import { formatBnb, formatPrice, formatRemain, formatTokens, parseBnb, tokensFor } from "./curve";
import { agentLabel } from "./names";
import { Roller, useReducedMotion, Zh } from "./motion";
import { PlotStage } from "./PlotStage";
import { ScriptPage } from "./ScriptPage";
import { ADDR_STAGGER_MS, COLOR_BG, MIN_SETTLE_GAS, RISK_LINE, SETTLE_GAS_LIMIT, SETTLE_MS, SWEEP_MS, USER_LINE } from "./theme";

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
  { type: "function", name: "preview", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }, { type: "uint256" }, { type: "uint256" }] },
  {
    type: "function",
    name: "getBids",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }, { type: "uint256[]" }, { type: "uint256[]" }],
  },
  {
    type: "function",
    name: "getFills",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256[]" }, { type: "uint256[]" }, { type: "bool[]" }],
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
};
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
  previewOk: boolean;
  previewPrice: bigint;
  bids: Row[];
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
  const [hashInput, setHashInput] = useState("");
  const [hashNote, setHashNote] = useState("");
  const [hashOpen, setHashOpen] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showPool, setShowPool] = useState(false);
  const [copied, setCopied] = useState(false);
  const [intro, setIntro] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [narrow, setNarrow] = useState(window.matchMedia("(max-width: 900px)").matches);
  const initialStatus = useRef<number | null>(null);
  const animStarted = useRef(false);
  const copyTimer = useRef(0);
  const reduced = useReducedMotion();

  const forceEmpty = params.get("empty") === "1";
  const launcher = (forceEmpty ? "" : params.get("launcher") || demo?.open || "") as Address;
  const rpc = demo?.rpc || "http://127.0.0.1:18545";
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const onChange = () => setNarrow(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

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
      try {
        const b = await client.getBlockNumber();
        const [status, floor, clearing, softCap, start, end, token, pool, poolQuote, preview, got, fills] = await Promise.all([
          client.readContract({ address: launcher, abi: ABI, functionName: "status" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "floorPrice" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "clearingPrice" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "softCap" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "startBlock" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "endBlock" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "token" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "pool" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "poolQuote" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "preview" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "getBids" }),
          client.readContract({ address: launcher, abi: ABI, functionName: "getFills" }),
        ]);
        if (stop) return;
        const agents = got[0] as Address[];
        const budgets = got[1] as bigint[];
        const prices = got[2] as bigint[];
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
          previewOk: preview[0] as boolean,
          previewPrice: preview[1] as bigint,
          bids: agents.map((agent, i) => ({
            agent,
            budget: budgets[i],
            maxPrice: prices[i],
            tokensOwed: owed[i] ?? 0n,
            quoteOwed: quotes[i] ?? 0n,
            pulled: Boolean(pulled[i]),
          })),
        };
        setBlock((prev) => (prev === b ? prev : (b as bigint)));
        setRpcError(false);
        setSnap((prev) => (prev && sameSnap(prev, next) ? prev : next));
      } catch {
        if (!stop) setRpcError(true);
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
  useEffect(() => {
    if (!snap || reduced || introOnce.current) return;
    introOnce.current = true;
    window.setTimeout(() => setIntro(false), 1600);
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

  async function copyInstruction() {
    if (!snap || !launcher) return;
    const action =
      phase === "open"
        ? `data: bid(uint256)\n- maxPrice wei: ${priceWei}\n- 最高价：${priceWei ? formatPrice(priceWei) : ""} BNB/枚\n- value wei: ${budgetWei}\n- 预算：${budget} BNB`
        : phase === "ready"
          ? `data: settle()\n- value wei: 0\n- gas limit: ${SETTLE_GAS_LIMIT}\n\ngas limit 固定为 ${SETTLE_GAS_LIMIT}，不要用节点估算值。估算往往只有一两百万。进入 settle 时如果剩余 gas 低于 ${MIN_SETTLE_GAS}，合约直接回滚，这场拍卖保持开放，不会被记成失败。${SETTLE_GAS_LIMIT} 扣掉基础 gas 后仍高于这条线，也够一次发射。`
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
    setCopied(true);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1200);
  }

  async function checkHash() {
    if (!hashInput || !launcher) return;
    try {
      const client = createPublicClient({ transport: http(rpc) });
      const tx = await client.getTransaction({ hash: hashInput as `0x${string}` });
      const ok = tx.to?.toLowerCase() === launcher.toLowerCase();
      setHashNote(ok ? "交易已核对。" : "这笔交易对不上当前指令。");
    } catch {
      setHashNote("这笔交易对不上当前指令。");
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
      <div className="page scroll" style={{ backgroundColor: COLOR_BG }}>
        <a className="skip" href="#script">跳到脚本</a>
        <header className="top">
          <b>
            同价发射
            <a className="script-link" href={demo?.open ? `/?launcher=${demo.open}` : "/"}>返回拍卖</a>
          </b>
          <span>{demo?.localFork ? <Zh text="本地分叉，不是测试网" /> : "BSC 测试网"}</span>
        </header>
        <section className="screen" id="script">
          <ScriptPage demo={demo} />
        </section>
      </div>
    );
  }

  return (
    <div className={showIntro ? "page intro" : "page"} style={{ backgroundColor: COLOR_BG }}>
      <a className="skip" href="#desk">跳到拍卖</a>
      <header className="top">
        <b>
          同价发射
          <a className="script-link" href="/?view=script">演示脚本</a>
        </b>
        <span>
          {demo?.localFork ? <Zh text="本地分叉，不是测试网" /> : "BSC 测试网"} · {block.toString()}
          {rpcError && snap ? <Zh text=" · 刚刚没刷新成功。" /> : ""}
        </span>
      </header>
      <section className="screen" id="desk">
        {!launcher && !rpcError && <Empty />}
        {launcher && !snap && !rpcError && <Skeleton />}
        {rpcError && !snap && <p className="user-line">测试网读取失败。</p>}
        {snap && (
          <div className="grid">
            <div className="brand-mobile">
              <h1 className="brand-title">同价发射</h1>
              <p className="user-line"><Zh text={USER_LINE} /></p>
            </div>
            <div className="col-form">
              <div>
                <div className="brand-desk">
                <h1>
                  {"同价发射".split("").map((ch, i) => (
                    <span className="char" key={ch} style={{ animationDelay: `${60 + i * 70}ms` }}>{ch}</span>
                  ))}
                </h1>
                <p className="en char" style={{ animationDelay: "340ms" }}>Uniform Launch</p>
                <p className="user-line char" style={{ animationDelay: "410ms" }}><Zh text={USER_LINE} /></p>
                </div>
                <ol className="phases">
                  {PHASES.map((item) => (
                    <li key={item.id} className={phaseClass(item.id, phase)}>
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
                  <small>剩余 · {remain.toString()} 块 · 0.75 秒/块</small>
                </div>
                  <div className="floor">
                    <b>{formatPrice(snap.floor)}</b>
                    <small>保留价 BNB/枚</small>
                  </div>
                </div>
                {phase === "open" && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (bidReady) void copyInstruction();
                    }}
                  >
                    <label htmlFor="budget">预算 BNB</label>
                    <input id="budget" value={budget} inputMode="decimal" autoComplete="off" spellCheck={false} aria-invalid={budgetNote.error} aria-describedby="budget-help" onChange={(e) => setBudget(e.target.value)} />
                    <p id="budget-help" className={budgetNote.error ? "field-error" : "field-help"} role={budgetNote.error ? "alert" : undefined} title={budgetNote.wei ? `${budgetNote.wei} wei` : undefined}><Zh text={budgetNote.text} /></p>
                    <label htmlFor="price">最高价 BNB/枚</label>
                    <input id="price" value={maxPrice} inputMode="decimal" autoComplete="off" spellCheck={false} placeholder={formatPrice(snap.floor)} aria-invalid={priceNote.error} aria-describedby="price-help" onChange={(e) => setMaxPrice(e.target.value)} />
                    <p id="price-help" className={priceNote.error ? "field-error" : "field-help"} role={priceNote.error ? "alert" : undefined} title={priceNote.wei ? `${priceNote.wei} wei` : undefined}><Zh text={priceNote.text} /></p>
                    <p className="estimate"><Zh text={estimate} /></p>
                    {button && (
                      <button className="primary" type="submit" disabled={rpcError || !bidReady} aria-live="polite">
                        <span className="btn-stack">
                          <span className={copied ? "off" : "on"}>{button}</span>
                          <span className={copied ? "on" : "off"}>已复制 ✓</span>
                        </span>
                      </button>
                    )}
                  </form>
                )}
                {phase === "wait" && <p className="user-line tight"><Zh text="窗口还没开。" /></p>}
                {phase === "closed" && <p className="user-line tight"><Zh text="已停止接单。" /></p>}
                {phase === "ready" && <p className="user-line tight"><Zh text="等待结算。gas limit 用 8000000，不要用估算值。" /></p>}
                {button && phase !== "open" && (
                  <button className="primary" type="button" disabled={rpcError} onClick={() => void copyInstruction()} aria-live="polite">
                    <span className="btn-stack">
                      <span className={copied ? "off" : "on"}>{button}</span>
                      <span className={copied ? "on" : "off"}>已复制 ✓</span>
                    </span>
                  </button>
                )}
                {phase === "open" && <p className="risk"><Zh text={RISK_LINE} /></p>}
                <button type="button" className="hash-toggle" aria-expanded={hashOpen} onClick={() => setHashOpen((open) => !open)}>
                  <Zh text="已发送？贴哈希核对（可选）" />
                </button>
                {hashOpen && (
                  <div className="hash">
                    <label htmlFor="txhash">交易哈希</label>
                    <input id="txhash" value={hashInput} spellCheck={false} autoComplete="off" onChange={(e) => setHashInput(e.target.value)} onBlur={checkHash} />
                    {hashNote && <p className="note" role="status">{hashNote}</p>}
                  </div>
                )}
                {phase === "done" && (
                  <div className="result-card">
                    <div className="result-row"><span>开盘价</span><b>{formatPrice(snap.clearing)} BNB/枚</b></div>
                    <div className="result-row"><span>入池 BNB</span><b>{formatBnb(snap.poolQuote)} BNB</b></div>
                    {showToken && snap.token !== ZERO && <Addr label="代币" value={snap.token} />}
                    {showPool && snap.pool !== ZERO && <Addr label="池子" value={snap.pool} />}
                  </div>
                )}
                <h2 className="group-title">本场参数</h2>
                <ul className="facts">
                  <li><span>出售</span><span>500,000 枚</span></li>
                  <li><span>入池代币</span><span>500,000 枚</span></li>
                  <li><span>买入税 / 卖出税</span><span>3% / 3%</span></li>
                  <li><span>本场出价</span><span>{snap.bids.length} / 32</span></li>
                </ul>
              </div>
            </div>
            <div className="col-chart">
              <div className="chart-head">
                <div>
                  <div className="kicker">{failed ? "结果" : phase === "done" ? "开盘价 BNB/枚" : "当前清算价 BNB/枚"}</div>
                  <div className={clearingNow > 0n && !failed ? "chart-price" : "chart-price dim"}>
                    {failed ? "没有成交" : clearingNow > 0n ? <Roller text={formatPrice(clearingNow)} /> : "未形成"}
                  </div>
                  {failed && <p className="fail-line"><Zh text="未达保留价，出价全额退回。" /></p>}
                </div>
                <div className="axis-note">纵轴 BNB/枚 · 横轴累计 BNB</div>
              </div>
              <div className="plot-wrap">
                <PlotStage
                  bids={snap.bids}
                  floor={snap.floor}
                  clearing={clearingNow > 0n ? clearingNow : null}
                  failed={failed}
                  settle={snap.status === 1}
                  intro={showIntro}
                  reduced={reduced}
                  tall={narrow}
                />
              </div>
            </div>
            <div className="col-bids">
              <BidTable rows={snap.bids} phase={phase} clearing={clearingNow} />
            </div>
          </div>
        )}
      </section>
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
        <div className="empty"><Zh text="还没有这场拍卖。" /></div>
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
          <div className={fresh.has(id) ? "bid fresh" : "bid"} key={row.agent}>
            <i className={mark.dot} />
            <span className={label.named ? "agent-name" : "agent-addr"}>{label.text}</span>
            <span>{formatBnb(row.budget)} BNB</span>
            <span>{formatPrice(row.maxPrice)}</span>
            <span className={mark.tone}>{mark.label}</span>
          </div>
        );
      })}
    </div>
  );
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
  if (a.previewOk !== b.previewOk || a.previewPrice !== b.previewPrice || a.bids.length !== b.bids.length) return false;
  return a.bids.every((row, i) => row.agent === b.bids[i].agent && row.budget === b.bids[i].budget && row.maxPrice === b.bids[i].maxPrice && row.pulled === b.bids[i].pulled && row.tokensOwed === b.bids[i].tokensOwed);
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

function Addr({ label, value }: { label: string; value: string }) {
  return (
    <div className="addr show">
      <span className="addr-label">{label}</span>
      <span className="addr-value">{value.slice(0, 6)}…{value.slice(-4)}</span>
      <button type="button" aria-label={`复制${label}地址`} onClick={() => navigator.clipboard.writeText(value)}>复制</button>
      <a href={`https://testnet.bscscan.com/address/${value}`} target="_blank" rel="noreferrer">
        浏览器
      </a>
    </div>
  );
}
