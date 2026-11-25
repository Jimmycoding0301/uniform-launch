import assert from "node:assert/strict";
import { chromium } from "playwright";

const allow = new Set(["uniform", "launch", "agent", "id", "erc", "bnb", "chain", "flap", "vault", "bscscan", "pancakeswap", "binance"]);
const url = process.env.CHART_URL || "http://127.0.0.1:4317/?launcher=0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("button.primary");
const words = await page.evaluate(() => {
  const root = document.body.cloneNode(true);
  root.querySelectorAll(".bid, textarea, .paste").forEach((node) => node.remove());
  return root.innerText;
});
await browser.close();
const found = [...new Set((words.match(/[A-Za-z]{2,}/g) || []).map((word) => word.toLowerCase()))];
const extra = found.filter((word) => !allow.has(word));
assert.deepEqual(extra, [], `界面英文：${extra.join(", ")}`);
assert.equal(words.includes("·"), false, "界面里还有中点拼接");
console.log("界面英文和中点扫描通过");
