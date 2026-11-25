import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { decodeFunctionData } from "viem";
import { launcherAbi } from "./abi.mjs";

const launcher = "0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1";
const rpc = "http://127.0.0.1:18545";

function run(args) {
  const result = spawnSync("node", ["cli.mjs", ...args, "--launcher", launcher, "--rpc", rpc], {
    cwd: new URL(".", import.meta.url).pathname,
    encoding: "utf8",
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

const status = run(["status", "--json"]);
if (status.out.includes("ECONNREFUSED") || status.out.includes("fetch failed")) {
  console.log("跳过：本机分叉没开");
  process.exit(0);
}
const parsed = JSON.parse(status.out);
assert.equal(parsed.ok, true);
assert.equal(parsed.phase, "接单");

const human = run(["status"]);
assert.match(human.out, /接单。清算价/);
assert.equal(human.out.includes("maxPrice"), false);

const bid = run(["bid-tx", "--json", "--budget", "1", "--max-price", "0.00003", "--source", "0", "--agent-id", "1"]);
const tx = JSON.parse(bid.out);
assert.equal(tx.ok, true);
assert.match(tx.instruction, /baw/);
assert.match(tx.instruction, /链编号 97/);
assert.equal(tx.gas, "8000000");
const decoded = decodeFunctionData({ abi: launcherAbi, data: tx.data });
assert.equal(decoded.functionName, "bid");
assert.equal(decoded.args[0], 30000000000000n);
assert.equal(decoded.args[1], 0);
assert.equal(decoded.args[2], 1n);
assert.equal(tx.value, "1000000000000000000");

const sim = run(["simulate", "--json", "--budget", "1", "--max-price", "0.00003"]);
const simJson = JSON.parse(sim.out);
assert.equal(simJson.ok, true);
assert.equal(simJson.meetsMinPool, true);

const ident = run(["identity", "--json", "--address", "0x00000000000000000000000000000000c0de0002", "--agent-id", BigInt("0xc0de0002").toString()]);
const identJson = JSON.parse(ident.out);
assert.equal(identJson.ok, true);

const early = run(["settle-tx"]);
assert.match(early.out, /还没到结算/);
const claim = run(["claim-tx"]);
assert.match(claim.out, /现在不能领取/);
const refund = run(["refund-tx"]);
assert.match(refund.out, /现在不能退款/);
console.log("演示场上的命令口径通过");
