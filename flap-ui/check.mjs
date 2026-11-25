import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] ?? new URL("./launcher-detail/", import.meta.url).pathname);
const files = ["Component.tsx", "manifest.json", "i18n.json"];
const names = fs.readdirSync(dir);
if (names.length !== 3 || files.some((name) => !names.includes(name))) {
  throw new Error("目录里必须正好是 Component.tsx、manifest.json、i18n.json");
}
let total = 0;
for (const name of files) {
  const size = fs.statSync(path.join(dir, name)).size;
  if (size < 1 || size > 256_000) throw new Error(`${name} 体积 ${size}`);
  total += size;
}
if (total > 512_000) throw new Error(`合计 ${total}`);
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
const keys = ["schemaVersion", "kind", "artifactId", "name", "chainId", "factoryAddress", "surfaces", "entry", "configContract", "reads"];
if (JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify([...keys].sort())) {
  throw new Error("manifest 字段和检查器要求的不一致");
}
if (manifest.schemaVersion !== 2 || manifest.kind !== "launcher-ui" || manifest.entry !== "Component.tsx") throw new Error("manifest 头不对");
if (manifest.configContract !== "launcher-detail/v1") throw new Error("configContract");
if (manifest.chainId !== 97) throw new Error("chainId");
if (!/^0x[0-9a-f]{40}$/.test(manifest.factoryAddress)) throw new Error("factoryAddress 要小写");
if (JSON.stringify(manifest.surfaces) !== JSON.stringify(["launcher-ui"])) throw new Error("surfaces");
const reads = Object.entries(manifest.reads);
if (reads.length > 8) throw new Error("reads 超过 8");
for (const [key, read] of reads) {
  if (!/^[a-z][a-zA-Z0-9]{0,39}$/.test(key)) throw new Error(`读数键 ${key}`);
  if (!["address", "bool", "uint256"].includes(read.returns)) throw new Error(`返回类型 ${key}`);
}
const i18n = JSON.parse(fs.readFileSync(path.join(dir, "i18n.json"), "utf8"));
const en = Object.keys(i18n.en ?? {});
for (const locale of ["en", "zh", "ko"]) {
  const bag = i18n[locale];
  if (!bag || Object.keys(bag).length !== en.length) throw new Error(`${locale} 键不一致`);
  for (const key of en) {
    if (typeof bag[key] !== "string" || bag[key].trim() === "") throw new Error(`${locale}.${key} 为空`);
  }
}
const source = fs.readFileSync(path.join(dir, "Component.tsx"), "utf8");
if (!source.includes("export function Launcher")) throw new Error("没有具名导出 Launcher");
if (/export default/.test(source)) throw new Error("不许默认导出");
for (const banned of ["<style", "window.location", "new URL(", "new Intl.DateTimeFormat("]) {
  if (source.includes(banned)) throw new Error(`禁用写法 ${banned}`);
}
console.log(JSON.stringify({ ok: true, checker: "self", files, bytes: total, reads: reads.length }, null, 2));
