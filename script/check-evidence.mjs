import { readFileSync } from "node:fs";

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const publicRecord = JSON.parse(read("../deployments/bsc-testnet-marketing.json"));
const launch = publicRecord.publicAuction;
const publicReceipts = [publicRecord.deploymentTx, launch.createTx, launch.bidTx, launch.settlementTx, launch.claimTx];
const publicEvidence = read("../docs/marketing-testnet-evidence.md");
for (const hash of publicReceipts) {
  if (!/^0x[0-9a-f]{64}$/.test(hash) || !publicEvidence.includes(`https://testnet.bscscan.com/tx/${hash}`)) {
    throw new Error("公开测试网回执缺失或与部署记录不一致");
  }
}
if (publicRecord.chainId !== 97 || publicRecord.taxRoute !== "MARKETING"
    || launch.expectedToken !== launch.token || launch.claimBlock <= launch.settlementBlock) {
  throw new Error("公开发射记录未满足链、税款路径或结算顺序");
}

const historical = JSON.parse(read("../deployments/bsc-testnet-e2e.json"));
if (historical.vaultAfter !== historical.withdrawn || historical.withdrawn !== historical.ownerDelta) {
  throw new Error("金库增加和提走的数额不一致");
}

const budget = JSON.parse(read("../deployments/bsc-testnet-budget-fork.json"));
const stages = ["create", "identity", "bid", "settle", "claim"];
const receipts = stages.map(stage => budget.transactions[stage]);
const gasPaid = receipts.reduce((sum, r) => sum + BigInt(r.gasUsed) * BigInt(r.effectiveGasPrice), 0n);
const total = BigInt(budget.poolQuoteWei) + BigInt(budget.createFeeWei) + gasPaid + BigInt(budget.remainingBalanceWei);
if (budget.network !== "anvil-fork-of-97" || BigInt(budget.gasPaidWei) !== gasPaid
    || total !== BigInt(budget.startingBalanceWei) || total !== 4_600_000_000_000_000_000n) {
  throw new Error("单人分叉回执与 4.6 tBNB 资金记录不一致");
}
const pinned = JSON.parse(read("../deployments/bsc-testnet-e2e-pinned-fork.json"));
const phases = ["create", "bid-1", "bid-2", "bid-3", "settle", "claim", "trade", "withdraw"];
for (const phase of phases) {
  if (!pinned.transactions[phase]?.length || pinned.transactions[phase].length !== pinned.blockNumbers[phase]?.length
      || pinned.transactions[phase].some(hash => !/^0x[0-9a-f]{64}$/.test(hash))) {
    throw new Error("原脚本缺少分叉回执 " + phase);
  }
}
if (pinned.forkHash !== budget.forkHash || BigInt(pinned.poolQuoteWei) !== 40n * 10n ** 18n
    || BigInt(pinned.vaultBeforeWithdrawWei) <= 0n || pinned.vaultAfterWithdrawWei !== "0"
    || pinned.vaultBeforeWithdrawWei !== pinned.ownerGrossReceiptWei) {
  throw new Error("原脚本分叉结算和提取记录不一致");
}
console.log("已核对公开测试网回执及分叉回归记录");
