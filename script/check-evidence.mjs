import { readFileSync } from "node:fs";

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function checkDocumentHashes(section, expected) {
  const hashes = [...section.matchAll(/`(0x[0-9a-f]{64})`/g)].map(match => match[1]);
  if (!hashes.length || hashes.some(hash => !expected.includes(hash)) || expected.some(hash => !hashes.includes(hash))) {
    throw new Error("分叉文档与交易记录的哈希不一致");
  }
}

const [historicalSection, budgetSection] = read("../docs/e2e-evidence.md").split("## 4.6 tBNB 单人发射");
const historical = JSON.parse(read("../deployments/bsc-testnet-e2e.json"));
checkDocumentHashes(historicalSection, Object.values(historical.txs).flat());
if (historical.vaultAfter !== historical.withdrawn || historical.withdrawn !== historical.ownerDelta) {
  throw new Error("金库增加和提走的数额不一致");
}

const budget = JSON.parse(read("../deployments/bsc-testnet-budget-fork.json"));
const stages = ["create", "identity", "bid", "settle", "claim"];
const receipts = stages.map(stage => budget.transactions[stage]);
checkDocumentHashes(budgetSection, receipts.map(receipt => receipt.hash));
const gasPaid = receipts.reduce((sum, r) => sum + BigInt(r.gasUsed) * BigInt(r.effectiveGasPrice), 0n);
const total = BigInt(budget.poolQuoteWei) + BigInt(budget.createFeeWei) + gasPaid + BigInt(budget.remainingBalanceWei);
if (budget.network !== "anvil-fork-of-97" || BigInt(budget.gasPaidWei) !== gasPaid
    || total !== BigInt(budget.startingBalanceWei) || total !== 4_600_000_000_000_000_000n) {
  throw new Error("单人分叉回执与 4.6 tBNB 资金记录不一致");
}
console.log("两份分叉回执与文档一致，单人预算和历史金库余额均已核对");
