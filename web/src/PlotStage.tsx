import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  buildStepPath,
  easeOut,
  formatBnb,
  formatPrice,
  pathFromPoints,
  resample,
  type Bid,
  type Plot,
  type Pt,
} from "./curve";
import { CURVE_MS, SETTLE_MS } from "./theme";

type Props = {
  bids: Bid[];
  floor: bigint;
  clearing: bigint | null;
  failed: boolean;
  settle: boolean;
  intro: boolean;
  reduced: boolean;
  yourPrice: bigint | null;
};

export function PlotStage({ bids, floor, clearing, failed, settle, intro, reduced, yourPrice }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const apply = () => {
      const w = Math.floor(el.clientWidth);
      const h = Math.floor(el.clientHeight);
      if (w < 40 || h < 40) return;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const vw = Math.max(size.w, 1);
  const vh = Math.max(size.h, 1);
  const target = useMemo(
    () => buildStepPath(bids, vw, vh, floor, clearing, settle && !failed ? 1 : 0, yourPrice),
    [bids, floor, clearing, settle, failed, vw, vh, yourPrice],
  );
  const ghost = useMemo(
    () => buildStepPath(bids, vw, vh, floor, clearing, 0, yourPrice),
    [bids, floor, clearing, vw, vh, yourPrice],
  );
  const [shown, setShown] = useState<Plot>(target);
  const [resting, setResting] = useState(settle && !failed);
  const shownRef = useRef(target);
  const targetRef = useRef(target);
  targetRef.current = target;
  const svgRef = useRef<SVGSVGElement>(null);
  const strokeRef = useRef<SVGPathElement>(null);
  const fillRef = useRef<SVGPathElement>(null);
  const vRef = useRef<SVGLineElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipLines = useRef<Array<HTMLParagraphElement | null>>([]);
  const locked = useRef(false);
  const sawSettle = useRef<boolean | null>(null);
  const [sweep, setSweep] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  useEffect(() => {
    if (sawSettle.current === null) {
      sawSettle.current = settle;
      return;
    }
    if (sawSettle.current || !settle || failed) return;
    sawSettle.current = true;
    setPulse(false);
    const from = shownRef.current;
    const to = targetRef.current;
    if (reduced || from.pts.length === 0) {
      shownRef.current = to;
      setShown(to);
      setSweep(true);
      setResting(true);
      return;
    }
    const t0 = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / SETTLE_MS);
      const next = mixPlot(from, to, easeOut(t));
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
      else {
        setSweep(true);
        setResting(true);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [settle, failed, reduced]);

  useEffect(() => {
    if (settle) return;
    const from = shownRef.current;
    if (from.stroke === target.stroke) return;
    const resized = Math.abs(from.bottom - target.bottom) > 1 || Math.abs(from.right - from.left - (target.right - target.left)) > 1;
    if (reduced || from.pts.length === 0 || intro || resized) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    const t0 = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / CURVE_MS);
      const next = mixPlot(from, target, easeOut(t));
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, settle, reduced, intro]);

  useEffect(() => {
    if (!intro && !settle) setPulse(true);
  }, [intro, settle]);

  function pointOf(event: PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
  }

  function hideTip() {
    locked.current = false;
    if (tipRef.current) tipRef.current.style.opacity = "0";
    if (vRef.current) vRef.current.style.opacity = "0";
  }

  function showTip(x: number) {
    const plot = shownRef.current;
    const tier = plot.tiers.find((item) => x >= item.x1 && x <= item.x2);
    if (!tier || !vRef.current || !tipRef.current) {
      if (!locked.current) hideTip();
      return null;
    }
    const mid = Math.round((tier.x1 + tier.x2) / 2) + 0.5;
    vRef.current.setAttribute("x1", String(mid));
    vRef.current.setAttribute("x2", String(mid));
    vRef.current.setAttribute("y1", String(plot.top));
    vRef.current.setAttribute("y2", String(plot.bottom));
    vRef.current.style.opacity = "1";
    const lines = [`限价 ${formatPrice(tier.price)} BNB/枚`, `${tier.count} 笔`, `${formatBnb(tier.budget)} BNB`];
    lines.forEach((line, i) => {
      if (tipLines.current[i]) tipLines.current[i]!.textContent = line;
    });
    const left = Math.min(Math.max(plot.left, mid + 8), plot.right - 140);
    tipRef.current.style.left = `${left}px`;
    tipRef.current.style.top = `${Math.max(8, tier.y - 72)}px`;
    tipRef.current.style.opacity = "1";
    return tier;
  }

  function onMove(event: PointerEvent<SVGSVGElement>) {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const p = pointOf(event);
    const plot = shownRef.current;
    if (!p || p.x < plot.left || p.x > plot.right || p.y < plot.top || p.y > plot.bottom) {
      hideTip();
      return;
    }
    showTip(p.x);
  }

  function onChartClick(event: PointerEvent<SVGSVGElement>) {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const p = pointOf(event);
    const plot = shownRef.current;
    if (!p || p.x < plot.left || p.x > plot.right) {
      hideTip();
      return;
    }
    if (locked.current) {
      hideTip();
      return;
    }
    const tier = showTip(p.x);
    locked.current = Boolean(tier);
  }

  function onLeave() {
    if (locked.current) return;
    hideTip();
  }

  const plot = resting ? ghost : shown;
  const hair = (n: number) => Math.round(n) + 0.5;
  const priceIn = yourPrice != null && (clearing == null || yourPrice >= clearing);
  return (
    <div className="stage" ref={stageRef}>
      <svg
        ref={svgRef}
        className="plot"
        width={vw}
        height={vh}
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="xMinYMin meet"
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onClick={onChartClick}
        role="img"
        aria-label="限价台阶和清算价"
      >
        <rect className="plot-bg" x="0" y="0" width={vw} height={vh} />
        {plot.ticks.map((tick) => (
          <line key={`g-${tick.y}`} className="grid-line" x1={hair(plot.left)} x2={hair(plot.right)} y1={hair(tick.y)} y2={hair(tick.y)} />
        ))}
        <line className="baseline" x1={hair(plot.left)} x2={hair(plot.right)} y1={hair(plot.bottom)} y2={hair(plot.bottom)} />
        {plot.ticks.map((tick) => (
          <text className="tick y-tick" key={tick.text + tick.y} x={plot.left - 8} y={tick.y + 4} textAnchor="end">
            {tick.text}
          </text>
        ))}
        <text className="tick unit" x={plot.left - 8} y={12} textAnchor="end">
          BNB/枚
        </text>
        {plot.xTicks.map((tick) => (
          <text className="tick x-tick" key={tick.text + tick.x} x={tick.x} y={plot.bottom + 16} textAnchor={tick.x === plot.left ? "start" : "end"}>
            {tick.text}
          </text>
        ))}
        <clipPath id="drawClip">
          <rect className="draw-rect" x="0" y="0" width={vw} height={vh} />
        </clipPath>
        <g clipPath={intro && !reduced && !resting ? "url(#drawClip)" : undefined}>
          {plot.rect && !failed && (
            <rect className={sweep && !reduced ? "uniform-rect play" : "uniform-rect"} x={plot.rect.x} y={plot.rect.y} width={plot.rect.w} height={Math.max(plot.rect.h, 0)} />
          )}
          {failed && plot.stroke && <path className="step failed" d={plot.stroke} />}
          {!failed && plot.inStroke && <path className={settle ? "step-in ghost" : "step-in"} d={plot.inStroke} />}
          {!failed && plot.outStroke && <path className="step-out" d={plot.outStroke} />}
          {!failed && !plot.inStroke && plot.stroke && <path ref={strokeRef} className="step" d={plot.stroke} />}
        </g>
        <line className="reserve" x1={hair(plot.left)} x2={hair(plot.right)} y1={hair(plot.reserveY)} y2={hair(plot.reserveY)} />
        <text className="tick" x={plot.left + 4} y={plot.reserveY + (plot.clearingY != null && Math.abs(plot.clearingY - plot.reserveY) < 18 ? 14 : -6)}>
          保留价 {formatPrice(floor)}
        </text>
        {plot.yourY != null && (
          <>
            <line className={priceIn ? "your-line in" : "your-line"} x1={hair(plot.left)} x2={hair(plot.right)} y1={hair(plot.yourY)} y2={hair(plot.yourY)} />
            <text className="tick" x={plot.left + 4} y={plot.yourY - 6}>
              你的限价 {formatPrice(yourPrice ?? 0n)}
            </text>
          </>
        )}
        {plot.clearingY != null && !failed && (
          <>
            <line className="volume" x1={hair(plot.crossX ?? plot.left)} x2={hair(plot.crossX ?? plot.left)} y1={hair(plot.clearingY)} y2={hair(plot.bottom)} />
            <line className="clear-glow" x1={hair(plot.left)} x2={hair(plot.right)} y1={hair(plot.clearingY)} y2={hair(plot.clearingY)} />
            <line className="clear-line" x1={hair(plot.left)} x2={hair(plot.right)} y1={hair(plot.clearingY)} y2={hair(plot.clearingY)} />
            <text className="badge" x={plot.right - 4} y={plot.clearingY - 8} textAnchor="end">
              清算价 {formatPrice(clearing ?? 0n)}
            </text>
            <text className="tick" x={(plot.crossX ?? plot.left) + 6} y={Math.min(plot.bottom - 8, (plot.clearingY ?? plot.bottom) + 16)}>
              成交 {formatBnb(plot.filled)} BNB
            </text>
            <g className={pulse ? "clear-dot once" : "clear-dot"} transform={`translate(${plot.crossX ?? plot.left} ${plot.clearingY})`}>
              <circle className="dot-ring" r="7" />
              <circle className="dot-core" r="3" />
            </g>
          </>
        )}
        <line ref={vRef} className="cross" style={{ opacity: 0 }} />
      </svg>
      <div ref={tipRef} className="tip" style={{ opacity: 0 }}>
        <p ref={(node) => { tipLines.current[0] = node; }} />
        <p ref={(node) => { tipLines.current[1] = node; }} />
        <p ref={(node) => { tipLines.current[2] = node; }} />
      </div>
      {bids.length === 0 && <div className="empty">还没有出价</div>}
    </div>
  );
}

function mixPlot(from: Plot, to: Plot, t: number): Plot {
  const pts =
    from.pts.length === to.pts.length && from.pts.length > 0
      ? from.pts.map((p, i) => ({ x: p.x + (to.pts[i].x - p.x) * t, y: p.y + (to.pts[i].y - p.y) * t }))
      : (() => {
          const a = resample(from.pts, 48);
          const b = resample(to.pts, 48);
          return a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * t, y: p.y + (b[i].y - p.y) * t }));
        })();
  const painted = pathFromPoints(pts, to.bottom);
  const ly = (a: number | null, b: number | null) => (a == null || b == null ? b : a + (b - a) * t);
  return {
    ...to,
    pts,
    stroke: painted.stroke,
    fill: painted.fill,
    clearingY: ly(from.clearingY, to.clearingY),
    crossX: ly(from.crossX, to.crossX),
    reserveY: from.reserveY + (to.reserveY - from.reserveY) * t,
  };
}

