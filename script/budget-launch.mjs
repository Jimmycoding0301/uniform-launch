import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const require = createRequire(new URL("../agent/package.json", import.meta.url));
const {
  createPublicClient, decodeEventLog, getAddress, http, parseAbi, parseEther, toHex, zeroAddress,
} = require("viem");
const root = fileURLToPath(new URL("../", import.meta.url));
const deployment = require("../deployments/bsc-testnet.json");
const portal = "0x000042108465206185A077Edc3F3fd2b49060000";
const budget = parseEther("4.6");
const defaultRpc = "https://bsc-testnet-dataseed.bnbchain.org";
const defaultFork = "https://bsc-testnet-rpc.publicnode.com";
const forkBlock = 144915595n;
const forkHash = "0x6fe1d57e3fea840d8d8e9a054c667bfad630c346223cf5fcdd5f7e9967d3f193";
const fixture = "0x00000000000000000000000000000000c0de0001";
const stages = ["create", "identity", "bid", "settle", "claim"];
const created = parseAbi(["event UniformLauncherCreated(address indexed launcher, address indexed creator, bytes32 salt)"]);

function makeClient(url, timeout = 30000) {
  return createPublicClient({ transport: http(url, { retryCount: 0, timeout }) });
}

function read(client, address, signature, args = []) {
  const abi = parseAbi(["function " + signature]);
  return client.readContract({ address, abi, functionName: abi[0].name, args });
}

async function plan(client, rpc, stage, signer, launcher, runNumber, duration, builder = "prepareBudget") {
  if (!stages.includes(stage)) throw new Error("Expected create, identity, bid, settle or claim");
  if (await client.getChainId() !== 97) throw new Error("Expected BSC testnet (97)");
  if (stage !== "create" && stage !== "identity" && !launcher) throw new Error("Supply the Launcher address from the creation receipt");
  const raw = execFileSync("forge", [
    "script", "script/E2ETestnet.s.sol:E2ETestnet", "--json", "--rpc-url", rpc,
    "--sig", `${builder}(string,address,address,uint256,uint64)`, stage, signer, launcher ?? zeroAddress, runNumber, String(duration),
  ], { cwd: root, encoding: "utf8", maxBuffer: 8_000_000, stdio: ["ignore", "pipe", "pipe"] });
  const result = JSON.parse(raw).returns;
  const gasPrice = await client.getGasPrice();
  if (gasPrice > 10_000_000_000n) throw new Error("Gas price exceeds the preset ceiling of 10 gwei");
  const tx = {
    chainId: "0x61", from: signer, to: result.to.value, data: result.data.value,
    value: toHex(BigInt(result.value.value)), gas: toHex(BigInt(result.gasLimit.value)), gasPrice: toHex(gasPrice),
  };
  if (await client.getBalance({ address: signer }) < BigInt(tx.value) + BigInt(tx.gas) * gasPrice) {
    throw new Error("Insufficient signer balance for this step and its maximum fee");
  }
  await client.request({ method: "eth_call", params: [tx, "latest"] });
  return tx;
}

async function availablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function rehearse(upstream, runNumber, duration) {
  const port = await availablePort();
  const local = "http://127.0.0.1:" + port;
  const child = spawn("anvil", [
    "--quiet", "--host", "127.0.0.1", "--port", String(port), "--accounts", "0", "--chain-id", "97",
    "--fork-url", upstream, "--fork-block-number", String(forkBlock),
  ], { stdio: "ignore" });
  let startError;
  child.on("error", error => { startError = error; });
  const client = makeClient(local, 300000);
  const signer = getAddress(fixture);
  const rpc = (method, ...params) => client.request({ method, params });
  try {
    for (let attempt = 0; attempt < 90; attempt++) {
      if (startError) throw startError;
      if (child.exitCode !== null) throw new Error("Local Anvil exited during startup");
      try {
        if ((await rpc("web3_clientVersion")).startsWith("anvil/")) break;
      } catch {}
      await delay(500);
    }
    const block = await client.getBlock();
    if (block.number !== forkBlock || block.hash !== forkHash) throw new Error("Unexpected fork snapshot");
    const factory = await read(client, portal, "launcherFactoryMultiplier(address) view returns (bool,uint16)", [deployment.launcherFactory]);
    const vault = await read(client, portal, "vaultFactoryMultiplier(address) view returns (bool,uint16)", [deployment.vaultFactory]);
    const flags = await read(client, portal, "featureFlags() view returns (uint256)");
    const fee = await read(client, portal, "SALT_LOCK_FEE() view returns (uint256)");
    if (!factory[0] || (flags & 1n)) throw new Error("Factory authorization or Portal creation unavailable");
    await rpc("anvil_setBalance", signer, toHex(budget));
    await rpc("anvil_impersonateAccount", signer);
    const report = { network: "anvil-fork-of-97", forkBlock: Number(block.number), forkHash: block.hash,
      factoryMultiplier: factory, vaultFactoryMultiplier: vault, featureFlags: String(flags),
      createFeeWei: String(fee), signer, startingBalanceWei: String(budget), transactions: {} };
    let launcher;
    for (const stage of stages) {
      console.error("Local rehearsal · " + stage);
      if (stage === "settle") {
        const end = await read(client, launcher, "endBlock() view returns (uint64)");
        const height = await client.getBlockNumber({ cacheTime: 0 });
        // Bound each RPC call for long operator-selected windows on remote-backed forks.
        for (let remaining = end - height; remaining > 0n; remaining -= 200n) {
          await rpc("anvil_mine", toHex(remaining < 200n ? remaining : 200n));
        }
      }
      const tx = await plan(client, local, stage, signer, launcher, runNumber, duration, "prepareLegacyBudget");
      const hash = await rpc("eth_sendTransaction", tx);
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error(stage + " reverted");
      report.transactions[stage] = { hash, gasUsed: String(receipt.gasUsed), effectiveGasPrice: String(receipt.effectiveGasPrice) };
      if (stage === "create") {
        const event = receipt.logs.filter(log => log.address.toLowerCase() === deployment.launcherFactory.toLowerCase())
          .map(log => decodeEventLog({ ...log, abi: created })).find(event => event.eventName === "UniformLauncherCreated");
        if (!event || event.args.creator !== signer) throw new Error("Missing factory creation receipt for signer");
        launcher = event.args.launcher;
      }
    }
    const token = await read(client, launcher, "token() view returns (address)");
    const pool = await read(client, launcher, "pool() view returns (address)");
    const quote = await read(client, launcher, "poolQuote() view returns (uint256)");
    const clearingPrice = await read(client, launcher, "clearingPrice() view returns (uint256)");
    const tokensClaimed = await read(client, token, "balanceOf(address) view returns (uint256)", [signer]);
    const state = await read(client, launcher, "statusCode() view returns (uint8)");
    const [vaultAddress, vaultFactory] = await read(client, portal, "getLaunchVault(address) view returns (address,address)", [token]);
    if (state !== 1 || quote !== parseEther("4.45") || clearingPrice !== 8900000000000n || tokensClaimed !== parseEther("500000")
        || !await client.getCode({ address: pool }) || !await client.getCode({ address: vaultAddress })
        || vaultFactory.toLowerCase() !== deployment.vaultFactory.toLowerCase()) {
      throw new Error("Final settlement, pool, vault or claimant balance did not match the preset");
    }
    const remaining = await client.getBalance({ address: signer });
    const paidGas = Object.values(report.transactions).reduce((sum, tx) => sum + BigInt(tx.gasUsed) * BigInt(tx.effectiveGasPrice), 0n);
    if (remaining !== budget - fee - quote - paidGas) throw new Error("Signer balance does not reconcile to the five receipts");
    return { ...report, launcher, token, pool, vault: vaultAddress, poolQuoteWei: String(quote), clearingPriceWei: String(clearingPrice),
      tokensClaimedWei: String(tokensClaimed), gasPaidWei: String(paidGas), remainingBalanceWei: String(remaining) };
  } finally {
    child.kill();
  }
}

try {
  const { values, positionals: [command, stage] } = parseArgs({ allowPositionals: true, options: {
    rpc: { type: "string" }, signer: { type: "string" }, launcher: { type: "string" },
    run: { type: "string", default: "1" }, duration: { type: "string", default: "200" },
  } });
  if (!/^\d+$/.test(values.run)) throw new Error("Run number must be a nonnegative integer");
  const duration = Number(values.duration);
  if (!/^\d+$/.test(values.duration) || duration < 200 || duration > 20000) {
    throw new Error("Duration must be between 200 and 20000 whole blocks");
  }
  const runNumber = BigInt(values.run).toString();
  let result;
  if (command === "plan") {
    if (!values.signer) throw new Error("Supply the public signer address with --signer");
    const launcher = values.launcher && getAddress(values.launcher);
    const rpc = values.rpc ?? defaultRpc;
    result = await plan(makeClient(rpc), rpc, stage, getAddress(values.signer), launcher, runNumber, duration);
  } else if (command === "rehearse") {
    result = await rehearse(values.rpc ?? defaultFork, runNumber, duration);
  } else {
    throw new Error("Use plan STAGE --signer ADDRESS [--launcher ADDRESS] or rehearse [--rpc PUBLIC_READ_RPC]");
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.stderr?.toString().trim() || error.shortMessage || error.message);
  process.exitCode = 1;
}
