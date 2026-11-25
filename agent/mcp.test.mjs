import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const child = spawn("node", ["mcp.mjs"], { cwd: new URL(".", import.meta.url).pathname });
let buf = "";
child.stdout.on("data", (chunk) => {
  buf += chunk;
});
const send = (value) => child.stdin.write(`${typeof value === "string" ? value : JSON.stringify(value)}\n`);
send("这不是 json");
send({ jsonrpc: "2.0", method: "notifications/initialized" });
send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } } });
send({ jsonrpc: "2.0", id: 4, method: "ping" });
send({ jsonrpc: "2.0", id: 2, method: "nope" });
send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "build_bid_tx", arguments: "nope" } });
send({
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: {
    name: "build_bid_tx",
    arguments: {
      launcher: "0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1",
      budget: "1",
      maxPrice: "0.00003",
      sourceIndex: "abc",
      agentId: "1",
    },
  },
});
await new Promise((resolve) => setTimeout(resolve, 300));
child.kill();
const lines = buf.trim().split("\n").map((line) => JSON.parse(line));
const byId = Object.fromEntries(lines.map((line) => [line.id, line]));
assert.equal(lines.length, 5);
assert.equal(byId[1].result.serverInfo.name, "uniform-agent");
assert.deepEqual(byId[4].result, {});
assert.equal(byId[2].error.code, -32601);
assert.equal(byId[3].result.isError, true);
assert.match(byId[3].result.content[0].text, /来源编号不对/);
assert.equal(byId[5].result.isError, true);
assert.match(byId[5].result.content[0].text, /金额要用十进制/);
console.log("MCP 忽略坏行和通知，未知方法有错误码");
