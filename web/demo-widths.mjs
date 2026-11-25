import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch();
const notes = [];
for (const width of [390, 375, 320]) {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  await page.goto("http://127.0.0.1:4317/?demo=1", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".demo-bar");
  await page.waitForSelector("button.primary");
  for (let scene = 1; scene <= 6; scene++) {
    const box = await page.evaluate(() => {
      const btn = document.querySelector("button.primary").getBoundingClientRect();
      const bar = document.querySelector(".demo-bar").getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        btnTop: Math.round(btn.top),
        btnBottom: Math.round(btn.bottom),
        barTop: Math.round(bar.top),
        overlap: btn.bottom > bar.top && btn.top < bar.bottom,
      };
    });
    notes.push({ width, scene, ...box });
    assert.equal(box.overlap, false, `${width} 第 ${scene} 幕重叠 ${JSON.stringify(box)}`);
    assert.ok(box.overflow <= 1, `${width} 第 ${scene} 幕横向溢出 ${box.overflow}`);
    if (scene < 6) await page.getByRole("button", { name: "下一幕" }).click();
    await page.waitForTimeout(200);
  }
  await page.close();
}
await browser.close();
console.log(JSON.stringify(notes, null, 2));
