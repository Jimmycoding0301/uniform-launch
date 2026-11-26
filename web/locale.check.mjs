import assert from "node:assert/strict";
import { openBrowser } from "./test-browser.mjs";
import { demoOrigin } from "./demo-origin.mjs";

const browser = await openBrowser();
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ["clipboard-read", "clipboard-write"],
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const labels = ["Bids and clearing price", "Set a bid limit", "Simulate your bid", "Launch and vault", "Below target, full refund", "Compare launch prices"];
  await page.goto(`${demoOrigin}/?demo=1`);
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  await page.getByRole("button", { name: "下一幕" }).click();
  await page.getByRole("link", { name: "Switch to English" }).click();
  await page.waitForURL((url) => url.searchParams.get("lang") === "en" && url.searchParams.get("scene") === "2");

  for (const [index, label] of labels.entries()) {
    await page.goto(`${demoOrigin}/?demo=1&scene=${index + 1}`);
    await page.getByText(label, { exact: false }).first().waitFor();
    await page.locator(".bid:not(.head)").first().waitFor();
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    const english = await page.locator("main, .demo-bar").allInnerTexts();
    assert.doesNotMatch(english.join("\n"), /\p{Script=Han}/u);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    if (index === 2) {
      await page.getByRole("button", { name: "Limit 0.000015 BNB/token", exact: true }).click();
      await page.getByText("Full refund", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Limit 0.00003 BNB/token", exact: true }).click();
      assert.equal((await page.locator(".preview-head .chart-price").innerText()).trim(), "50,000 tokens");
      await page.getByRole("button", { name: "Copy bid instruction" }).click();
      const command = await page.evaluate(() => navigator.clipboard.readText());
      assert.match(command, /node agent\/cli\.mjs simulate/);
      assert.doesNotMatch(command, /\p{Script=Han}/u);
    }
  }

  await page.getByRole("link", { name: "Receipts", exact: true }).click();
  await page.getByRole("heading", { name: "Public testnet launch" }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("lang"), "en");
  const auction = await page.getByRole("link", { name: /View settled auction/ }).getAttribute("href");
  assert.equal(new URL(auction, demoOrigin).searchParams.get("lang"), "en");
  await page.getByRole("link", { name: "切换到中文" }).click();
  await page.getByRole("heading", { name: "公开测试网发射" }).waitFor();
  await page.goto(`${demoOrigin}/?network=testnet`);
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  console.log("中英六幕、切换记忆、回执链接和英文代理指令通过");
} finally {
  await browser.close();
}
