import assert from "node:assert/strict";
import { bidTx, parseBnb, status } from "./core.mjs";

const W = 10n ** 18n;
assert.equal(parseBnb("1"), W);
assert.equal(parseBnb("0.01"), W / 100n);
assert.equal(parseBnb("100"), 100n * W);
assert.equal(parseBnb("1.5"), W + W / 2n);
assert.equal(parseBnb("0.00003"), 30000000000000n);
for (const bad of ["", "abc", "1.2.3", "0.0000000000000000001", "-1"]) {
  assert.throws(() => parseBnb(bad), bad);
}
const offline = await status("http://127.0.0.1:1", "0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1");
assert.equal(offline.reason, "读不到链");
assert.equal(offline.next, "换一个 RPC 地址后重试");
assert.equal(JSON.stringify(offline).includes("HttpRequestError"), false);
const badAddr = await status("http://127.0.0.1:1", "nope");
assert.equal(badAddr.reason, "地址不对");
const badSource = await bidTx("http://127.0.0.1:1", "0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1", "1", "0.00003", "abc", "1");
assert.equal(badSource.reason, "来源编号不对");
const hugeSource = await bidTx("http://127.0.0.1:1", "0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1", "1", "0.00003", "256", "1");
assert.equal(hugeSource.reason, "来源编号不对");
console.log("金额解析通过");
