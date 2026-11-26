import { useEffect, useRef } from "react";
import { formatBnb, formatBnb4, formatPrice, formatTokens, parseBnb } from "./curve";
import { t } from "./locale";

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
    <section className="simulation" aria-label={t("本笔模拟", "Bid simulation")}>
      <div className="simulation-presets" role="group" aria-label={t("以 1 BNB 预算试算限价", "Compare limits with a 1 BNB budget")}>
        <span>{t("用 1 BNB 试两种限价", "Try two limits with 1 BNB")}</span>
        {DEMO_LIMITS.map((limit) => (
          <button type="button" key={limit} aria-label={t(`限价 ${limit} BNB/枚`, `Limit ${limit} BNB/token`)}
            aria-pressed={selectedPrice === parseBnb(limit)} onClick={() => onPreset(limit)}>
            {limit} <small>{t("BNB/枚", "BNB/token")}</small>
          </button>
        ))}
      </div>
      <div className="preview-head" aria-live="polite" aria-atomic="true">
        <div>
          <div className="kicker">{t("本笔预计成交", "Estimated fill")}</div>
          <div className="preview-fill" ref={result}>
            <div className="chart-price">{fill ? formatTokens(fill.tokens) : "—"} <small>{t("枚", "tokens")}</small></div>
            {fill && fill.tokens === 0n && fill.refund > 0n && <span className="preview-outcome">{t("全额退回", "Full refund")}</span>}
          </div>
        </div>
        {simulation && fill ? (
          <div className="preview-metrics">
            <dl aria-label={t("本笔资金", "Your budget")}>
              <div><dt>{t("本笔实付", "You pay")}</dt><dd>{formatBnb(fill.spend)} BNB</dd></div>
              <div><dt>{t("本笔退回", "You get back")}</dt><dd>{formatBnb(fill.refund)} BNB</dd></div>
            </dl>
            <dl className="preview-market" aria-label={t("全场模拟", "Auction simulation")}>
              <div><dt>{t("全场入池", "Pool funding")}</dt><dd>{formatBnb(simulation.poolQuote)} BNB</dd></div>
              <div><dt>{t("全场清算价", "Clearing price")}</dt><dd>{formatPrice(simulation.clearingPrice)}</dd></div>
            </dl>
          </div>
        ) : <p>{t("还不能算。请检查预算、限价及剩余席位。", "Check the budget, limit and available bid slots.")}</p>}
      </div>
    </section>
  );
}

export function SettlementSummary({ price, proceeds, vault }: { price: bigint; proceeds: bigint; vault: bigint | null }) {
  return (
    <section className="settlement" aria-label={t("发射结算", "Launch settlement")}>
      <div className="kicker">{t("统一开盘价 ", "Uniform launch price")}<span>{t("BNB / 枚", "BNB / token")}</span></div>
      <h2 className="chart-price">{formatPrice(price)}</h2>
      <ol className="settlement-flow">
        <li><span>{t("同价成交", "Sold at one price")}</span><strong>500,000 <small>{t("枚", "tokens")}</small></strong><p>{t("本场出售的代币", "Tokens sold in this auction")}</p></li>
        <li><span>{t("创建流动池", "Initial pool liquidity")}</span><strong>{formatBnb(proceeds)} <small>BNB</small></strong><p>{t("与另 500,000 枚配对", "Paired with 500,000 more tokens")}</p></li>
        <li><span>{t("金库余额", "Vault balance")}</span><strong>{vault === null ? "—" : formatBnb4(vault)} <small>BNB</small></strong><p>{t("建池后的买卖税收入", "Trading tax collected after launch")}</p></li>
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
    <section className="funding-result" aria-label={t("退款原因", "Refund details")}>
      <div className="kicker">{t("拍卖结果", "Auction outcome")}</div>
      <h2>{t("出价全额退回", "Full refunds")}</h2>
      <p>{shortfall > 0n
        ? t(`预计入池额距离最低要求还差约 ${approximateBnb(shortfall)} BNB。`, `Eligible funding fell about ${approximateBnb(shortfall)} BNB short of the pool minimum.`)
        : t("结算未完成发射，出价者可按原额退款。", "The auction failed to launch. Bidders can claim their full budgets.")}</p>
      {validMinimum && (
        <div className="funding-scale">
          <div className="scale-values">
            <div><small>{t("预计可入池", "Eligible pool funding")}</small><strong>{formatBnb(eligible)} <span>BNB</span></strong></div>
            <div><small>{t("最低入池额", "Pool minimum")}</small><strong>≈ {approximateBnb(minimum)} <span>BNB</span></strong></div>
          </div>
          <div className="meter" role="meter" aria-label={t("入池门槛完成度", "Progress to pool minimum")} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${progress}%` }} />
          </div>
          <div className="scale-axis"><span>0</span><span>{t(`${progress.toFixed(1)}% 已达成`, `${progress.toFixed(1)}% funded`)}</span></div>
        </div>
      )}
      <p className="funding-foot">{t(`已募 ${formatBnb(raised)} BNB。退款按每笔实际提交的预算计算。`, `${formatBnb(raised)} BNB bid. Each bidder can reclaim their full deposit.`)}</p>
    </section>
  );
}

export function PriceComparison({ data }: { data: Comparison | null }) {
  const curve = data?.sameRaise;
  if (!curve || !Number.isFinite(curve.ratio) || curve.ratio <= 0) return <p className="compare-missing">{t("还未读到价格对照数据。", "Price comparison unavailable.")}</p>;
  const max = Math.max(1, curve.ratio);
  return (
    <section className="comparison" aria-label={t("价格对照模拟", "Simulated price comparison")}>
      <div className="kicker">{t("同一组出价的模拟对照", "Same bids, simulated outcomes")}</div>
      <h2>{t("首尾成交单价比", "Last-to-first price ratio")}</h2>
      <p>{t(`最后一笔成交均价 ÷ 第一笔成交均价。两种机制都按 ${data?.poolQuote} BNB 入池额计算。`, `Average price of the last fill divided by the first. Both simulations fund the pool with ${data?.poolQuote} BNB.`)}</p>
      <div className="compare-series">
        <div className="compare-row uniform"><span>{t("统一价格", "Uniform price")}</span><strong>1.00<small>×</small></strong>
          <div className="compare-track"><i style={{ width: `${100 / max}%` }} /></div>
        </div>
        <div className="compare-row"><span>{t("常数乘积曲线", "Constant-product curve")}</span><strong>{curve.ratio}<small>×</small></strong>
          <div className="compare-track"><i style={{ width: `${100 * curve.ratio / max}%` }} /></div>
        </div>
      </div>
      <p className="comparison-detail">{t(`曲线首笔 ${curve.firstAvg}，末笔 ${curve.lastAvg} BNB/枚。`, `Curve prices were ${curve.firstAvg} for the first fill and ${curve.lastAvg} BNB/token for the last.`)}</p>
    </section>
  );
}
