import { demoOrigin } from "./demo-origin.mjs";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { openBrowser } from "./test-browser.mjs";

function pngRows(buf) {
  let offset = 8;
  const parts = [];
  let width = 0;
  let height = 0;
  let color = 0;
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      color = data[9];
    } else if (type === "IDAT") parts.push(data);
    else if (type === "IEND") break;
    offset += 12 + len;
  }
  const inflated = inflateSync(Buffer.concat(parts));
  const bpp = color === 6 ? 4 : 3;
  const stride = width * bpp;
  let cursor = 0;
  let prev = Buffer.alloc(stride);
  const paeth = (a, b, c) => {
    const q = a + b - c;
    const pa = Math.abs(q - a);
    const pb = Math.abs(q - b);
    const pc = Math.abs(q - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  const rows = [];
  for (let y = 0; y < height; y++) {
    const filter = inflated[cursor++];
    const row = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const raw = inflated[cursor++];
      const left = i >= bpp ? row[i - bpp] : 0;
      const up = prev[i];
      const ul = i >= bpp ? prev[i - bpp] : 0;
      if (filter === 0) row[i] = raw;
      else if (filter === 1) row[i] = (raw + left) & 255;
      else if (filter === 2) row[i] = (raw + up) & 255;
      else if (filter === 3) row[i] = (raw + Math.floor((left + up) / 2)) & 255;
      else row[i] = (raw + paeth(left, up, ul)) & 255;
    }
    prev = row;
    rows.push(row);
  }
  return { width, height, rows, bpp };
}

const url = process.env.CHART_URL ?? `${demoOrigin}/`;

const browser = await openBrowser();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("svg.plot .tick", { timeout: 8000 });
const measured = await page.evaluate(() => {
  const stage = document.querySelector(".stage");
  const svg = document.querySelector("svg.plot");
  const tick = document.querySelector("svg.plot .tick");
  const box = svg.getBoundingClientRect();
  const view = svg.viewBox.baseVal;
  return {
    stageH: stage.getBoundingClientRect().height,
    font: Number.parseFloat(getComputedStyle(tick).fontSize),
    boxW: box.width,
    boxH: box.height,
    viewW: view.width,
    viewH: view.height,
  };
});
await browser.close();

assert.ok(measured.stageH >= 155, `手机绘图区高 ${measured.stageH}px，小于 155`);
assert.ok(measured.boxW >= 300, `绘图区宽 ${measured.boxW}px，390 屏上过窄`);
assert.ok(measured.font >= 12, `刻度计算字号 ${measured.font}px，小于 12`);
assert.ok(Math.abs(measured.boxW - measured.viewW) <= 1, `横向被缩放 ${measured.boxW} vs ${measured.viewW}`);
assert.ok(Math.abs(measured.boxH - measured.viewH) <= 1, `纵向被缩放 ${measured.boxH} vs ${measured.viewH}`);
const detailBrowser = await openBrowser();
try {
  for (const width of [390, 737, 1180, 1440]) {
    const detail = await detailBrowser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await detail.goto(url, { waitUntil: "domcontentloaded" });
    await detail.locator(".clear-point").waitFor();
    const metrics = await detail.evaluate(() => {
      const svg = document.querySelector("svg.demand-plot");
      const curve = svg.querySelector(".demand-curve");
      const tierNodes = [...svg.querySelectorAll(".tier-node")];
      const dot = svg.querySelector(".clear-core");
      const guide = svg.querySelector(".clear-guide");
      const data = svg.querySelector(".clear-point").dataset;
      const poolValue = document.querySelector(".market-note small span:last-child");
      const nearest = Math.min(...tierNodes.map((n) => Math.hypot(n.cx.baseVal.value - dot.cx.baseVal.value, n.cy.baseVal.value - dot.cy.baseVal.value)));
      return {
        ys: svg.querySelectorAll(".y-tick").length, xs: svg.querySelectorAll(".x-tick").length,
        blur: getComputedStyle(svg).filter, filters: svg.querySelectorAll("[filter]").length,
        nearest, markerX: dot.cx.baseVal.value, guideX: guide.x1.baseVal.value,
        xLabels: [...svg.querySelectorAll(".x-tick")].map((e) => e.textContent),
        poolValueHeight: poolValue.getBoundingClientRect().height,
        poolLineHeight: parseFloat(getComputedStyle(poolValue).lineHeight),
        nodes: tierNodes.length, cubics: (curve.getAttribute("d").match(/ C /g) ?? []).length,
        budget: data.budget, price: data.price,
        caption: document.querySelector(".demand-caption").innerText,
        grid: svg.querySelector(".demand-grid").getBoundingClientRect().width,
        legendHeight: document.querySelector(".demand-caption").getBoundingClientRect().height,
      };
    });
    assert.ok(metrics.ys >= 4 && metrics.ys <= 7 && metrics.xs >= 3);
    assert.equal(metrics.filters, 0);
    assert.equal(metrics.blur, "none");
    assert.equal(metrics.nodes, 8); // Nine demo bids, with two sharing the marginal limit.
    assert.equal(metrics.cubics, metrics.nodes - 1);
    assert.ok(metrics.nearest < .01 && Math.abs(metrics.markerX - metrics.guideX) < .01);
    assert.ok(metrics.xLabels.includes("11") && metrics.xLabels.includes("15.7") && !metrics.xLabels.includes("3.925"));
    assert.ok(metrics.poolValueHeight <= metrics.poolLineHeight + 1, "预计入池金额与单位需同一行");
    assert.equal(metrics.price, "0.00002");
    assert.equal(metrics.budget, "11");
    assert.ok(metrics.caption.includes("11 BNB") && metrics.caption.includes("保留价") && metrics.caption.includes("你的限价"));
    assert.ok(metrics.grid > 200 && metrics.legendHeight <= 56);
    await detail.locator(".demand-plot").focus();
    await detail.keyboard.press("ArrowRight");
    await detail.locator(".tier-detail").getByText(/本档/).waitFor();
    await detail.keyboard.press("Escape");
    await detail.locator(".tier-detail").waitFor({ state: "detached" });
    await detail.close();
  }
} finally {
  await detailBrowser.close();
}
const shotBrowser = await openBrowser();
const shotPage = await shotBrowser.newPage({ viewport: { width: 390, height: 844 } });
await shotPage.goto(url, { waitUntil: "domcontentloaded" });
await shotPage.waitForSelector("svg.plot");
const plotBox = await shotPage.locator("svg.plot").boundingBox();
const background = await shotPage.locator(".page").evaluate((el) => getComputedStyle(el).backgroundColor.match(/\d+/g).slice(0, 3).map(Number));
const png = await shotPage.screenshot({ clip: { x: plotBox.x, y: plotBox.y, width: plotBox.width, height: plotBox.height } });
await shotBrowser.close();
const image = pngRows(png);
const blank = [];
for (let y = 6; y < image.height - 6 && blank.length < 5; y += 10) {
  for (let x = 70; x < image.width - 6 && blank.length < 5; x += 20) {
    const i = x * image.bpp;
    const px = [image.rows[y][i], image.rows[y][i + 1], image.rows[y][i + 2]];
    if (px.every((v, j) => v === background[j])) blank.push([x, y]);
  }
}
assert.ok(blank.length >= 5, `绘图区空白没有落在页面底色上，只找到 ${blank.length} 个`);
console.log(
  `390 图表通过：绘图区 ${measured.stageH}px，刻度 ${measured.font}px，viewBox ${measured.viewW}x${measured.viewH} 与像素一致`,
);
