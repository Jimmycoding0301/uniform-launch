import { CORNER_RATIO } from "./theme";

export type Bid = { budget: bigint; maxPrice: bigint };

export function easeOut(t: number): number {
  const x1 = 0.16;
  const y1 = 1;
  const x2 = 0.3;
  const y2 = 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  let u = t;
  for (let i = 0; i < 6; i++) {
    const x = ((ax * u + bx) * u + cx) * u - t;
    const dx = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(dx) < 1e-6) break;
    u -= x / dx;
  }
  u = Math.min(1, Math.max(0, u));
  return ((ay * u + by) * u + cy) * u;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export type Plot = {
  d: string;
  reserveY: number;
  clearingY: number | null;
  label: string;
  labelY: number;
  ticks: { y: number; text: string }[];
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export function buildStepPath(
  bids: Bid[],
  width: number,
  height: number,
  floor: bigint,
  clearing: bigint | null,
  progress: number,
): Plot {
  const padL = 86;
  const padR = 20;
  const padT = 28;
  const padB = 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const sorted = [...bids].sort((a, b) => (a.maxPrice > b.maxPrice ? -1 : a.maxPrice < b.maxPrice ? 1 : 0));
  const total = sorted.reduce((s, b) => s + b.budget, 0n);
  let hi = floor > 0n ? floor : 1n;
  for (const b of sorted) if (b.maxPrice > hi) hi = b.maxPrice;
  if (clearing && clearing > hi) hi = clearing;
  const lo = floor > 0n ? (floor * 72n) / 100n : 0n;
  const top = (hi * 112n) / 100n;
  const yOf = (p: bigint) => {
    const n = Number(p > top ? top : p < lo ? lo : p);
    const span = Math.max(Number(top - lo), 1);
    return padT + innerH - ((n - Number(lo)) / span) * innerH;
  };
  const xOf = (q: bigint) => padL + (total === 0n ? 0 : (Number(q) / Number(total)) * innerW);
  const tickPrices = [hi, floor];
  if (clearing && clearing > 0n && clearing !== hi && clearing !== floor) tickPrices.splice(1, 0, clearing);
  const ticks: { y: number; text: string }[] = [];
  for (const p of tickPrices) {
    const y = yOf(p);
    if (ticks.some((t) => Math.abs(t.y - y) < 16)) continue;
    ticks.push({ y, text: formatPrice(p) });
  }
  const frame = { left: padL, right: width - padR, top: padT, bottom: padT + innerH, ticks };

  if (sorted.length === 0) {
    const reserveY = floor > 0n ? yOf(floor) : padT + innerH;
    return { d: "", reserveY, clearingY: null, label: "", labelY: reserveY, ...frame };
  }

  const target = clearing && clearing > 0n ? Number(clearing) : null;
  const pts: { x: number; y: number }[] = [];
  let acc = 0n;
  for (const bid of sorted) {
    const y = yOf(priceAt(bid.maxPrice, target, progress));
    const x1 = xOf(acc);
    const x2 = xOf(acc + bid.budget);
    if (pts.length === 0) pts.push({ x: x1, y });
    else pts.push({ x: x1, y });
    pts.push({ x: x2, y });
    acc += bid.budget;
  }
  const clearingY = clearing && clearing > 0n ? yOf(clearing) : null;
  const labelY = clearingY == null ? 0 : clearingY < padT + 56 ? clearingY + 40 : clearingY - 10;
  return {
    d: smoothPolyline(dedupe(pts)),
    reserveY: yOf(floor),
    clearingY,
    label: clearing && clearing > 0n ? formatPrice(clearing) : "",
    labelY,
    ...frame,
  };
}

function dedupe(pts: { x: number; y: number }[]) {
  const out: { x: number; y: number }[] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.x - p.x) < 0.01 && Math.abs(prev.y - p.y) < 0.01) continue;
    out.push(p);
  }
  return out;
}

function priceAt(maxPrice: bigint, clearing: number | null, progress: number): bigint {
  if (clearing == null || progress <= 0) return maxPrice;
  const y = lerp(Number(maxPrice), clearing, progress);
  return BigInt(Math.max(0, Math.round(y)));
}

function smoothPolyline(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  const parts = [`M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];
    const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
    const cut = Math.min(d1, d2) * CORNER_RATIO;
    if (cut < 0.5 || d1 === 0 || d2 === 0) {
      parts.push(`L ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`);
      continue;
    }
    const pin = {
      x: curr.x - ((curr.x - prev.x) / d1) * cut,
      y: curr.y - ((curr.y - prev.y) / d1) * cut,
    };
    const pout = {
      x: curr.x + ((next.x - curr.x) / d2) * cut,
      y: curr.y + ((next.y - curr.y) / d2) * cut,
    };
    parts.push(`L ${pin.x.toFixed(2)} ${pin.y.toFixed(2)}`);
    parts.push(`Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ${pout.x.toFixed(2)} ${pout.y.toFixed(2)}`);
  }
  const last = pts[pts.length - 1];
  parts.push(`L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`);
  return parts.join(" ");
}

export function formatBnb(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export function formatPrice(wei: bigint): string {
  if (wei === 0n) return "0";
  const neg = wei < 0n;
  const v = neg ? -wei : wei;
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  const body = frac ? `${whole}.${frac}` : `${whole}`;
  return neg ? `-${body}` : body;
}
