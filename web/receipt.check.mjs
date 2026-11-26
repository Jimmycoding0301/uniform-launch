import assert from "node:assert/strict";
import { encodeFunctionData, parseAbi } from "viem";
import { inspectHash, matchingHashes, matchesIntent } from "./src/receipts.ts";

const account = "0x0000000000000000000000000000000000000001";
const launcher = "0x0000000000000000000000000000000000000002";
const hash = `0x${"12".repeat(32)}`;
const intent = { account, launcher, action: "bid", value: "100", limit: "120", source: 1, id: "39" };
const bid = encodeFunctionData({ abi: parseAbi(["function bid(uint256,uint8,uint256)"]), functionName: "bid", args: [120n, 1, 39n] });
const tx = { from: account, to: launcher, value: 100n, input: bid };
assert.ok(matchesIntent(tx, intent));
for (const changes of [{ account: launcher }, { launcher: account }, { value: "101" }, { limit: "119" }, { source: 0 }, { id: "38" }, { action: "claim" }]) {
  assert.equal(matchesIntent(tx, { ...intent, ...changes }), false);
}
assert.ok(matchesIntent(tx, { ...intent, id: "" }));
let status = "success";
const rpc = {
  getTransaction: async () => tx,
  getTransactionReceipt: async () => ({ status, blockNumber: 91n }),
  getLogs: async (query) => {
    assert.equal(query.address, launcher);
    assert.equal(query.fromBlock, 90n);
    assert.equal(query.toBlock, 95n);
    assert.equal(query.event.name, "BidPlaced");
    assert.deepEqual(query.args, { agent: account });
    return [{ transactionHash: hash }, { transactionHash: hash }];
  },
};
assert.deepEqual(await matchingHashes(rpc, intent, 90n, 95n), [hash]);
assert.equal((await inspectHash(rpc, hash, intent)).state, "matched");
status = "reverted";
assert.equal((await inspectHash(rpc, hash, intent)).state, "reverted");
for (const action of ["settle", "claim", "refund"]) {
  const input = encodeFunctionData({ abi: parseAbi([`function ${action}()`]), functionName: action });
  assert.ok(matchesIntent({ ...tx, input, value: 0n }, { ...intent, action, value: "0" }));
}
console.log("回执匹配、事件过滤和失败状态检查通过");
