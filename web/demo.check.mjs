import { demoOrigin } from "./demo-origin.mjs";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${demoOrigin}/?demo=1`, { waitUntil: "domcontentloaded" });
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
await page.locator("#budget").fill("");
await page.getByText("还不能算").waitFor();
await page.locator("#budget").fill("1");
await page.getByText("入池").first().waitFor();
await page.getByRole("button", { name: "下一幕" }).click();
await expectScene(4, "金库余额");
await page.locator(".slip.metric").waitFor({ timeout: 8000 });
const vaultMetrics = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".result-card .result-row")];
  const pick = (label) => rows.find((row) => row.innerText.includes(label));
  const pool = pick("入池");
  const vault = pick("金库余额");
  const poolValue = getComputedStyle(pool.querySelector("b"));
  const vaultValue = getComputedStyle(vault.querySelector("b"));
  const slipValue = getComputedStyle(document.querySelector(".slip.metric .result-row b"));
  return {
    poolSize: poolValue.fontSize,
    vaultSize: vaultValue.fontSize,
    slipSize: slipValue.fontSize,
    poolAlign: getComputedStyle(pool).justifyContent,
    vaultAlign: getComputedStyle(vault).justifyContent,
    text: vault.innerText.replace(/\s+/g, " "),
  };
});
assert.equal(vaultMetrics.vaultSize, vaultMetrics.poolSize, `金库字号 ${vaultMetrics.vaultSize} 入池 ${vaultMetrics.poolSize}`);
assert.equal(vaultMetrics.slipSize, vaultMetrics.poolSize, `金库条字号 ${vaultMetrics.slipSize}`);
assert.equal(vaultMetrics.vaultAlign, vaultMetrics.poolAlign);
assert.match(vaultMetrics.text, /金库余额 \d+\.\d{4} BNB/);
assert.equal(vaultMetrics.text.includes("0.0000"), false, vaultMetrics.text);
await page.getByText("池子", { exact: true }).waitFor({ timeout: 8000 });
assert.equal(await page.getByText("PancakeSwap").count(), 0);
assert.equal(await page.getByText("BscScan").count(), 0);
await page.getByRole("button", { name: "下一幕" }).click();
await expectScene(5, "出价全额退回");
await page.getByRole("button", { name: "下一幕" }).click();
await expectScene(6, "单价比");
await page.locator("#budget").focus();
await page.keyboard.press("ArrowLeft");
await expectScene(6, "单价比");
await page.locator("#budget").blur();
await page.keyboard.press("ArrowLeft");
await expectScene(5, "没有成交");
await page.keyboard.press("ArrowRight");
await expectScene(6, "单价比");
await page.locator("#budget").focus();
await page.keyboard.press("Escape");
await page.waitForURL((url) => !url.search.includes("demo=1"));
const missing = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await missing.route("**/demo.json", (route) => route.fulfill({ status: 404, body: "" }));
await missing.goto(`${demoOrigin}/?demo=1`, { waitUntil: "domcontentloaded" });
await missing.getByText("还没有演示场").first().waitFor();
await missing.getByText("先跑演示命令").first().waitFor();
await missing.close();
const down = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await down.goto(`${demoOrigin}/?demo=1`, { waitUntil: "domcontentloaded" });
await down.getByText("0.00002").first().waitFor({ timeout: 8000 });
await down.route("**/*", (route) => {
  if (route.request().url().includes(":18545")) return route.abort();
  return route.continue();
});
await down.locator(".hash-toggle").evaluate((el) => el.scrollIntoView({ block: "center" }));
await down.getByRole("button", { name: "已发送？贴哈希核对" }).click();
await down.locator("#txhash").fill(`0x${"ab".repeat(32)}`);
await down.getByRole("button", { name: "核对", exact: true }).click();
await down.getByText("读不到链").waitFor({ timeout: 8000 });
await down.close();
const fold = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await fold.goto(`${demoOrigin}/?demo=1`, { waitUntil: "domcontentloaded" });
await fold.getByText("0.00002").first().waitFor({ timeout: 8000 });
await fold.locator(".hash-toggle").evaluate((el) => el.scrollIntoView({ block: "center" }));
await fold.getByRole("button", { name: "已发送？贴哈希核对" }).click();
await fold.locator("#txhash").waitFor();
await fold.getByRole("button", { name: "下一幕" }).click();
await fold.locator("#txhash").waitFor({ state: "detached" });
await fold.close();
const keys = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await keys.goto(`${demoOrigin}/?demo=1`, { waitUntil: "domcontentloaded" });
await keys.getByText("0.00002").first().waitFor({ timeout: 8000 });
await keys.getByText("测试网 Agent ID 为替身").first().waitFor({ timeout: 8000 });
assert.equal(await keys.getByRole("radio").count(), 1);
await keys.getByRole("radio", { name: "Agent ID" }).focus();
await keys.keyboard.press("ArrowRight");
await keys.getByText("第 1 / 6 幕").waitFor();
assert.equal(await keys.locator("[role=radio][aria-checked=true]").innerText(), "Agent ID");
await keys.getByRole("heading", { name: "同价发射" }).first().click();
await keys.keyboard.press("ArrowRight");
await keys.getByText("第 2 / 6 幕").waitFor();
await keys.close();
const none = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await none.goto(`${demoOrigin}/?launcher=0x0000000000000000000000000000000000000000`, { waitUntil: "domcontentloaded" });
await none.getByText("没有这场拍卖").first().waitFor({ timeout: 8000 });
await none.close();
const blank = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await blank.goto(`${demoOrigin}/?empty=1`, { waitUntil: "domcontentloaded" });
await blank.getByRole("link", { name: "打开演示脚本" }).click();
await blank.waitForURL((url) => url.search.includes("demo=1"));
await blank.close();
await browser.close();
console.log("演示六幕、方向键和退出都通过");
