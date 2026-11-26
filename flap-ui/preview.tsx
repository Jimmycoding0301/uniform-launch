import { createRoot } from "react-dom/client";
import { Launcher } from "./launcher-detail/Component";
import zh from "./launcher-detail/i18n.json";

const messages = zh.zh;
const host = {};
const open = "0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1";
const launched = "0xE20f0043F32E2E38d3F3d76Ec48Cfcdb0FdC4806";
const failed = "0x6f10Eb8eD5c3B033a9EAB172544A4a86420eb128";

const cases = [
  { id: "null", context: { launcherAddress: null, snapshot: null } },
  {
    id: "0",
    context: {
      launcherAddress: open,
      snapshot: {
        statusCode: "0",
        bidCount: "9",
        clearingPrice: "20000000000000",
        floorPrice: "10000000000000",
        endBlock: "144819030",
        poolQuote: "0",
        token: "0x0000000000000000000000000000000000000000",
        pool: "0x0000000000000000000000000000000000000000",
      },
    },
  },
  {
    id: "1",
    context: {
      launcherAddress: launched,
      snapshot: {
        statusCode: "1",
        bidCount: "8",
        clearingPrice: "80000000000000",
        floorPrice: "10000000000000",
        endBlock: "144796000",
        poolQuote: "40000000000000000000",
        token: "0x7a99F06D004c4b42443347bE46CfB42d35E37777",
        pool: "0x2f8E29e38Cc0a14351031915011b19f4E8E08171",
      },
    },
  },
  {
    id: "2",
    context: {
      launcherAddress: failed,
      snapshot: {
        statusCode: "2",
        bidCount: "6",
        clearingPrice: "0",
        floorPrice: "100000000000000",
        endBlock: "144790000",
        poolQuote: "0",
        token: "0x0000000000000000000000000000000000000000",
        pool: "0x0000000000000000000000000000000000000000",
      },
    },
  },
];

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <main style={{ minHeight: "100vh", background: "#111114", padding: 24, display: "grid", gap: 24 }}>
      {cases.map((item) => (
        <section key={item.id} id={`mock-${item.id}`}>
          <Launcher context={item.context} messages={messages} host={host} />
        </section>
      ))}
    </main>,
  );
}
