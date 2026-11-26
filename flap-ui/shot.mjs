import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../web/package.json"));
const esbuild = require("esbuild");
const { chromium } = require(path.join(here, "../web/node_modules/playwright"));

const bundled = path.join("/tmp", "flap-preview.js");
await esbuild.build({
  entryPoints: [path.join(here, "preview.tsx")],
  bundle: true,
  outfile: bundled,
  format: "iife",
  jsx: "automatic",
  nodePaths: [path.join(here, "../web/node_modules")],
  absWorkingDir: here,
});
const script = fs.readFileSync(bundled, "utf8");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.setContent(`<!doctype html><body style="margin:0;background:#111114"><div id="root"></div><script>${script}</script></body>`, { waitUntil: "load" });
await page.waitForSelector("#mock-0");
const out = path.join(here, "../qa/r15");
fs.mkdirSync(out, { recursive: true });
for (const id of ["null", "0", "1", "2"]) {
  await page.locator(`#mock-${id}`).screenshot({ path: path.join(out, `flap-mock-${id}.png`) });
}
await browser.close();
console.log(out);
