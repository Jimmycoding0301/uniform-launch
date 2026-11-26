import fs from "node:fs";

const artifact = JSON.parse(fs.readFileSync("out/UniformLauncher.sol/UniformLauncher.json", "utf8"));
const keep = new Set([
  "statusCode",
  "bidCount",
  "MAX_BIDS",
  "MAX_PRICE",
  "expectedToken",
  "admittedWalletCount",
  "admittedWallet",
  "MIN_SETTLE_GAS",
  "clearingPrice",
  "floorPrice",
  "startBlock",
  "endBlock",
  "poolQuote",
  "token",
  "pool",
  "minPoolQuote",
  "softCap",
  "preview",
  "getBids",
  "identitySourceCount",
  "identitySources",
  "bid",
  "settle",
  "claim",
  "refund",
]);
const abi = artifact.abi.filter((item) => item.type === "error" || (item.type === "function" && keep.has(item.name)));
abi.push({
  type: "function",
  name: "verify",
  stateMutability: "view",
  inputs: [
    { name: "account", type: "address" },
    { name: "agentId", type: "uint256" },
  ],
  outputs: [
    { name: "ok", type: "bool" },
    { name: "sourceId", type: "bytes32" },
  ],
});
const body = `export const launcherAbi = ${JSON.stringify(abi, null, 2)};\n`;
fs.writeFileSync("agent/abi.mjs", body);
console.log(`wrote ${abi.length} abi entries`);
