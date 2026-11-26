import { readFileSync } from "node:fs";

const doc = readFileSync(new URL("../docs/e2e-evidence.md", import.meta.url), "utf8");
const json = JSON.parse(readFileSync(new URL("../deployments/bsc-testnet-e2e.json", import.meta.url), "utf8"));
const hashes = [...doc.matchAll(/`(0x[0-9a-f]{64})`/g)].map((match) => match[1]);
const known = new Set(Object.values(json.txs).flat());
const missing = hashes.filter((hash) => !known.has(hash));
if (!hashes.length || missing.length) {
  console.error(missing.join("\n") || "证据里没有哈希");
  process.exit(1);
}
if (json.vaultAfter !== json.withdrawn || json.withdrawn !== json.ownerDelta) {
  console.error("金库增加和提走的数额不一致");
  process.exit(1);
}
console.log(`证据里 ${hashes.length} 个哈希都在记录里，提走 ${json.withdrawn}`);
