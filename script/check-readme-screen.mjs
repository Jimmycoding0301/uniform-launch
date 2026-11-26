import { readFileSync } from "node:fs";

const lines = readFileSync(new URL("../README.md", import.meta.url), "utf8").split("\n");
const header = lines.findIndex((line) => line.startsWith("| 要求"));
const problem = lines.findIndex((line) => line.startsWith("## 问题"));
if (!lines[0].includes("同价发射")) {
  console.error("第一行不是一句话标题");
  process.exit(1);
}
if (problem < 0 || problem > 8) {
  console.error("问题一节不在第一屏");
  process.exit(1);
}
if (header < 0 || header > 18) {
  console.error(`评审表头在第 ${header + 1} 行，超出第一屏`);
  process.exit(1);
}
console.log(`评审表头在第 ${header + 1} 行`);
