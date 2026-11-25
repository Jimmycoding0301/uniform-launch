import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4317/?demo=1", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".demo-bar");
await page.getByText("0.00002").first().waitFor({ timeout: 8000 });
const expectScene = async (n, text) => {
  await page.getByText(`第 ${n} / 6 幕`).waitFor();
  if (text) await page.getByText(text).first().waitFor({ timeout: 8000 });
};
await expectScene(1, "0.00002");
await page.getByRole("button", { name: "下一幕" }).click();
await expectScene(2, "复制出价指令");
await page.getByRole("button", { name: "下一幕" }).click();
await expectScene(3, "入池");
await page.getByRole("button", { name: "下一幕" }).click();
await expectScene(4, "开盘价");
await page.getByRole("button", { name: "下一幕" }).click();
await expectScene(5, "没有成交");
await page.getByRole("button", { name: "下一幕" }).click();
await expectScene(6, "单价比");
await page.keyboard.press("ArrowLeft");
await expectScene(5, "没有成交");
await page.keyboard.press("Escape");
await page.waitForURL((url) => !url.search.includes("demo=1"));
await browser.close();
console.log("演示六幕、方向键和退出都通过");
