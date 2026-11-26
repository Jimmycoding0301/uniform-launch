import { useEffect, useRef } from "react";
import { formatBnb, formatBnb4, formatPrice, formatTokens, parseBnb } from "./curve";

type Preview = {
  clearingPrice: bigint;
  poolQuote: bigint;
  fills: { tokens: bigint; spend: bigint; refund: bigint }[];
};
export type Comparison = {
  clearing?: string;
  poolQuote?: string;
  sameRaise?: { ratio: number; firstAvg: string; lastAvg: string; gap: string };
};

const DEMO_LIMITS = ["0.00003", "0.000015"] as const;

export function SimulationSummary({ simulation, selectedPrice, onPreset }: {
  simulation: Preview | null;
  selectedPrice: bigint | null;
  onPreset: (price: string) => void;
}) {
  const fill = simulation?.fills.at(-1);
  const result = useRef<HTMLDivElement>(null);
  const resultKey = fill ? `${fill.tokens}:${fill.spend}:${fill.refund}` : "";
  const previous = useRef(resultKey);
  useEffect(() => {
    const changed = previous.current !== resultKey;
    previous.current = resultKey;
    if (!changed || !resultKey || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = result.current?.animate([{ opacity: 0.58 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
    return () => animation?.cancel();
  }, [resultKey]);
  return (
    <section className="simulation" aria-label="本笔模拟">
      <div className="simulation-presets" role="group" aria-label="以 1 BNB 预算试算限价">
        <span>用 1 BNB 试两种限价</span>
        {DEMO_LIMITS.map((limit) => (
          <button type="button" key={limit} aria-label={`限价 ${limit} BNB/枚`}
            aria-pressed={selectedPrice === parseBnb(limit)} onClick={() => onPreset(limit)}>
            {limit} <small>BNB/枚</small>
          </button>
        ))}
      </div>
      <div className="preview-head" aria-live="polite" aria-atomic="true">
        <div>
          <div className="kicker">本笔预计成交</div>
          <div className="preview-fill" ref={result}>
            <div className="chart-price">{fill ? formatTokens(fill.tokens) : "—"} <small>枚</small></div>
            {fill && fill.tokens === 0n && fill.refund > 0n && <span className="preview-outcome">全额退回</span>}
          </div>
        </div>
        {simulation && fill ? (
          <div className="preview-metrics">
            <dl aria-label="本笔资金">
              <div><dt>本笔实付</dt><dd>{formatBnb(fill.spend)} BNB</dd></div>
              <div><dt>本笔退回</dt><dd>{formatBnb(fill.refund)} BNB</dd></div>
            </dl>
            <dl className="preview-market" aria-label="全场模拟">
              <div><dt>全场入池</dt><dd>{formatBnb(simulation.poolQuote)} BNB</dd></div>
              <div><dt>全场清算价</dt><dd>{formatPrice(simulation.clearingPrice)}</dd></div>
            </dl>
          </div>
        ) : <p>还不能算。请检查预算、限价及剩余席位。</p>}
      </div>
    </section>
  );
}

export function SettlementSummary({ price, proceeds, vault }: { price: bigint; proceeds: bigint; vault: bigint | null }) {
  return (
    <section className="settlement" aria-label="发射结算">
      <div className="kicker">统一开盘价 <span>BNB / 枚</span></div>
      <h2 className="chart-price">{formatPrice(price)}</h2>
      <ol className="settlement-flow">
        <li><span>同价成交</span><strong>500,000 <small>枚</small></strong><p>本场出售的代币</p></li>
        <li><span>创建流动池</span><strong>{formatBnb(proceeds)} <small>BNB</small></strong><p>与另 500,000 枚配对</p></li>
        <li><span>金库余额</span><strong>{vault === null ? "—" : formatBnb4(vault)} <small>BNB</small></strong><p>建池后的买卖税收入</p></li>
      </ol>
    </section>
  );
}

const approximateBnb = (wei: bigint) => formatBnb(((wei + 5n * 10n ** 15n) / 10n ** 16n) * 10n ** 16n);

export function FundingProgress({ raised, eligible, minimum }: { raised: bigint; eligible: bigint; minimum: bigint | null }) {
  const validMinimum = minimum !== null && minimum > 0n;
  const shortfall = validMinimum && eligible < minimum ? minimum - eligible : 0n;
  const progress = validMinimum ? Math.min(100, Number((eligible * 10000n) / minimum) / 100) : 0;
  return (
    <section className="funding-result" aria-label="退款原因">
      <div className="kicker">拍卖结果</div>
      <h2>出价全额退回</h2>
      <p>{shortfall > 0n ? `预计入池额距离最低要求还差约 ${approximateBnb(shortfall)} BNB。` : "结算未完成发射，出价者可按原额退款。"}</p>
      {validMinimum && (
        <div className="funding-scale">
          <div className="scale-values">
            <div><small>预计可入池</small><strong>{formatBnb(eligible)} <span>BNB</span></strong></div>
            <div><small>最低入池额</small><strong>≈ {approximateBnb(minimum)} <span>BNB</span></strong></div>
          </div>
          <div className="meter" role="meter" aria-label="入池门槛完成度" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${progress}%` }} />
          </div>
          <div className="scale-axis"><span>0</span><span>{progress.toFixed(1)}% 已达成</span></div>
        </div>
      )}
      <p className="funding-foot">已募 {formatBnb(raised)} BNB。退款按每笔实际提交的预算计算。</p>
    </section>
  );
}

export function PriceComparison({ data }: { data: Comparison | null }) {
  const curve = data?.sameRaise;
  if (!curve || !Number.isFinite(curve.ratio) || curve.ratio <= 0) return <p className="compare-missing">还未读到价格对照数据。</p>;
  const max = Math.max(1, curve.ratio);
  return (
    <section className="comparison" aria-label="价格对照模拟">
      <div className="kicker">同一组出价的模拟对照</div>
      <h2>首尾成交单价比</h2>
      <p>最后一笔成交均价 ÷ 第一笔成交均价。两种机制都按 {data?.poolQuote} BNB 入池额计算。</p>
      <div className="compare-series">
        <div className="compare-row uniform"><span>统一价格</span><strong>1.00<small>×</small></strong>
          <div className="compare-track"><i style={{ width: `${100 / max}%` }} /></div>
        </div>
        <div className="compare-row"><span>常数乘积曲线</span><strong>{curve.ratio}<small>×</small></strong>
          <div className="compare-track"><i style={{ width: `${100 * curve.ratio / max}%` }} /></div>
        </div>
      </div>
      <p className="comparison-detail">曲线首笔 {curve.firstAvg}，末笔 {curve.lastAvg} BNB/枚。</p>
    </section>
  );
}
