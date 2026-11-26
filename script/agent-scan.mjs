import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("agent");
const needles = ["eth_send" + "Transaction", "eth_send" + "RawTransaction", "private" + "Key", "mnemo" + "nic", "sign" + "Transaction"];
const hits = [];
for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith(".mjs") && !name.endsWith(".js")) continue;
  const text = fs.readFileSync(path.join(dir, name), "utf8");
  for (const needle of needles) {
    if (text.includes(needle)) hits.push(`${name} ${needle}`);
  }
}
if (hits.length) {
  console.error(hits.join("\n"));
  process.exit(1);
}
console.log("代理源码没有签名或广播");
