import { bidTx, claimTx, identity, refundTx, settleTx, simulate, status } from "./core.mjs";

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

function rpcOf() {
  return arg("rpc") || process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet-rpc.publicnode.com";
}

const command = process.argv[2];
const launcher = arg("launcher");
const json = process.argv.includes("--json");
const rpc = rpcOf();

if (!command || !launcher) {
  console.error("用法：node agent/cli.mjs <status|simulate|identity|bid-tx|settle-tx|claim-tx|refund-tx> --launcher 0x…");
  process.exit(1);
}

let result;
if (command === "status") result = await status(rpc, launcher);
else if (command === "simulate") result = await simulate(rpc, launcher, arg("budget"), arg("max-price"));
else if (command === "identity") result = await identity(rpc, launcher, arg("address"), arg("agent-id"));
else if (command === "bid-tx") result = await bidTx(rpc, launcher, arg("budget"), arg("max-price"), arg("source", "0"), arg("agent-id"));
else if (command === "settle-tx") result = await settleTx(rpc, launcher);
else if (command === "claim-tx") result = await claimTx(rpc, launcher);
else if (command === "refund-tx") result = await refundTx(rpc, launcher);
else {
  console.error("没有这个命令");
  process.exit(1);
}

if (json) console.log(JSON.stringify(result, null, 2));
else if (result.ok) console.log(result.phase || result.instruction || "完成");
else console.log(`${result.reason}。${result.next}`);
if (!result.ok) process.exit(2);
