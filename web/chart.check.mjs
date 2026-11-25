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
console.log(
  `390 图表通过：绘图区 ${measured.stageH}px，刻度 ${measured.font}px，viewBox ${measured.viewW}x${measured.viewH} 与像素一致`,
);
