const WAD = 10n ** 18n;
export const SELL_AMOUNT = 500_000n * WAD;

function before(a, b) {
  if (a.maxPrice !== b.maxPrice) return a.maxPrice > b.maxPrice;
  return a.index < b.index;
}

function sortOrder(bids, order) {
  for (let i = 1; i < order.length; i++) {
    const key = order[i];
    let j = i;
    while (j > 0 && before(bids[key], bids[order[j - 1]])) {
      order[j] = order[j - 1];
      j--;
    }
    order[j] = key;
  }
}

function charge(tokens, price, budget) {
  if (tokens === 0n || price === 0n) return 0n;
  const raw = tokens * price;
  let spend = (raw + WAD - 1n) / WAD;
  if (spend > budget) spend = budget;
  return spend;
}

function pinFeasible(bids, order, price, sellAmount) {
  let infra = 0n;
  let marginal = 0n;
  for (const pos of order) {
    const b = bids[pos];
    if (b.maxPrice > price) infra += (b.budget * WAD) / price;
    else if (b.maxPrice === price) marginal += b.budget;
  }
  if (infra >= sellAmount) return null;
  const remaining = sellAmount - infra;
  const cost = (remaining * price) / WAD;
  if (marginal < cost || marginal === 0n) return null;
  return { infra, marginal, remaining };
}

export function settle(sellAmount, floorPrice, bids) {
  const fills = bids.map((b) => ({
    index: b.index,
    tokens: 0n,
    spend: 0n,
    refund: b.budget,
  }));
  if (bids.length === 0 || floorPrice === 0n) {
    return { ok: false, clearingPrice: 0n, poolQuote: 0n, fills };
  }
  const order = [];
  for (let i = 0; i < bids.length; i++) {
    const b = bids[i];
    if (b.maxPrice >= floorPrice && b.budget > 0n) order.push(i);
  }
  if (order.length === 0) return { ok: false, clearingPrice: 0n, poolQuote: 0n, fills };
  sortOrder(bids, order);

  let kind = 0;
  let winK = 0;
  let pinPrice = 0n;
  let bestP = 0n;
  let cum = 0n;
  for (let k = 1; k <= order.length; k++) {
    cum += bids[order[k - 1]].budget;
    const mMin = bids[order[k - 1]].maxPrice;
    const p = (cum * WAD) / sellAmount;
    if (p >= floorPrice && p <= mMin && p > bestP) {
      bestP = p;
      kind = 1;
      winK = k;
    }
  }
  let lastPrice = null;
  for (const pos of order) {
    const price = bids[pos].maxPrice;
    if (lastPrice === price) continue;
    lastPrice = price;
    const pin = pinFeasible(bids, order, price, sellAmount);
    if (!pin) continue;
    if (price > bestP) {
      bestP = price;
      kind = 2;
      pinPrice = price;
      winK = Number(pin.infra);
    }
  }
  if (kind === 0) return { ok: false, clearingPrice: 0n, poolQuote: 0n, fills };

  if (kind === 1) {
    let budgetSum = 0n;
    for (let i = 0; i < winK; i++) budgetSum += bids[order[i]].budget;
    for (let i = 0; i < winK; i++) {
      const pos = order[i];
      fills[pos].tokens = (bids[pos].budget * sellAmount) / budgetSum;
      fills[pos].spend = bids[pos].budget;
      fills[pos].refund = 0n;
    }
    return { ok: true, clearingPrice: bestP, poolQuote: budgetSum, fills };
  }

  const pin = pinFeasible(bids, order, pinPrice, sellAmount);
  let spent = 0n;
  for (const pos of order) {
    const b = bids[pos];
    let tokens = 0n;
    if (b.maxPrice > pinPrice) tokens = (b.budget * WAD) / pinPrice;
    else if (b.maxPrice === pinPrice) tokens = (pin.remaining * b.budget) / pin.marginal;
    else continue;
    let spend = charge(tokens, pinPrice, b.budget);
    if (spend === b.budget && tokens > (b.budget * WAD) / pinPrice) {
      tokens = (b.budget * WAD) / pinPrice;
      spend = charge(tokens, pinPrice, b.budget);
    }
    fills[pos].tokens = tokens;
    fills[pos].spend = spend;
    fills[pos].refund = b.budget - spend;
    spent += spend;
  }
  return { ok: true, clearingPrice: bestP, poolQuote: spent, fills };
}
