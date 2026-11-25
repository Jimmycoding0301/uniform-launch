export function settle(
  sellAmount: bigint,
  floor: bigint,
  bids: { index: bigint; budget: bigint; maxPrice: bigint }[],
): {
  ok: boolean;
  clearingPrice: bigint;
  poolQuote: bigint;
  fills: { index: bigint; tokens: bigint; spend: bigint; refund: bigint }[];
};
