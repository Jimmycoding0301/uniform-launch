import { demoOrigin } from "./demo-origin.mjs";
import assert from "node:assert/strict";
import { demandChart, monotonePath } from "./src/curve.ts";

const sets = [];
for (let n = 0; n < 20; n++) {
  const count = 3 + (n * 3) % 8;
  const bids = [];
  let price = 80_000_000_000_000n - BigInt(n) * 5_000_000_000_000n;
  for (let i = 0; i < count; i++) {
    if (price < 10_000_000_000_000n) price = 10_000_000_000_000n;
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
sets.push([
  { budget: 8n * 10n ** 18n, maxPrice: 10_000_000_000_000n },
  { budget: 4n * 10n ** 18n, maxPrice: 10_000_000_000_000n },
]);
sets.push([], [{ budget: 5n * 10n ** 18n, maxPrice: 12_000_000_000_000n }]);
for (const [width, height] of [[978, 172], [697, 168], [350, 162], [287, 134]]) {
  for (const bids of sets) {
    const floor = 10_000_000_000_000n;
    const clearing = bids.length ? bids[Math.floor(bids.length / 2)].maxPrice : null;
    const plot = demandChart(bids, width, height, floor, clearing);
    const sum = bids.reduce((n, bid) => n + bid.budget, 0n);
    assert.equal(plot.total, sum);
    assert.equal(plot.tiers.length, new Set(bids.map((bid) => bid.maxPrice)).size);
    for (const [index, tier] of plot.tiers.entries()) {
      const expected = bids.filter((bid) => bid.maxPrice >= tier.price).reduce((n, bid) => n + bid.budget, 0n);
      assert.equal(tier.cumulative, expected);
      assert.ok(Math.abs(tier.x - plot.left - Number(expected) / Number(sum) * (plot.right - plot.left)) < 0.001);
      assert.ok(tier.y >= plot.top && tier.y <= plot.bottom);
      if (index > 0) assert.ok(plot.tiers[index - 1].x < tier.x && plot.tiers[index - 1].y <= tier.y);
    }
    if (clearing) {
      assert.equal(plot.filled, bids.filter((bid) => bid.maxPrice >= clearing).reduce((n, bid) => n + bid.budget, 0n));
      const matching = plot.tiers.find((tier) => tier.price === clearing);
      assert.equal(plot.clear.x, matching.x);
      assert.equal(plot.clear.y, matching.y);
    }
    const commands = [...plot.stroke.matchAll(/C ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)/g)];
    assert.equal(commands.length, Math.max(0, plot.tiers.length - 1));
    commands.forEach((command, index) => {
      const a = plot.tiers[index], b = plot.tiers[index + 1];
      const [x1, y1, x2, y2, x, y] = command.slice(1).map(Number);
      assert.ok(x1 >= a.x - .001 && x2 <= b.x + .001 && x1 <= x2);
      assert.ok(y1 >= a.y - .001 && y1 <= b.y + .001 && y2 >= a.y - .001 && y2 <= b.y + .001, "平滑段不能越过实际报价范围");
      assert.ok(Math.abs(x - b.x) <= .001 && Math.abs(y - b.y) <= .001);
    });
    for (let i = 1; i < plot.xTicks.length; i++) {
      assert.ok(plot.xTicks[i].position > plot.xTicks[i-1].position, "横轴标签需要分离");
    }
  }
}
const betweenLimits = demandChart([{ maxPrice: 8n, budget: 3n }, { maxPrice: 2n, budget: 2n }], 350, 165, 1n, 5n);
assert.equal(betweenLimits.filled, 3n);
assert.equal(betweenLimits.clear.x, betweenLimits.tiers[0].x);
assert.ok(betweenLimits.clear.y > betweenLimits.tiers[0].y && betweenLimits.clear.y < betweenLimits.tiers[1].y);
assert.equal(monotonePath([]), "");
console.log("报价节点与累计预算一致，平滑连线通过每个档位且不超出相邻报价范围");

const { openBrowser } = await import("./test-browser.mjs");
const { demoBook } = await import("./demo-book.mjs");
const book = await demoBook();
const browser = await openBrowser();
const pages = [
  ["1440", 1440, 900, `${demoOrigin}/?launcher=${book.open}`],
  ["737", 737, 900, `${demoOrigin}/?launcher=${book.open}`],
  ["390", 390, 844, `${demoOrigin}/?launcher=${book.open}`],
  ["done", 1440, 900, `${demoOrigin}/?launcher=${book.launched}`],
];
for (const [name, width, height, url] of pages) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("svg.demand-plot .tier-node");
  const problem = await page.evaluate(() => {
    const svg = document.querySelector("svg.plot");
    const view = svg.viewBox.baseVal;
    const texts = [...svg.querySelectorAll("text")].map((el) => {
      const b = el.getBBox();
      return { t: el.textContent.trim(), x: b.x, y: b.y, w: b.width, h: b.height };
    });
    const hits = [];
    for (let i = 0; i < texts.length; i++) {
      const a = texts[i];
      if (a.x < -2 || a.y < -2 || a.x + a.w > view.width + 2 || a.y + a.h > view.height + 4) hits.push("出图 " + a.t);
      for (let j = i + 1; j < texts.length; j++) {
        const b = texts[j];
        if (a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1) hits.push(a.t + " / " + b.t);
      }
    }
    const plotBounds = svg.getBoundingClientRect();
    const caption = document.querySelector(".demand-caption").getBoundingClientRect();
    if (caption.top < plotBounds.bottom - 1 || caption.right > innerWidth + 1) hits.push("图例侵入绘图区");
    return hits;
  });
  assert.deepEqual(problem, [], `${name} 标注：${problem.join("；")}`);
  await page.close();
}
const failed = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await failed.goto(`${demoOrigin}/?launcher=${book.failed}`, { waitUntil: "domcontentloaded" });
const meter = failed.getByRole("meter", { name: "入池门槛完成度" });
await meter.waitFor();
const completion = Number(await meter.getAttribute("aria-valuenow"));
assert.ok(completion >= 0 && completion <= 100, `入池进度 ${completion}`);
await browser.close();
console.log("页面上的标注也不出图、不重叠");
