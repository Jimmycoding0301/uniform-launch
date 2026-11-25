import assert from "node:assert/strict";
import { chromium } from "playwright";

const url = process.env.CHART_URL ?? "http://127.0.0.1:4317/";

const browser = await chromium.launch();
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
assert.ok(measured.font >= 12, `刻度计算字号 ${measured.font}px，小于 12`);
assert.ok(Math.abs(measured.boxW - measured.viewW) <= 1, `横向被缩放 ${measured.boxW} vs ${measured.viewW}`);
assert.ok(Math.abs(measured.boxH - measured.viewH) <= 1, `纵向被缩放 ${measured.boxH} vs ${measured.viewH}`);
const extra = await (async () => {
  const browser2 = await chromium.launch();
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
assert.ok(extra.cornerX <= 2 && extra.cornerY <= 2, `同价矩形角点 ${extra.cornerX}, ${extra.cornerY}`);
console.log(
  `390 图表通过：绘图区 ${measured.stageH}px，刻度 ${measured.font}px，viewBox ${measured.viewW}x${measured.viewH} 与像素一致`,
);
