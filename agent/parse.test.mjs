import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bidTx, formatBnb, identity, parseBnb, status } from "./core.mjs";
import { reasons } from "./errors.mjs";

const catalog = JSON.parse(readFileSync(new URL("../web/public/agent.json", import.meta.url), "utf8"));
const catalogReasons = new Set(Object.values(catalog.errors));
for (const item of Object.values(reasons)) {
  assert.equal(catalogReasons.has(item.reason), true, item.reason);
}

const W = 10n ** 18n;
assert.equal(parseBnb("1"), W);
assert.equal(parseBnb("0.01"), W / 100n);
assert.equal(parseBnb("100"), 100n * W);
assert.equal(parseBnb("1.5"), W + W / 2n);
assert.equal(parseBnb("0.00003"), 30000000000000n);
assert.equal(formatBnb(8_900_000_000_000n), "0.0000089");
assert.equal(formatBnb(1n), "0.000000000000000001");
assert.equal(formatBnb(4_335_714_285_714_285_715n), "4.335714285714285715");
for (const bad of ["", "abc", "1.2.3", "0.0000000000000000001", "-1"]) {
  assert.throws(() => parseBnb(bad), bad);
}
const offline = await status("http://127.0.0.1:1", "0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1");
assert.equal(offline.reason, "读不到链");
assert.equal(offline.next, "换一个 RPC 地址后重试");
assert.equal(JSON.stringify(offline).includes("HttpRequestError"), false);
const blankWho = await identity("http://127.0.0.1:1", "0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1", "", "1");
assert.equal(blankWho.reason, "地址不对");
const badWho = await identity("http://127.0.0.1:1", "0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1", "nope", "1");
assert.equal(badWho.reason, "地址不对");
const badAddr = await status("http://127.0.0.1:1", "nope");
assert.equal(badAddr.reason, "地址不对");
const badSource = await bidTx("http://127.0.0.1:1", "0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1", "1", "0.00003", "abc", "1");
assert.equal(badSource.reason, "来源编号不对");
const hugeSource = await bidTx("http://127.0.0.1:1", "0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1", "1", "0.00003", "256", "1");
assert.equal(hugeSource.reason, "来源编号不对");
console.log("金额解析通过");
