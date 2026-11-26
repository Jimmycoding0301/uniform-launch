export type Bid = { budget: bigint; maxPrice: bigint };

export type Point = { x: number; y: number };
export type Tier = Point & { price: bigint; budget: bigint; cumulative: bigint; count: number };
export type Tick = { value: bigint; text: string; position: number };

export function parseBnb(input: string): bigint | null {
  const s = input.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  if (frac.length > 18) return null;
  if (whole.length > 19) return null;
  const padded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(padded);
}

export function formatBnb(wei: bigint): string {
  const neg = wei < 0n;
  const v = neg ? -wei : wei;
  const whole = v / 10n ** 18n;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  const body = frac ? `${grouped}.${frac}` : grouped;
  return neg ? `-${body}` : body;
}

export function formatBnb4(wei: bigint): string {
  const neg = wei < 0n;
  const v = neg ? -wei : wei;
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 4);
  const body = `${whole}.${frac}`;
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

/** At each price knot, x is exactly the total budget bidding at or above that price. */
export function demandChart(bids: Bid[], width: number, height: number, floor: bigint, clearing: bigint | null) {
  const grouped = new Map<bigint, { budget: bigint; count: number }>();
  for (const bid of bids) {
    if (bid.budget <= 0n || bid.maxPrice <= 0n) continue;
    const tier = grouped.get(bid.maxPrice) ?? { budget: 0n, count: 0 };
    tier.budget += bid.budget;
    tier.count += 1;
    grouped.set(bid.maxPrice, tier);
  }
  const prices = [...grouped.keys()].sort((a, b) => a > b ? -1 : a < b ? 1 : 0);
  const total = [...grouped.values()].reduce((sum, tier) => sum + tier.budget, 0n);
  const highest = [prices[0] ?? 0n, floor, clearing ?? 0n].reduce((a, b) => a > b ? a : b, 1n);
  const step = niceStep(highest);
  const intervals = Number((highest + step - 1n) / step);
  const axisMax = BigInt(intervals) * step;
  const axisLabels = Array.from({ length: intervals + 1 }, (_, i) => formatPrice(BigInt(i) * step));
  const left = Math.max(33, Math.ceil(Math.max(...axisLabels.map((text) => text.length)) * 7.3) + 11);
  const right = Math.max(left + 1, width - 9);
  const top = 10;
  const bottom = Math.max(top + 1, height - 24);
  const x = (value: bigint) => left + (total ? Number(value) / Number(total) : 0) * (right - left);
  const y = (value: bigint) => bottom - Number(value) / Number(axisMax) * (bottom - top);
  const yTicks: Tick[] = axisLabels.map((text, i) => ({ value: BigInt(i) * step, text, position: y(BigInt(i) * step) }));
  let filled = 0n;
  let cumulative = 0n;
  const tiers: Tier[] = prices.map((price) => {
    const tier = grouped.get(price)!;
    cumulative += tier.budget;
    if (clearing !== null && price >= clearing) filled += tier.budget;
    return { ...tier, price, cumulative, x: x(cumulative), y: y(price) };
  });
  const clear = clearing !== null && clearing > 0n && tiers.length ? { x: x(filled), y: y(clearing) } : null;
  // Reserve both endpoint labels first. Keep a clearing tick only if it fits between them.
  const xTicks: Tick[] = [{ value: 0n, position: left, text: "0" }];
  if (total > 0n) {
    const last = { value: total, position: right, text: formatBnb(total) };
    xTicks.push(last);
    const middle = filled > 0n && filled < total ? filled : total / 2n;
    const candidates = [middle];
    const budgetStep = niceStep(total);
    for (let value = budgetStep; value < total; value += budgetStep) candidates.push(value);
    for (const value of candidates) {
      const text = formatBnb(value);
      const position = x(value);
      if (xTicks.some((tick) => Math.abs(tick.position - position) < 16 + (tick.text.length + text.length) * 4)) continue;
      xTicks.push({ value, text, position });
    }
    xTicks.sort((a, b) => a.position - b.position);
  }
  const stroke = monotonePath(tiers);
  return { width, height, left, right, top, bottom, total, tiers, clear, filled, yTicks, xTicks, stroke };
}

function niceStep(highest: bigint): bigint {
  const rough = highest > 4n ? highest / 4n : 1n;
  const unit = 10n ** BigInt(rough.toString().length - 1);
  return [unit, 2n * unit, 5n * unit, 10n * unit].reduce((best, next) =>
    Math.abs(Number(highest) / Number(next) - 4) < Math.abs(Number(highest) / Number(best) - 4) ? next : best
  );
}

/** Shape-preserving cubic interpolation through observed tiers. No interpolated point is a bid. */
export function monotonePath(points: Point[]): string {
  if (!points.length) return "";
  const slopes = points.slice(1).map((p, i) => (p.y - points[i].y) / (p.x - points[i].x));
  const tangents = points.map((p, i) => {
    if (i === 0) return slopes[0] ?? 0;
    if (i === points.length - 1) return slopes[i - 1];
    const before = slopes[i - 1], after = slopes[i];
    if (before * after <= 0) return 0;
    const prevWidth = p.x - points[i - 1].x, nextWidth = points[i + 1].x - p.x;
    const w1 = 2 * nextWidth + prevWidth, w2 = nextWidth + 2 * prevWidth;
    return (w1 + w2) / (w1 / before + w2 / after);
  });
  const coord = (value: number) => Number(value.toFixed(3));
  let path = `M ${coord(points[0].x)} ${coord(points[0].y)}`;
  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1], end = points[i];
    const dx = (end.x - start.x) / 3;
    path += ` C ${coord(start.x + dx)} ${coord(start.y + dx * tangents[i - 1])} ${coord(end.x - dx)} ${coord(end.y - dx * tangents[i])} ${coord(end.x)} ${coord(end.y)}`;
  }
  return path;
}

export function formatRemain(blocks: bigint): string {
  if (blocks <= 0n) return "00:00:00";
  const seconds = Number((blocks * 750n) / 1000n);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
