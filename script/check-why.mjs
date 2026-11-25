import { readFileSync } from "node:fs";

const why = JSON.parse(readFileSync(new URL("../web/public/why.json", import.meta.url), "utf8"));
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const doc = readFileSync(new URL("../docs/why-uniform.md", import.meta.url), "utf8");
const ratio = String(why.sameRaise.ratio);
if (!readme.includes(ratio) || !doc.includes(ratio)) {
  console.error(`对照比值 ${ratio} 没有写进 README 或说明`);
  process.exit(1);
}
if (why.uniformRatio !== 1) {
  console.error("同价单价比不是 1");
  process.exit(1);
}
console.log(`对照比值 ${ratio} 和文档一致，同价单价比 1`);
