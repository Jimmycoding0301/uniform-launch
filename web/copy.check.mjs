import assert from "node:assert/strict";
import { chromium } from "playwright";
import { demoBook } from "./demo-book.mjs";

const book = await demoBook();
const allow = new Set(["uniform", "launch", "agent", "id", "erc", "bnb", "chain", "flap", "vault", "bscscan", "pancakeswap", "binance"]);
const base = process.env.CHART_URL || "http://127.0.0.1:4317";
const pages = [
  `/?launcher=${book.open}`,
  `/?launcher=${book.open}&preview=wait`,
  `/?launcher=${book.open}&preview=closed`,
  `/?launcher=${book.open}&preview=ready`,
  `/?launcher=${book.failed}`,
  `/?launcher=${book.launched}`,
  "/?network=testnet",
  "/?launcher=0x0000000000000000000000000000000000000000",
  "/?view=script",
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const path of pages) {
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const words = await page.evaluate(() => {
    const root = document.body.cloneNode(true);
    root.querySelectorAll(".bid, textarea, .paste, .roller").forEach((node) => node.remove());
    root.querySelectorAll("svg text").forEach((node) => {
      node.textContent = `${node.textContent}\n`;
    });
    return root.innerText;
  });
  const phrases = ["pancakeswap", "bscscan", "uniform launch", "agent id", "erc-8004", "bnb chain", "flap vault", "binance", "uniform", "launch", "agent", "flap", "vault", "chain", "bnb", "erc", "id"];
  let stripped = words.toLowerCase().replace(/0x/g, " ");
  for (const phrase of phrases) stripped = stripped.replaceAll(phrase, " ");
  const found = [...new Set(stripped.match(/[a-z]{2,}/g) || [])];
  const extra = found.filter((word) => !allow.has(word) && !/^[0-9a-f]+$/.test(word));
  assert.deepEqual(extra, [], `${path} 界面英文：${extra.join(", ")}`);
  const offLabel = words.replace(/已募 [\d.,]+ BNB\s*·\s*门槛 [\d.,]+ BNB/g, "");
  assert.equal(offLabel.includes("·"), false, `${path} 出价门槛之外出现中点拼接`);
  const bareNumbers = words.match(/(?<![\d.,])\d{5,}(?![\d.,])/g) ?? [];
  assert.deepEqual(bareNumbers, [], `${path} 缺千分位：${bareNumbers.join(", ")}`);
  const sizes = await page.evaluate(() => {
    const seen = new Set();
    for (const el of document.querySelectorAll("body *")) {
      const box = el.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      const hasText = [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim()) || el.matches("input,button");
      if (!hasText) continue;
      seen.add(Math.round(parseFloat(getComputedStyle(el).fontSize)));
    }
    return [...seen].sort((a, b) => a - b);
  });
  const off = sizes.filter((size) => ![12, 14, 16, 20, 24, 48, 56].includes(size));
  assert.deepEqual(off, [], `${path} 字号超出字号表：${off.join(", ")}，实际 ${sizes.join("/")}`);
}
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto(base + pages[0], { waitUntil: "domcontentloaded" });
await mobile.waitForSelector("button.primary");
const mobileSizes = await mobile.evaluate(() => {
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) continue;
    const hasText = [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim()) || el.matches("input,button");
    if (!hasText) continue;
    seen.add(Math.round(parseFloat(getComputedStyle(el).fontSize)));
  }
  return [...seen].sort((a, b) => a - b);
});
await browser.close();
const mobileOff = mobileSizes.filter((size) => ![12, 14, 16, 20, 24, 36].includes(size));
assert.deepEqual(mobileOff, [], `手机字号超出字号表：${mobileOff.join(", ")}，实际 ${mobileSizes.join("/")}`);
console.log("界面英文、中点和字号扫描通过");
