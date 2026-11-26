import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { demandChart, formatBnb, formatPrice, type Bid } from "./curve";

type Props = {
  bids: Bid[];
  floor: bigint;
  clearing: bigint | null;
  yourPrice: bigint | null;
  hideEmpty?: boolean;
};

export function PlotStage({ bids, floor, clearing, yourPrice, hideEmpty }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const description = useId();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [active, select] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      setSize((old) => w === old.w && h === old.h ? old : { w, h });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const chart = useMemo(() => demandChart(bids, size.w, size.h, floor, clearing), [bids, size, floor, clearing]);
  const tier = active === null ? null : chart.tiers[active];
  const first = chart.tiers[0];
  const last = chart.tiers.at(-1);
  const complete = size.w > 35 && size.h > 35;
  const point = chart.clear;

  function inspect(event: PointerEvent<SVGSVGElement>) {
    if (!first) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
    if (x < chart.left || x > chart.right || y < chart.top - 6 || y > chart.bottom + 3) {
      select(null);
      return;
    }
    let closest = 0;
    for (let i = 1; i < chart.tiers.length; i++) {
      if (Math.abs(x - chart.tiers[i].x) < Math.abs(x - chart.tiers[closest].x)) closest = i;
    }
    select(closest);
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (!first || !["ArrowLeft", "ArrowRight", "Escape"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") select(null);
    else select((i) => Math.max(0, Math.min(chart.tiers.length - 1, (i ?? -1) + (event.key === "ArrowRight" ? 1 : -1))));
  }

  return (
    <figure className="demand-figure">
      <div className="demand-heading">
        <span>限价 <b>BNB/枚</b></span><span>节点为报价档位，连线表示趋势</span>
      </div>
      <div className="stage demand-viewport" ref={viewport}>
        {complete && (
          <svg className="plot demand-plot" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}
            role="group" aria-label="需求曲线，可用左右键查看报价档" aria-describedby={description} tabIndex={first ? 0 : -1}
            onPointerMove={(e) => { if (e.pointerType !== "touch") inspect(e); }} onPointerDown={inspect}
            onPointerLeave={() => select(null)} onFocus={() => select(0)} onBlur={() => select(null)} onKeyDown={onKeyDown}>
            {chart.yTicks.map((tick) => (
              <g key={tick.value.toString()}>
                <line className="demand-grid" x1={chart.left} x2={chart.right} y1={tick.position} y2={tick.position} />
                <text className="tick y-tick" x={chart.left - 9} y={tick.position + 4} textAnchor="end">{tick.text}</text>
              </g>
            ))}
            {chart.xTicks.map((tick) => (
              <text key={tick.value.toString()} className="tick x-tick" x={tick.position} y={chart.bottom + 16}
                textAnchor={tick.position === chart.left ? "start" : tick.position === chart.right ? "end" : "middle"}>{tick.text}</text>
            ))}
            {first && last && (
              <>
                <line className={first === last ? "demand-curve" : "first-tier"} x1={chart.left} x2={first.x} y1={first.y} y2={first.y} />
                <path className="demand-curve" d={chart.stroke} />
                {chart.tiers.map((t) => (
                  <circle key={t.price.toString()} className={t === tier ? "tier-node active" : "tier-node"} cx={t.x} cy={t.y} r={t === tier ? 4 : 2.6} />
                ))}
              </>
            )}
            {point && (
              <g className="clear-point" data-budget={formatBnb(chart.filled)} data-price={formatPrice(clearing!)}>
                <line className="clear-guide" x1={point.x} x2={point.x} y1={point.y + 6} y2={Math.max(point.y + 6, chart.bottom)} />
                <circle className="clear-ring" cx={point.x} cy={point.y} r={5.5} />
                <circle className="clear-core" cx={point.x} cy={point.y} r={2} />
              </g>
            )}
          </svg>
        )}
        {tier && (
          <div className="tier-detail" role="status" style={{
            left: Math.max(4, Math.min(tier.x - 62, size.w - 152)),
            top: Math.max(0, tier.y > 76 ? tier.y - 72 : Math.min(size.h - 72, tier.y + 12)),
          }}>
            <strong>限价 {formatPrice(tier.price)}</strong>
            <span>本档 {tier.count} 笔，共 {formatBnb(tier.budget)} BNB</span>
            <span>累计 {formatBnb(tier.cumulative)} BNB</span>
          </div>
        )}
        {!first && !hideEmpty && <div className="empty">还没有出价</div>}
      </div>
      <figcaption className="demand-caption" id={description}>
        <span className="clear-key"><i aria-hidden="true" />过线预算 <b>{point ? `${formatBnb(chart.filled)} BNB` : "—"}</b></span>
        <span>保留价 <b>{formatPrice(floor)}</b></span>
        {yourPrice !== null && yourPrice > 0n && <span>你的限价 <b>{formatPrice(yourPrice)}</b></span>}
        <span className="budget-axis">累计预算（BNB）</span>
      </figcaption>
    </figure>
  );
}
