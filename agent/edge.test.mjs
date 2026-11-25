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
const fullOut = settle(SELL_AMOUNT, floor, full);
assert.equal(fullOut.ok, true);
assert.equal(fullOut.fills.filter((fill) => fill.tokens > 0n).length, 32);
conserved(full, fullOut);

const same = [0, 1, 2, 3].map((i) => ({ index: BigInt(i), budget: 5n * W, maxPrice: 10n ** 16n }));
const sameOut = settle(SELL_AMOUNT, floor, same);
assert.equal(sameOut.ok, true);
const token0 = sameOut.fills[0].tokens;
for (const fill of sameOut.fills) assert.equal(fill.tokens, token0);
conserved(same, sameOut);

const one = settle(SELL_AMOUNT, floor, [{ index: 0n, budget: 20n * W, maxPrice: 10n ** 16n }]);
assert.equal(one.ok, true);
assert.equal(one.fills[0].tokens, SELL_AMOUNT);
assert.equal(one.poolQuote, 20n * W);

const launched = settle(SELL_AMOUNT, floor, [{ index: 0n, budget: 40n * W, maxPrice: 10n ** 16n }]);
assert.equal(launched.ok, true);
assert.equal(launched.clearingPrice, 80000000000000n);
assert.equal(launched.poolQuote, 40n * W);

const minPool = 4335714285714285715n;
const exact = settle(SELL_AMOUNT, 1n, [{ index: 0n, budget: minPool, maxPrice: W }]);
const marginal = settle(100n * W, 1n * W, [
  { index: 0n, budget: 40n * W, maxPrice: 4n * W },
  { index: 1n, budget: 100n * W, maxPrice: 1n * W },
]);
assert.equal(marginal.ok, true);
assert.equal(marginal.clearingPrice, W);
assert.equal(marginal.fills[0].tokens, 40n * W);
assert.equal(marginal.fills[0].spend, 40n * W);
assert.equal(marginal.fills[1].tokens, 60n * W);
assert.equal(marginal.fills[1].spend, 60n * W);
assert.equal(marginal.fills[1].refund, 40n * W);
assert.equal(exact.ok, true);
assert.equal(exact.poolQuote, minPool);
assert.equal(exact.fills[0].spend, minPool);
assert.equal(exact.fills[0].refund, 0n);

const prefix = settle(100n * W, 1n * W, [
  { index: 0n, budget: 40n * W, maxPrice: 5n * W },
  { index: 1n, budget: 60n * W, maxPrice: 2n * W },
]);
assert.equal(prefix.ok, true);
assert.equal(prefix.clearingPrice, 1n * W);
assert.equal(prefix.poolQuote, 100n * W);
assert.equal(prefix.fills[0].tokens, 40n * W);
assert.equal(prefix.fills[1].tokens, 60n * W);

const below = settle(100n * W, 2n * W, [{ index: 0n, budget: 100n * W, maxPrice: 3n * W }]);
assert.equal(below.ok, false);
assert.equal(below.fills[0].refund, 100n * W);

const dust = settle(100n * W, W / 100n, [
  { index: 2n, budget: 1n * W, maxPrice: 1n * W },
  { index: 0n, budget: 1n * W, maxPrice: 1n * W },
  { index: 1n, budget: 1n * W, maxPrice: 1n * W },
]);
assert.equal(dust.ok, true);
assert.equal(dust.clearingPrice, (3n * W * W) / (100n * W));
const dustTokens = dust.fills.reduce((sum, fill) => sum + fill.tokens, 0n);
assert.equal(dustTokens, 100n * W - 1n);
assert.equal(dust.poolQuote, 3n * W);

const empty = settle(100n * W, 1n * W, []);
assert.equal(empty.ok, false);

console.log("边界：32 笔、同价、一笔、最小入池、边际、前缀、低于保留价、余数、空场，都通过");
