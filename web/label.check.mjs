import assert from "node:assert/strict";
import { buildStepPath, formatBnb, formatPrice } from "./src/curve.ts";

function box(text, x, y, anchor) {
  const width = text.length * 7.2;
  const left = anchor === "end" ? x - width : anchor === "middle" ? x - width / 2 : x;
  return { left, right: left + width, top: y - 12, bottom: y + 2, text };
}

function hit(a, b) {
  return a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
}

function labels(plot, floor, clearing, yourPrice, width, height) {
  const out = [];
  const reserveY = Math.min(plot.bottom - 4, Math.max(14, plot.reserveY + (plot.clearingY != null && Math.abs(plot.clearingY - plot.reserveY) < 18 ? 14 : -6)));
  out.push(box(`保留价 ${formatPrice(floor)}`, plot.left + 4, reserveY, "start"));
  if (plot.yourY != null && yourPrice != null) {
    const yourY = Math.min(plot.bottom - 4, Math.max(14, plot.yourY <= plot.reserveY ? plot.yourY + 14 : plot.yourY - 6));
    out.push(box(`你的限价 ${formatPrice(yourPrice)}`, plot.left + 4, yourY, "start"));
  }
  if (plot.clearingY != null) {
    out.push(box(`清算价 ${formatPrice(clearing)}`, plot.right - 4, Math.max(14, plot.clearingY - 8), "end"));
    const near = plot.right - (plot.crossX ?? plot.left) < 96;
    const x = near ? (plot.crossX ?? plot.left) - 6 : (plot.crossX ?? plot.left) + 6;
    const y = Math.min(plot.bottom - 16, plot.clearingY + 16);
    out.push(box(`成交 ${formatBnb(plot.filled)} BNB`, x, y, near ? "end" : "start"));
  }
  for (const item of out) {
    assert.ok(item.left >= -1 && item.right <= width + 1, `标注出左右边界 ${item.text}`);
    assert.ok(item.top >= -1 && item.bottom <= height + 18, `标注出上下边界 ${item.text}`);
  }
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      assert.ok(!hit(out[i], out[j]), `标注重叠 ${out[i].text} / ${out[j].text}`);
    }
  }
}

const sets = [];
for (let n = 0; n < 5; n++) {
  const count = 3 + (n * 3) % 8;
  const bids = [];
  let price = 80_000_000_000_000n - BigInt(n) * 5_000_000_000_000n;
  for (let i = 0; i < count; i++) {
    bids.push({ budget: BigInt(1 + ((n * 5 + i * 3) % 7)) * 10n ** 17n, maxPrice: price });
    price -= 4_000_000_000_000n + BigInt(n * 1_000_000_000_000);
    if (price < 10_000_000_000_000n) price = 10_000_000_000_000n;
  }
  sets.push(bids);
}

sets.push([
  { budget: 2n * 10n ** 18n, maxPrice: 12_000_000_000_000n },
  { budget: 3n * 10n ** 18n, maxPrice: 11_000_000_000_000n },
  { budget: 1n * 10n ** 18n, maxPrice: 10_500_000_000_000n },
]);
for (const [width, height] of [[920, 288], [358, 260]]) {
  for (const bids of sets) {
    const floor = 10_000_000_000_000n;
    const clearing = bids[Math.floor(bids.length / 2)].maxPrice;
    const your = bids[0].maxPrice + 1_000_000_000_000n;
    const plot = buildStepPath(bids, width, height, floor, clearing, 0, your);
    labels(plot, floor, clearing, your, width, height);
    if (plot.rect && plot.crossX != null && plot.clearingY != null) {
      const cornerX = plot.rect.x + plot.rect.w;
      const cornerY = plot.rect.y;
      assert.ok(Math.abs(cornerX - plot.crossX) <= 1, `矩形右缘 ${cornerX} 清算点 ${plot.crossX}`);
      assert.ok(Math.abs(cornerY - plot.clearingY) <= 1, `矩形上缘 ${cornerY} 清算点 ${plot.clearingY}`);
    }
  }
}
console.log("五组出价的标注都不出图、不重叠");
