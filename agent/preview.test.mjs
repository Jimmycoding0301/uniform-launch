import { readFileSync } from "node:fs";
import { createPublicClient, getAddress, http } from "viem";
import { launcherAbi } from "./abi.mjs";
import { settle } from "../shared/settle.mjs";

const demo = JSON.parse(readFileSync(new URL("../web/public/demo.json", import.meta.url), "utf8"));
const rpc = demo.rpc || "http://127.0.0.1:18545";
const address = getAddress(demo.open);
let floor;
let preview;
let book;
try {
  const client = createPublicClient({ transport: http(rpc, { timeout: 4000 }), batch: { multicall: false } });
  floor = await client.readContract({ address, abi: launcherAbi, functionName: "floorPrice" });
  preview = await client.readContract({ address, abi: launcherAbi, functionName: "preview" });
  book = await client.readContract({ address, abi: launcherAbi, functionName: "getBids" });
} catch (error) {
  console.log("跳过：本机分叉上没有这场演示", error.shortMessage || error.message);
  process.exit(0);
}

const bids = book[1].map((budget, index) => ({ index: BigInt(index), budget, maxPrice: book[2][index] }));
const out = settle(floor, bids);
if (preview[0] !== out.ok || preview[1] !== out.clearingPrice || preview[2] !== out.poolQuote) {
  console.error("模拟器和链上 preview 不一致", preview, out.clearingPrice.toString(), out.poolQuote.toString());
  process.exit(1);
}
console.log("演示场 preview 和模拟器一致", out.clearingPrice.toString(), out.poolQuote.toString());
