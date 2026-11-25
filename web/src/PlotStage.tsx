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

const VB_W = 640;

type Props = {
  bids: Bid[];
  floor: bigint;
  clearing: bigint | null;
  failed: boolean;
  settle: boolean;
  intro: boolean;
  reduced: boolean;
  tall: boolean;
};

export function PlotStage({ bids, floor, clearing, failed, settle, intro, reduced, tall }: Props) {
  const vbH = tall ? 280 : 360;
  const target = useMemo(
    () => buildStepPath(bids, VB_W, vbH, floor, clearing, settle && !failed ? 1 : 0),
    [bids, floor, clearing, settle, failed, vbH],
  );
  const ghost = useMemo(
    () => buildStepPath(bids, VB_W, vbH, floor, clearing, 0),
    [bids, floor, clearing, vbH],
  );
  const [shown, setShown] = useState<Plot>(target);
  const [resting, setResting] = useState(settle && !failed);
  const shownRef = useRef(target);
  const targetRef = useRef(target);
  targetRef.current = target;
  const svgRef = useRef<SVGSVGElement>(null);
  const strokeRef = useRef<SVGPathElement>(null);
  const fillRef = useRef<SVGPathElement>(null);
  const crossRef = useRef<SVGGElement>(null);
  const readRef = useRef<SVGTextElement>(null);
  const hRef = useRef<SVGLineElement>(null);
  const vRef = useRef<SVGLineElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dashed = useRef(false);
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
    clearDash(strokeRef.current);
    if (reduced || from.pts.length === 0) {
      shownRef.current = to;
      setShown(to);
      burst(canvasRef.current, svgRef.current, to, reduced);
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
        burst(canvasRef.current, svgRef.current, to, false);
        window.setTimeout(() => setPulse(true), 700);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [settle, failed, reduced]);

  useEffect(() => {
    if (settle) return;
    const from = shownRef.current;
    if (from.stroke === target.stroke) return;
    if (reduced || from.pts.length === 0 || intro) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    clearDash(strokeRef.current);
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

  useLayoutEffect(() => {
    if (dashed.current || reduced || !intro) return;
    const el = strokeRef.current;
    if (!el || !shown.stroke) return;
    const len = el.getTotalLength();
    if (len < 1) return;
    dashed.current = true;
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    requestAnimationFrame(() => {
      el.style.transition = "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1) 200ms";
      el.style.strokeDashoffset = "0";
    });
    el.addEventListener("transitionend", () => {
      el.style.transition = "";
      el.style.strokeDasharray = "none";
      el.style.strokeDashoffset = "0";
    }, { once: true });
  }, [shown.stroke, intro, reduced]);

  useEffect(() => {
    if (!intro && !settle) setPulse(true);
  }, [intro, settle]);

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    const plot = shownRef.current;
    if (!svg || !crossRef.current || !hRef.current || !vRef.current || !readRef.current) return;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    if (p.x < plot.left || p.x > plot.right || p.y < plot.top || p.y > plot.bottom) {
      crossRef.current.style.opacity = "0";
      return;
    }
    crossRef.current.style.opacity = "1";
    hRef.current.setAttribute("x1", String(plot.left));
    hRef.current.setAttribute("x2", String(plot.right));
    hRef.current.setAttribute("y1", String(p.y));
    hRef.current.setAttribute("y2", String(p.y));
    vRef.current.setAttribute("y1", String(plot.top));
    vRef.current.setAttribute("y2", String(plot.bottom));
    vRef.current.setAttribute("x1", String(p.x));
    vRef.current.setAttribute("x2", String(p.x));
    const span = Number(plot.ceil - plot.lo) || 1;
    const price = plot.lo + BigInt(Math.round(((plot.bottom - p.y) / (plot.bottom - plot.top)) * span));
    const quote = plot.total === 0n ? 0n : BigInt(Math.round(((p.x - plot.left) / (plot.right - plot.left)) * Number(plot.total)));
    const tier = plot.tiers.find((item) => p.x >= item.x1 && p.x <= item.x2);
    readRef.current.textContent = tier
      ? `${formatPrice(price)} BNB/枚 · ${tier.count} 笔 · ${formatBnb(tier.budget)} BNB`
      : `${formatPrice(price)} · ${formatBnb(quote)} BNB`;
    const readX = p.x > plot.right - 160 ? p.x - 8 : p.x + 8;
    readRef.current.setAttribute("x", String(readX));
    readRef.current.setAttribute("y", String(Math.max(plot.top + 14, p.y - 8)));
    readRef.current.setAttribute("text-anchor", p.x > plot.right - 160 ? "end" : "start");
  }

  function onLeave() {
    if (crossRef.current) crossRef.current.style.opacity = "0";
  }

  const plot = resting ? ghost : shown;
  return (
    <div className="stage">
      <svg
        ref={svgRef}
        className="plot"
        viewBox={`0 0 ${VB_W} ${vbH}`}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        role="img"
        aria-label="限价台阶和清算价"
      >
        <defs>
          <linearGradient id="fillGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F0B90B" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#F0B90B" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="fillGray" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9A9AA2" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#9A9AA2" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line className="axis" x1={plot.left} y1={plot.top} x2={plot.left} y2={plot.bottom} />
        <line className="axis" x1={plot.left} y1={plot.bottom} x2={plot.right} y2={plot.bottom} />
        {plot.ticks.map((tick) => (
          <text className="tick" key={tick.text + tick.y} x={plot.left - 8} y={tick.y + 4} textAnchor="end">
            {tick.text}
          </text>
        ))}
        {plot.xTicks.map((tick) => (
          <text className="tick" key={tick.text + tick.x} x={tick.x} y={plot.bottom + 16} textAnchor={tick.x === plot.left ? "start" : "end"}>
            {tick.text}
          </text>
        ))}
        <clipPath id="drawClip">
          <rect className="draw-rect" x="0" y="0" width={VB_W} height={vbH} />
        </clipPath>
        <g clipPath={intro && !reduced && !resting ? "url(#drawClip)" : undefined}>
          {resting && ghost.fill && <path className="step-fill ghost" d={ghost.fill} fill="url(#fillGold)" />}
          {resting && ghost.stroke && <path className="step ghost" d={ghost.stroke} />}
          {!resting && plot.fill && <path ref={fillRef} className={failed ? "step-fill failed" : "step-fill"} d={plot.fill} fill={failed ? "url(#fillGray)" : "url(#fillGold)"} />}
          {!resting && plot.stroke && <path ref={strokeRef} className={failed ? "step failed" : "step"} d={plot.stroke} />}
        </g>
        <line className="reserve" x1={plot.left} x2={plot.right} y1={plot.reserveY} y2={plot.reserveY} />
        {plot.clearingY != null && !failed && (
          <>
            <line className="volume" x1={plot.crossX ?? plot.left} x2={plot.crossX ?? plot.left} y1={plot.clearingY} y2={plot.bottom} />
            <text className="tick vol" x={(plot.crossX ?? plot.left) + 8} y={plot.bottom - 8}>
              成交量
            </text>
            <line className="clear-glow" x1={plot.left} x2={plot.right} y1={plot.clearingY} y2={plot.clearingY} />
            <line className="clear-line" x1={plot.left} x2={plot.right} y1={plot.clearingY} y2={plot.clearingY} />
            <g transform={`translate(${plot.crossX ?? plot.left} ${plot.clearingY})`}>
              <circle className={pulse && !intro ? "dot-core idle" : "dot-core"} r="5" />
            </g>
          </>
        )}
        <g ref={crossRef} className="crosshair" style={{ opacity: 0 }}>
          <line ref={hRef} className="cross" />
          <line ref={vRef} className="cross" />
          <text ref={readRef} className="cross-read" />
        </g>
      </svg>
      <canvas ref={canvasRef} className={sweep ? "fx play" : "fx"} />
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

function clearDash(el: SVGPathElement | null) {
  if (!el) return;
  el.style.transition = "";
  el.style.strokeDasharray = "none";
  el.style.strokeDashoffset = "0";
}

function burst(canvas: HTMLCanvasElement | null, svg: SVGSVGElement | null, plot: Plot, reduced: boolean) {
  if (!canvas || !svg || reduced || plot.clearingY == null || plot.crossX == null) return;
  const rect = svg.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const mapX = (x: number) => (x / VB_W) * rect.width;
  const mapY = (y: number) => (y / Number(svg.viewBox.baseVal.height || 360)) * rect.height;
  const goal = { x: mapX(plot.crossX), y: mapY(plot.clearingY) };
  const seeds = plot.pts.length > 0 ? plot.pts : [{ x: plot.left, y: plot.clearingY }];
  const count = Math.min(64, Math.max(24, seeds.length * 6));
  const parts = Array.from({ length: count }, (_, i) => {
    const src = seeds[i % seeds.length];
    const x = mapX(src.x);
    const y = mapY(src.y);
    return {
      x,
      y,
      vx: (goal.x - x) * (0.018 + (i % 5) * 0.004),
      vy: (goal.y - y) * (0.018 + (i % 5) * 0.004),
      r: 1 + (i % 3) * 0.4,
      life: 1,
    };
  });
  const t0 = performance.now();
  const draw = (now: number) => {
    const t = Math.min(1, (now - t0) / 700);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const bandX = mapX(plot.left) + (mapX(plot.right) - mapX(plot.left)) * easeOut(Math.min(1, t / 0.85));
    const grad = ctx.createLinearGradient(bandX - 70, 0, bandX + 18, 0);
    grad.addColorStop(0, "rgba(240,185,11,0)");
    grad.addColorStop(0.7, "rgba(240,185,11,0.45)");
    grad.addColorStop(1, "rgba(240,185,11,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(bandX - 70, goal.y - 5, 88, 10);
    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.life = 1 - t;
      ctx.beginPath();
      ctx.fillStyle = `rgba(240,185,11,${0.85 * p.life})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (t < 1) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, rect.width, rect.height);
  };
  requestAnimationFrame(draw);
}
