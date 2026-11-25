import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const src = join(root, "src");

function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(css|tsx|ts)$/.test(name)) out.push(path);
  }
  return out;
}

const bare = [];
for (const path of files(src)) {
  if (path.endsWith("tokens.css")) continue;
  const text = readFileSync(path, "utf8");
  if (/#[0-9A-Fa-f]{3,8}\b/.test(text) || /rgba?\(/.test(text)) bare.push(relative(root, path));
}
assert.deepEqual(bare, [], `裸色值：${bare.join(", ")}`);

const deployed = JSON.parse(readFileSync(join(root, "../deployments/bsc-testnet.json"), "utf8"));
const networks = readFileSync(join(src, "networks.ts"), "utf8");
for (const key of ["vaultFactory", "launcherFactory", "agentIdNft", "agentIdSource", "erc8004Registry", "erc8004Source"]) {
  assert.ok(networks.includes(deployed[key]), `${key} 与部署文件不一致`);
}
assert.equal(deployed.chainId, 97);
assert.equal(deployed.agentIdStandIn, true);
assert.equal(deployed.saltLockFeeWei, "5000000000000000");

const tokens = readFileSync(join(src, "tokens.css"), "utf8");
for (const name of ["--bg", "--accent", "--edge", "--text", "--ease", "--fs-12", "--fs-56"]) {
  assert.ok(tokens.includes(name), `缺少令牌 ${name}`);
}
console.log("颜色扫描和部署地址核对通过");
