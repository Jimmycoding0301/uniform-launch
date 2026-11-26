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

assert.ok(measured.stageH >= 200, `绘图区高 ${measured.stageH}px，小于 200`);
assert.ok(measured.boxW >= 300, `绘图区宽 ${measured.boxW}px，390 屏上过窄`);
assert.ok(measured.font >= 12, `刻度计算字号 ${measured.font}px，小于 12`);
assert.ok(Math.abs(measured.boxW - measured.viewW) <= 1, `横向被缩放 ${measured.boxW} vs ${measured.viewW}`);
assert.ok(Math.abs(measured.boxH - measured.viewH) <= 1, `纵向被缩放 ${measured.boxH} vs ${measured.viewH}`);
const extra = await (async () => {
  const browser2 = await openBrowser();
  const page = await browser2.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".uniform-rect", { timeout: 8000 });
  const detail = await page.evaluate(() => {
    const ys = document.querySelectorAll("svg.plot text.y-tick").length;
    const xs = document.querySelectorAll("svg.plot text.x-tick").length;
    const svg = document.querySelector("svg.plot");
    const blur = getComputedStyle(svg).filter;
    const rect = document.querySelector(".uniform-rect");
    const dot = document.querySelector(".dot-core");
    const rb = rect.getBoundingClientRect();
    const db = dot.getBoundingClientRect();
    return {
      ys,
      xs,
      blur,
      filters: svg.querySelectorAll("[filter]").length,
      cornerX: Math.abs(rb.right - (db.left + db.width / 2)),
      cornerY: Math.abs(rb.top - (db.top + db.height / 2)),
    };
  });
  await browser2.close();
  return detail;
})();
assert.ok(extra.ys >= 4 && extra.ys <= 6, `纵轴刻度 ${extra.ys}`);
assert.ok(extra.xs >= 3, `横轴刻度 ${extra.xs}`);
assert.equal(extra.filters, 0);
assert.ok(extra.blur === "none" || extra.blur === "", `模糊 ${extra.blur}`);
assert.ok(extra.cornerX <= 1 && extra.cornerY <= 1, `同价矩形角点 ${extra.cornerX}, ${extra.cornerY}`);
const shotBrowser = await openBrowser();
const shotPage = await shotBrowser.newPage({ viewport: { width: 390, height: 844 } });
await shotPage.goto(url, { waitUntil: "domcontentloaded" });
await shotPage.waitForSelector("svg.plot");
const plotBox = await shotPage.locator("svg.plot").boundingBox();
const png = await shotPage.screenshot({ clip: { x: plotBox.x, y: plotBox.y, width: plotBox.width, height: plotBox.height } });
await shotBrowser.close();
const image = pngRows(png);
const blank = [];
for (let y = 6; y < image.height - 6 && blank.length < 5; y += 10) {
  for (let x = 70; x < image.width - 6 && blank.length < 5; x += 20) {
    const i = x * image.bpp;
    const px = [image.rows[y][i], image.rows[y][i + 1], image.rows[y][i + 2]];
    if (px[0] === 11 && px[1] === 11 && px[2] === 13) blank.push([x, y]);
  }
}
assert.ok(blank.length >= 5, `绘图区空白没有落在页面底色上，只找到 ${blank.length} 个`);
console.log(
  `390 图表通过：绘图区 ${measured.stageH}px，刻度 ${measured.font}px，viewBox ${measured.viewW}x${measured.viewH} 与像素一致`,
);
