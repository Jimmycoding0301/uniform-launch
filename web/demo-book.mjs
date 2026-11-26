import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const hint = "先运行 bash script/demo.sh";
const address = /^0x[0-9a-fA-F]{40}$/;

async function hasCode(rpc, target) {
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getCode", params: [target, "latest"] }),
      signal: AbortSignal.timeout(2000),
    });
    const body = await res.json();
    return typeof body.result === "string" && body.result.length > 2;
  } catch {
    return false;
  }
}

export async function demoBook() {
  let data;
  try {
    const path = join(dirname(fileURLToPath(import.meta.url)), "public/demo.json");
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    console.error(hint);
    process.exit(1);
  }
  const open = data.open;
  const launched = data.launched;
  const failed = data.failed;
  if (!data.rpc || !address.test(open || "") || !address.test(launched || "") || !address.test(failed || "")) {
    console.error(hint);
    process.exit(1);
  }
  const alive = await Promise.all([open, launched, failed].map((item) => hasCode(data.rpc, item)));
  if (alive.some((ok) => !ok)) {
    console.error(hint);
    process.exit(1);
  }
  return { open, launched, failed, rpc: data.rpc };
}
