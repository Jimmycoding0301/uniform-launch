import assert from "node:assert/strict";
import { parseBnb } from "./core.mjs";

const W = 10n ** 18n;
assert.equal(parseBnb("1"), W);
assert.equal(parseBnb("0.01"), W / 100n);
assert.equal(parseBnb("100"), 100n * W);
assert.equal(parseBnb("1.5"), W + W / 2n);
assert.equal(parseBnb("0.00003"), 30000000000000n);
for (const bad of ["", "abc", "1.2.3", "0.0000000000000000001", "-1"]) {
  assert.throws(() => parseBnb(bad), bad);
}
console.log("金额解析通过");
