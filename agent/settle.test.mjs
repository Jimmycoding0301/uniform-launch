import assert from "node:assert/strict";
import fs from "node:fs";
import { settle } from "../shared/settle.mjs";

const file = new URL("../shared/vectors.json", import.meta.url);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
assert.equal(data.cases.length, 20);
for (const item of data.cases) {
  const out = settle(
    BigInt(item.floor),
    item.bids.map((bid) => ({ index: BigInt(bid.index), budget: BigInt(bid.budget), maxPrice: BigInt(bid.maxPrice) })),
  );
  assert.equal(out.ok, item.ok);
  assert.equal(out.clearingPrice.toString(), item.clearing);
  assert.equal(out.poolQuote.toString(), item.pool);
  item.fills.forEach((fill, i) => {
    assert.equal(out.fills[i].tokens.toString(), fill.tokens);
    assert.equal(out.fills[i].spend.toString(), fill.spend);
    assert.equal(out.fills[i].refund.toString(), fill.refund);
  });
}
console.log("20 组向量和模拟器一致");
