import { createRoot } from "react-dom/client";
import { Launcher } from "./launcher-detail/Component";
import zh from "./launcher-detail/i18n.json";

const messages = zh.zh;
const host = {};
const address = "0xE82642aC5c3B3B4b7D4cDeaf6a251Dc0BB7AcEfd";

const cases = [
  { id: "null", context: { launcherAddress: null, snapshot: null } },
  {
    id: "0",
    context: {
      launcherAddress: address,
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
      launcherAddress: address,
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
      launcherAddress: address,
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
