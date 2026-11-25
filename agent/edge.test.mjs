import assert from "node:assert/strict";
import { SELL_AMOUNT, settle } from "../shared/settle.mjs";

const W = 10n ** 18n;
const floor = 10n ** 13n;

function conserved(bids, out) {
  let tokens = 0n;
  let spent = 0n;
  out.fills.forEach((fill, i) => {
    tokens += fill.tokens;
    spent += fill.spend;
    assert.equal(fill.spend + fill.refund, bids[i].budget);
  });
  assert.ok(tokens <= SELL_AMOUNT);
  assert.equal(out.poolQuote, spent);
}

const full = [];
for (let i = 0; i < 32; i++) full.push({ index: BigInt(i), budget: W / 5n, maxPrice: 10n ** 16n });
const fullOut = settle(floor, full);
assert.equal(fullOut.ok, true);
assert.equal(fullOut.fills.filter((fill) => fill.tokens > 0n).length, 32);
conserved(full, fullOut);

const same = [0, 1, 2, 3].map((i) => ({ index: BigInt(i), budget: 5n * W, maxPrice: 10n ** 16n }));
const sameOut = settle(floor, same);
assert.equal(sameOut.ok, true);
const token0 = sameOut.fills[0].tokens;
for (const fill of sameOut.fills) assert.equal(fill.tokens, token0);
conserved(same, sameOut);

const one = settle(floor, [{ index: 0n, budget: 20n * W, maxPrice: 10n ** 16n }]);
assert.equal(one.ok, true);
assert.equal(one.fills[0].tokens, SELL_AMOUNT);
assert.equal(one.poolQuote, 20n * W);

const minPool = 4335714285714285715n;
const exact = settle(1n, [{ index: 0n, budget: minPool, maxPrice: W }]);
assert.equal(exact.ok, true);
assert.equal(exact.poolQuote, minPool);
assert.equal(exact.fills[0].spend, minPool);
assert.equal(exact.fills[0].refund, 0n);

console.log("边界：32 笔、同价、一笔、刚好等于最小入池，都通过");
