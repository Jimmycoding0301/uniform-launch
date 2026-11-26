import readline from "node:readline";
import { bidTx, claimTx, identity, refundTx, settleTx, simulate, status } from "./core.mjs";

const tools = [
  { name: "status", description: "读一场拍卖的阶段和读数", schema: { launcher: "string", rpc: "string" } },
  { name: "simulate_bid", description: "模拟加上一笔出价", schema: { launcher: "string", rpc: "string", budget: "string", maxPrice: "string" } },
  { name: "check_identity", description: "检查地址和身份编号", schema: { launcher: "string", rpc: "string", address: "string", agentId: "string" } },
  { name: "build_bid_tx", description: "生成未签名出价交易", schema: { launcher: "string", rpc: "string", budget: "string", maxPrice: "string", sourceIndex: "string", agentId: "string", address: "string" } },
  { name: "build_settle_tx", description: "生成未签名结算交易", schema: { launcher: "string", rpc: "string" } },
  { name: "build_claim_tx", description: "生成未签名领取交易", schema: { launcher: "string", rpc: "string" } },
  { name: "build_refund_tx", description: "生成未签名退款交易", schema: { launcher: "string", rpc: "string" } },
];

function schemaOf(tool) {
  const properties = {};
  const required = [];
  for (const [key, type] of Object.entries(tool.schema)) {
    properties[key] = { type };
    if (key !== "rpc" && key !== "address") required.push(key);
  }
  return { type: "object", properties, required };
}

async function call(name, args) {
  const rpc = args.rpc || process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet-rpc.publicnode.com";
  const launcher = args.launcher;
  if (name === "status") return status(rpc, launcher);
  if (name === "simulate_bid") return simulate(rpc, launcher, args.budget, args.maxPrice);
  if (name === "check_identity") return identity(rpc, launcher, args.address, args.agentId);
  if (name === "build_bid_tx") return bidTx(rpc, launcher, args.budget, args.maxPrice, args.sourceIndex ?? "0", args.agentId, args.address);
  if (name === "build_settle_tx") return settleTx(rpc, launcher);
  if (name === "build_claim_tx") return claimTx(rpc, launcher);
  if (name === "build_refund_tx") return refundTx(rpc, launcher);
  return { ok: false, reason: "没有这个工具", next: "用 tools/list 看名字。" };
}

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function fail(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("close", () => process.exit(0));
rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.id === undefined) return;
  if (msg.method === "ping") {
    reply(msg.id, {});
    return;
  }
  if (msg.method === "initialize") {
    reply(msg.id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "uniform-agent", version: "0.1.0" },
    });
    return;
  }
  if (msg.method === "tools/list") {
    reply(msg.id, { tools: tools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: schemaOf(tool) })) });
    return;
  }
  if (msg.method === "tools/call") {
    const args = msg.params?.arguments;
    const safe = args && typeof args === "object" ? args : {};
    call(msg.params?.name, safe).then((result) => {
      reply(msg.id, { content: [{ type: "text", text: JSON.stringify(result) }], isError: result.ok === false });
    }).catch(() => fail(msg.id, -32000, "没有完成"));
    return;
  }
  fail(msg.id, -32601, "没有这个方法");
});
