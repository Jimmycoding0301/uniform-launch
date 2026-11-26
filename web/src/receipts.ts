import { decodeFunctionData, parseAbi, type Address, type Hash, type Hex, type PublicClient } from "viem";

export type Action = "bid" | "settle" | "claim" | "refund";
export type Intent = {
  launcher: Address;
  action: Action;
  account: string;
  value: string;
  limit: string;
  source: number;
  id: string;
};
export type Tracking = { intent: Intent; afterBlock: string };

const methods = parseAbi([
  "function bid(uint256 maxPrice, uint8 sourceIndex, uint256 agentId) payable",
  "function settle()", "function claim()", "function refund()",
]);
const events = parseAbi([
  "event BidPlaced(address indexed agent,uint256 indexed bidId,bytes32 indexed sourceId,uint256 agentId,uint256 budget,uint256 maxPrice)",
  "event AuctionSettled(uint256 clearingPrice,uint256 poolQuote,address token,address pool)",
  "event AuctionFailed(uint8 reason)",
  "event Claimed(address indexed agent,uint256 tokens,uint256 quoteRefunded)",
  "event Refunded(address indexed agent,uint256 amount)",
]);

export function matchesIntent(tx: { to: Address | null; from: Address; input: Hex; value: bigint }, intent: Intent) {
  if (tx.to?.toLowerCase() !== intent.launcher.toLowerCase() || tx.value.toString() !== intent.value) return false;
  if (intent.account && tx.from.toLowerCase() !== intent.account.toLowerCase()) return false;
  try {
    const call = decodeFunctionData({ abi: methods, data: tx.input });
    if (call.functionName !== intent.action) return false;
    if (call.functionName !== "bid") return true;
    const [limit, source, id] = call.args;
    return limit.toString() === intent.limit && source === intent.source && (!intent.id || id.toString() === intent.id);
  } catch {
    return false;
  }
}

export async function inspectHash(client: PublicClient, hash: Hash, intent: Intent) {
  const [tx, receipt] = await Promise.all([client.getTransaction({ hash }), client.getTransactionReceipt({ hash })]);
  if (!matchesIntent(tx, intent)) return { state: "different" } as const;
  if (receipt.status !== "success") return { state: "reverted" } as const;
  return { state: "matched", hash, block: receipt.blockNumber, account: tx.from, value: tx.value, action: intent.action } as const;
}
export type Receipt = Extract<Awaited<ReturnType<typeof inspectHash>>, { state: "matched" }>;

export async function matchingHashes(client: PublicClient, intent: Intent, fromBlock: bigint, toBlock: bigint) {
  const range = { address: intent.launcher, fromBlock, toBlock };
  const agent = intent.account as Address;
  const logs = intent.action === "settle"
    ? await client.getLogs({ ...range, events: [events[1], events[2]] })
    : await client.getLogs({
        ...range,
        event: intent.action === "bid" ? events[0] : intent.action === "claim" ? events[3] : events[4],
        args: { agent },
      });
  return [...new Set(logs.flatMap(log => log.transactionHash ? [log.transactionHash] : []))];
}
