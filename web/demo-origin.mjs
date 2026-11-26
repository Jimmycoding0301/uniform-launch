import { readFileSync } from "node:fs";

function resolveOrigin() {
  if (process.env.DEMO_WEB_PORT) {
    const port = Number(process.env.DEMO_WEB_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("演示端口无效");
    return `http://127.0.0.1:${port}`;
  }
  try {
    const { webOrigin } = JSON.parse(readFileSync(new URL("./public/demo.json", import.meta.url), "utf8"));
    const url = new URL(webOrigin);
    if (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)) return url.origin;
  } catch {
    // Older generated demo books use the default Vite port.
  }
  return "http://127.0.0.1:4317";
}

export const demoOrigin = resolveOrigin();
