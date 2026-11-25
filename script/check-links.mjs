import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const text = readFileSync(join(root, "README.md"), "utf8");
const missing = [];
for (const match of text.matchAll(/\(([^)]+)\)/g)) {
  const href = match[1];
  if (href.startsWith("http") || href.startsWith("#")) continue;
  const file = join(root, href.split("#")[0]);
  if (!existsSync(file)) missing.push(href);
}
if (missing.length) {
  console.error(missing.join("\n"));
  process.exit(1);
}
console.log("README 相对链接都在");
