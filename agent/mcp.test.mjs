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
send({ jsonrpc: "2.0", id: 2, method: "nope" });
await new Promise((resolve) => setTimeout(resolve, 300));
child.kill();
const lines = buf.trim().split("\n").map((line) => JSON.parse(line));
assert.equal(lines.length, 2);
assert.equal(lines[0].id, 1);
assert.equal(lines[0].result.serverInfo.name, "uniform-agent");
assert.equal(lines[1].error.code, -32601);
console.log("MCP 忽略坏行和通知，未知方法有错误码");
