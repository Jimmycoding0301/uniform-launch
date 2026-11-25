export type Bid = { budget: bigint; maxPrice: bigint };

export type Tier = {
  price: bigint;
  budget: bigint;
  count: number;
  x1: number;
  x2: number;
  y: number;
};

export type Pt = { x: number; y: number };

export type Plot = {
  stroke: string;
  fill: string;
  pts: Pt[];
  reserveY: number;
  clearingY: number | null;
  crossX: number | null;
  ticks: { y: number; text: string }[];
  xTicks: { x: number; text: string }[];
  tiers: Tier[];
  left: number;
  right: number;
  top: number;
  bottom: number;
  lo: bigint;
  ceil: bigint;
  total: bigint;
};

export function parseBnb(input: string): bigint | null {
  const s = input.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  if (frac.length > 18) return null;
  if (whole.length > 8) return null;
  const padded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(padded);
}

export function formatBnb(wei: bigint): string {
  const neg = wei < 0n;
  const v = neg ? -wei : wei;
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  const body = frac ? `${whole}.${frac}` : `${whole}`;
  return neg ? `-${body}` : body;
}

const PRICE_SIG = 3;

export function formatPrice(wei: bigint): string {
  if (wei === 0n) return "0";
  const neg = wei < 0n;
  const body = formatSig(neg ? -wei : wei, PRICE_SIG);
  return neg ? `-${body}` : body;
}

function formatSig(wei: bigint, sig: number): string {
  const digits = wei.toString();
  const drop = digits.length - sig;
  let mant: bigint;
  let exp: number;
  if (drop > 0) {
    const base = 10n ** BigInt(drop);
    const q = wei / base;
    const r = wei % base;
    mant = q + (r >= base / 2n ? 1n : 0n);
    exp = drop - 18;
    if (mant.toString().length > sig) {
      mant /= 10n;
      exp += 1;
    }
  } else {
    mant = wei;
    exp = -18;
  }
  let m = mant.toString();
  const trimmed = m.replace(/0+$/, "");
  exp += m.length - trimmed.length;
  m = trimmed || "0";
  if (exp >= 0) return m + "0".repeat(exp);
  const places = -exp;
  if (places >= m.length) return `0.${"0".repeat(places - m.length)}${m}`;
  return `${m.slice(0, m.length - places)}.${m.slice(m.length - places)}`;
}

export function formatTokens(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 纵轴用 gwei 的科学计数，避免一长串小数。 */
export function formatGwei(wei: bigint): string {
  if (wei === 0n) return "0";
  const gwei = Number(wei < 0n ? -wei : wei) / 1e9;
  if (!Number.isFinite(gwei) || gwei === 0) return "0";
  const exp = Math.floor(Math.log10(gwei));
  const mant = gwei / 10 ** exp;
  const digits = mant >= 9.95 ? (1).toFixed(1) : mant.toFixed(1);
  const shownExp = mant >= 9.95 ? exp + 1 : exp;
  if (shownExp === 0) return digits;
  return `${digits}e${shownExp}`;
}

export function tokensFor(budgetWei: bigint, priceWei: bigint): bigint {
  if (priceWei <= 0n || budgetWei <= 0n) return 0n;
  return (budgetWei * 10n ** 18n) / priceWei;
}

export function buildStepPath(
  bids: Bid[],
  width: number,
  height: number,
  floor: bigint,
  clearing: bigint | null,
  progress: number,
): Plot {
  const padT = 14;
  const padB = 28;
  const padR = 16;
  const sorted = [...bids].sort((a, b) => (a.maxPrice > b.maxPrice ? -1 : a.maxPrice < b.maxPrice ? 1 : 0));
  const total = sorted.reduce((s, b) => s + b.budget, 0n);

  const grouped: { price: bigint; budget: bigint; count: number }[] = [];
  for (const bid of sorted) {
    const last = grouped[grouped.length - 1];
    if (last && last.price === bid.maxPrice) {
      last.budget += bid.budget;
      last.count += 1;
    } else {
      grouped.push({ price: bid.maxPrice, budget: bid.budget, count: 1 });
    }
  }

  let hi = floor > 0n ? floor : 1n;
  let loPrice = hi;
  for (const g of grouped) {
    if (g.price > hi) hi = g.price;
    if (g.price > 0n && g.price < loPrice) loPrice = g.price;
  }
  if (clearing && clearing > hi) hi = clearing;
  if (clearing && clearing > 0n && clearing < loPrice) loPrice = clearing;
  if (floor > 0n && floor < loPrice) loPrice = floor;
  const priceLabels = [hi, floor, clearing ?? 0n].filter((p) => p > 0n).map((p) => formatPrice(p));
  const labelW = priceLabels.reduce((w, text) => Math.max(w, Math.ceil(text.length * 7.25)), 28);
  let padL = 16 + labelW + 10;
  if (padL + padR > width - 80) padL = Math.max(48, width - padR - 80);
  const innerW = Math.max(40, width - padL - padR);
  const innerH = height - padT - padB;
  let span = hi > loPrice ? hi - loPrice : hi > 0n ? hi / 5n : 1n;
  if (span === 0n) span = 1n;
  const below = span / 4n === 0n ? 1n : span / 4n;
  const above = span / 8n === 0n ? 1n : span / 8n;
  const lo = loPrice - below;
  const ceil = hi + above;
  const yOf = (p: bigint) => {
    const scale = Math.max(Number(ceil - lo), 1);
    const t = (Number(p) - Number(lo)) / scale;
    return padT + innerH - Math.min(1, Math.max(0, t)) * innerH;
  };
  const xOf = (q: bigint) => padL + (total === 0n ? 0 : (Number(q) / Number(total)) * innerW);

  const tickPrices = [hi, floor];
  if (clearing && clearing > 0n) tickPrices.splice(1, 0, clearing);
  const ticks: { y: number; text: string }[] = [];
  for (const p of tickPrices) {
    if (p <= 0n) continue;
    const y = yOf(p);
    if (ticks.some((t) => Math.abs(t.y - y) < 22)) continue;
    ticks.push({ y, text: formatPrice(p) });
  }

  const bottom = padT + innerH;
  const left = padL;
  const right = width - padR;
  const xTicks = [
    { x: left, text: "0" },
    { x: right, text: total === 0n ? "0 BNB" : `${formatBnb(total)} BNB` },
  ];
  const frame = { ticks, xTicks, left, right, top: padT, bottom, lo, ceil, total };

  if (grouped.length === 0) {
    const reserveY = floor > 0n ? yOf(floor) : bottom;
    return { stroke: "", fill: "", pts: [], reserveY, clearingY: null, crossX: null, tiers: [], ...frame };
  }

  const target = clearing && clearing > 0n ? Number(clearing) : null;
  const pts: { x: number; y: number }[] = [];
  const tiers: Tier[] = [];
  let acc = 0n;
  let filled = 0n;
  for (const g of grouped) {
    const y = yOf(priceAt(g.price, target, progress));
    const x1 = xOf(acc);
    const x2 = xOf(acc + g.budget);
    pts.push({ x: x1, y }, { x: x2, y });
    tiers.push({ price: g.price, budget: g.budget, count: g.count, x1, x2, y });
    if (clearing && clearing > 0n && g.price >= clearing) filled += g.budget;
    acc += g.budget;
  }
  const corners = dedupe(pts);
  const painted = pathFromPoints(corners, bottom);
  const clearingY = clearing && clearing > 0n ? yOf(clearing) : null;
  const crossX = clearingY == null ? null : xOf(filled);
  return {
    stroke: painted.stroke,
    fill: painted.fill,
    pts: corners,
    reserveY: yOf(floor),
    clearingY,
    crossX,
    tiers,
    ...frame,
  };
}

export function pathFromPoints(pts: Pt[], bottom: number): { stroke: string; fill: string } {
  const clean = dedupe(pts);
  const stroke = polyline(clean);
  if (!stroke || clean.length < 2) return { stroke: "", fill: "" };
  const first = clean[0];
  const last = clean[clean.length - 1];
  return {
    stroke,
    fill: `${stroke} L ${last.x.toFixed(2)} ${bottom.toFixed(2)} L ${first.x.toFixed(2)} ${bottom.toFixed(2)} Z`,
  };
}

export function resample(pts: Pt[], n: number): Pt[] {
  if (n < 2) return pts.map((p) => ({ ...p }));
  if (pts.length === 0) return Array.from({ length: n }, () => ({ x: 0, y: 0 }));
  if (pts.length === 1) return Array.from({ length: n }, () => ({ ...pts[0] }));
  const seg = [0];
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = seg[seg.length - 1] || 1;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const d = (total * i) / (n - 1);
    let k = 1;
    while (k < seg.length - 1 && seg[k] < d) k++;
    const span = seg[k] - seg[k - 1] || 1;
    const t = Math.min(1, Math.max(0, (d - seg[k - 1]) / span));
    out.push({
      x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * t,
      y: pts[k - 1].y + (pts[k].y - pts[k - 1].y) * t,
    });
  }
  return out;
}

function priceAt(maxPrice: bigint, clearing: number | null, progress: number): bigint {
  if (clearing == null || progress <= 0) return maxPrice;
  const y = maxPrice === 0n ? 0 : Number(maxPrice) + (clearing - Number(maxPrice)) * easeOut(progress);
  return BigInt(Math.max(0, Math.round(y)));
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

function polyline(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

export function formatRemain(blocks: bigint): string {
  if (blocks <= 0n) return "00:00:00";
  const seconds = Number((blocks * 750n) / 1000n);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
