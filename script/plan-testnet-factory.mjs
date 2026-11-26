import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";

const require = createRequire(new URL("../agent/package.json", import.meta.url));
const {
  createPublicClient, encodeDeployData, formatEther, getAddress, getContractAddress,
  http, keccak256, parseAbi, zeroAddress,
} = require("viem");

const { values } = parseArgs({ options: {
  signer: { type: "string" },
  out: { type: "string" },
  rpc: { type: "string", default: "https://bsc-testnet-dataseed.bnbchain.org" },
} });
if (!values.signer || !values.out) {
  throw new Error("Usage: node script/plan-testnet-factory.mjs --signer 0xADDRESS --out unsigned.json");
}

const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src", "lib", "foundry.toml", "remappings.txt"]);
const signer = getAddress(values.signer);
const client = createPublicClient({ transport: http(values.rpc, { retryCount: 1, timeout: 12_000 }) });
if (await client.getChainId() !== 97) throw new Error("Expected BSC Testnet (97)");

const screening = "0x5CfbE713d070e87F67D1bc84312B7eB8Fe4F2B5E";
const checkAbi = parseAbi(["function isScamWord(string,string) view returns (bool,bool)"]);
const [nameScam, symbolScam] = await client.readContract({
  address: screening, abi: checkAbi, functionName: "isScamWord", args: ["Tongjia", "TJ"],
});
if (nameScam || symbolScam) throw new Error("The Flap screening control was blocked");

const block = await client.getBlock();
const [nonce, pendingNonce, balance, gasPrice] = await Promise.all([
  client.getTransactionCount({ address: signer, blockNumber: block.number }),
  client.getTransactionCount({ address: signer, blockTag: "pending" }),
  client.getBalance({ address: signer, blockNumber: block.number }),
  client.getGasPrice(),
]);
if (nonce !== pendingNonce) throw new Error("Wait for the pending transactions and regenerate");
if (gasPrice > 10_000_000_000n) throw new Error("Gas price exceeds the 10 gwei planning ceiling");
const expectedAddress = getContractAddress({ from: signer, nonce: BigInt(nonce) });
if (await client.getCode({ address: expectedAddress, blockNumber: block.number })) {
  throw new Error("Expected factory address is already in use");
}

const artifact = JSON.parse(readFileSync("out/UniformLauncherFactory.sol/UniformLauncherFactory.json", "utf8"));
const data = encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode.object, args: [zeroAddress] });
const estimate = await client.estimateGas({ account: signer, data, value: 0n, gasPrice });
const gas = (estimate * 120n + 99n) / 100n;
if (gas >= 16_777_216n || balance < gas * gasPrice) throw new Error("Insufficient gas headroom or balance");

const summary = {
  revision, observedBlock: String(block.number), observedBlockHash: block.hash,
  contract: "UniformLauncherFactory", constructorArg: zeroAddress, expectedAddress, screening,
  route: "MARKETING", deploymentDataHash: keccak256(data),
  balanceTBNB: formatEther(balance), deploymentFeeCeilingTBNB: formatEther(gas * gasPrice),
  transaction: {
    chainId: 97, from: signer, nonce, to: null, valueWei: "0", gasLimit: String(gas), gasPriceWei: String(gasPrice),
  },
};
writeFileSync(values.out, JSON.stringify({ ...summary, transaction: { ...summary.transaction, data } }, null, 2) + "\n",
  { flag: "wx" });
console.log(JSON.stringify(summary, null, 2));
