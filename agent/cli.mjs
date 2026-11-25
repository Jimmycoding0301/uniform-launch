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
else if (command === "bid-tx") result = await bidTx(rpc, launcher, arg("budget"), arg("max-price"), arg("source", "0"), arg("agent-id"), arg("address"));
else if (command === "settle-tx") result = await settleTx(rpc, launcher);
else if (command === "claim-tx") result = await claimTx(rpc, launcher);
else if (command === "refund-tx") result = await refundTx(rpc, launcher);
else {
  console.error("没有这个命令");
  process.exit(1);
}

if (json) console.log(JSON.stringify(result, null, 2));
else console.log(result.ok ? sentence(command, result) : `${result.reason}。${result.next}`);
if (!result.ok) process.exit(2);

function sentence(command, result) {
  if (command === "status") {
    return `${result.phase}。清算价 ${result.clearingPrice} BNB/枚。出价 ${result.bidCount} 笔，还差 ${result.seatsLeft} 笔。剩余 ${result.remainingBlocks} 个区块。保留价 ${result.floorPrice}。身份来源 ${result.sources.length} 个。`;
  }
  if (command === "simulate") {
    const gate = result.meetsMinPool ? "过了最小入池" : "还没到最小入池";
    return `如果现在加上这一笔，清算价 ${result.clearingPrice}，成交 ${result.tokens} 枚，实付 ${result.spend} BNB，退回 ${result.refund} BNB。入池 ${result.poolQuote} BNB，${gate}。`;
  }
  if (command === "identity") {
    const passed = result.results.filter((item) => item.ok).map((item) => item.name);
    return `身份通过。${passed.join("、") || "没有来源"}。`;
  }
  return result.instruction || "完成";
}
