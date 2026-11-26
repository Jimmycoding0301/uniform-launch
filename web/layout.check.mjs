import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.CHART_URL ?? "http://127.0.0.1:4317/?launcher=0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1";
const browser = await chromium.launch();

const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desk.goto(base, { waitUntil: "domcontentloaded" });
await desk.waitForSelector("button.primary");
const before = await desk.evaluate(() => {
  const form = document.querySelector(".col-form").getBoundingClientRect();
  const btn = document.querySelector("button.primary").getBoundingClientRect();
  return { form: form.height, top: btn.top, bottom: btn.bottom, formBottom: form.bottom };
});
await desk.getByRole("radio", { name: "8004" }).click();
await desk.waitForTimeout(250);
const after = await desk.evaluate(() => {
  const form = document.querySelector(".col-form").getBoundingClientRect();
  const btn = document.querySelector("button.primary").getBoundingClientRect();
  return { form: form.height, top: btn.top };
});
const helpMargin = await desk.evaluate(() => getComputedStyle(document.querySelector(".help")).marginTop);
assert.equal(helpMargin, "8px", `帮助行间距 ${helpMargin}`);
const rails = await desk.evaluate(() => ({
  mid: getComputedStyle(document.querySelector(".bid.mid")).backgroundImage.includes("repeating-linear-gradient"),
  solid: getComputedStyle(document.querySelector(".bid.in")).boxShadow.includes("rgb(240, 185, 11)"),
}));
const limitStroke = await desk.evaluate(() => getComputedStyle(document.querySelector(".your-line")).stroke);
assert.ok(limitStroke.includes("240"), `接单页限价线不是金色 ${limitStroke}`);
assert.ok(rails.mid, "边际行不是虚线");
assert.ok(rails.solid, "价内行不是实线");
const stack = await desk.evaluate(() => {
  const plot = document.querySelector(".plot-wrap").getBoundingClientRect();
  const facts = document.querySelector(".facts").getBoundingClientRect();
  return Math.round(facts.top - plot.bottom);
});
assert.ok(stack >= 0, `参数表盖住曲线 ${stack}`);
assert.ok(Math.abs(before.top - 796) <= 8, `按钮上沿 ${before.top}`);
assert.ok(Math.abs(before.bottom - 844) <= 8, `按钮下沿 ${before.bottom}`);
assert.ok(before.bottom <= 860, `桌面按钮下沿 ${before.bottom}`);
assert.ok(before.formBottom <= 900, `左栏下沿 ${before.formBottom}`);
assert.ok(Math.abs(before.form - after.form) <= 2, `表单高度差 ${Math.abs(before.form - after.form)}`);
assert.ok(Math.abs(before.top - after.top) <= 2, `按钮位移 ${Math.abs(before.top - after.top)}`);

const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
await phone.goto(base, { waitUntil: "domcontentloaded" });
await phone.waitForSelector("button.primary");
const mobile = await phone.evaluate(() => {
  const btn = document.querySelector("button.primary").getBoundingClientRect();
  const help = [...document.querySelectorAll(".help")].at(-1)?.getBoundingClientRect();
  const next = help ? document.elementFromPoint(help.x + 8, help.bottom + 8) : null;
  return {
    btnTop: btn.top,
    btnBottom: btn.bottom,
    helpGap: help ? Math.round((next?.getBoundingClientRect().top ?? help.bottom) - help.bottom) : null,
  };
});
assert.ok(mobile.btnTop >= 0 && mobile.btnBottom <= 844, `手机按钮 ${mobile.btnTop}-${mobile.btnBottom}`);
const small = await phone.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("button, a, input, [role=radio]")) {
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) continue;
    if (box.width < 44 || box.height < 44) out.push((el.id || el.textContent || el.tagName).trim().slice(0, 16));
  }
  return out;
});
assert.deepEqual(small, [], `手机命中区小于 44：${small.join(", ")}`);
await phone.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await phone.waitForTimeout(200);
const covered = await phone.evaluate(() => {
  const rows = [...document.querySelectorAll(".bid:not(.head)")];
  const bad = [];
  for (const row of rows) {
    row.scrollIntoView({ block: "center" });
    const box = row.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    if (!row.contains(hit)) bad.push(row.innerText.slice(0, 24));
  }
  return bad;
});
assert.deepEqual(covered, [], `被挡住的出价行：${covered.join(" | ")}`);
const reduced = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
await reduced.goto("http://127.0.0.1:4317/?launcher=0xE20f0043F32E2E38d3F3d76Ec48Cfcdb0FdC4806", { waitUntil: "domcontentloaded" });
await reduced.waitForSelector(".uniform-rect");
await reduced.waitForTimeout(300);
const running = await reduced.evaluate(() => document.getAnimations().filter((item) => item.playState === "running").length);
assert.equal(running, 0, `减少动态后仍有 ${running} 个动画`);
async function demoGap(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto("http://127.0.0.1:4317/?demo=1", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("button.primary");
  await page.waitForSelector(".demo-bar");
  return page.evaluate(() => {
    const btn = document.querySelector("button.primary").getBoundingClientRect();
    const bar = document.querySelector(".demo-bar").getBoundingClientRect();
    return {
      btnTop: Math.round(btn.top),
      btnBottom: Math.round(btn.bottom),
      barTop: Math.round(bar.top),
      barBottom: Math.round(bar.bottom),
      overlap: btn.bottom > bar.top && btn.top < bar.bottom,
    };
  });
}
const demoDesk = await demoGap(1440, 900);
const demoPhone = await demoGap(390, 844);
assert.equal(demoDesk.overlap, false, `桌面演示条挡住按钮 ${JSON.stringify(demoDesk)}`);
assert.equal(demoPhone.overlap, false, `手机演示条挡住按钮 ${JSON.stringify(demoPhone)}`);
await browser.close();
console.log("布局检查通过", { desk: before, mobile, covered: covered.length, reducedMotion: running, demoDesk, demoPhone });
