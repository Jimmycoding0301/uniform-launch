import type { CSSProperties } from "react";

type Value = string | number | null | undefined;

type Snapshot = {
  statusCode?: Value;
  bidCount?: Value;
  clearingPrice?: Value;
  floorPrice?: Value;
  endBlock?: Value;
  poolQuote?: Value;
  token?: string | null;
  pool?: string | null;
};

type LauncherProps = {
  context: {
    launcherAddress: string | null;
    snapshot: Snapshot | null;
  };
  messages: Record<string, string>;
  host: { redirect?: (path: string) => boolean };
};

const card: CSSProperties = {
  boxSizing: "border-box",
  maxWidth: 560,
  width: "100%",
  background: "linear-gradient(225deg, #303236 0 8px, transparent 8.5px), #070808",
  clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)",
  color: "#F2F4F1",
  border: "1px solid #303236",
  padding: "clamp(14px, 4%, 24px)",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
};

const header: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  flexWrap: "wrap",
  gap: "8px 16px",
  marginBottom: 16,
};

const metricRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  alignItems: "baseline",
  columnGap: 8,
  padding: "7px 0",
  borderBottom: "1px solid #303236",
};

const label: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: "18px",
  color: "#ABB0AB",
};

const value: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: "21px",
  fontFamily: "ui-monospace, monospace",
  fontVariantNumeric: "tabular-nums",
  overflowWrap: "anywhere",
  textAlign: "right",
};

const phaseStyle: CSSProperties = {
  margin: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 7,
  color: "#91F85B",
  fontSize: 13,
  fontWeight: 650,
  textAlign: "right",
};

const note: CSSProperties = {
  ...label,
  margin: "4px 0 0",
  lineHeight: "20px",
};

const pre: CSSProperties = {
  margin: "10px 0 0",
  padding: "12px 14px",
  border: "1px solid #303236",
  color: "#E0E4DE",
  background: "#141616",
  fontFamily: "ui-monospace, monospace",
  fontSize: 12,
  lineHeight: "19px",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  textAlign: "left",
};

function asBig(raw: Value): bigint | null {
  if (raw == null || raw === "") return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

function group(text: string): string {
  return text.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatBnb(raw: Value, display: "amount" | "price" = "amount"): string {
  const wei = asBig(raw);
  if (wei == null) return "";
  const neg = wei < 0n;
  const v = neg ? -wei : wei;
  const whole = v / 1000000000000000000n;
  const fraction = (v % 1000000000000000000n).toString().padStart(18, "0");
  const digits = display === "price" ? fraction.replace(/0+$/, "") : fraction.slice(0, 6);
  return `${neg ? "-" : ""}${group(whole.toString())}${digits ? "." + digits : ""}`;
}

function formatInt(raw: Value): string {
  const n = asBig(raw);
  if (n == null) return "";
  return group(n.toString());
}

function shownAddress(raw: string | null | undefined): string {
  if (!raw || /^0x0{40}$/i.test(raw)) return "";
  if (raw.length < 12) return raw;
  return `${raw.slice(0, 6)}…${raw.slice(-4)}`;
}

function Row({ name, text }: { name: string; text: string }) {
  return (
    <div style={metricRow}>
      <dt style={label}>{name}</dt>
      <dd style={value}>{text}</dd>
    </div>
  );
}

export function Launcher({ context, messages }: LauncherProps) {
  const snap = context.snapshot;
  if (context.launcherAddress == null || snap == null) {
    return (
      <section style={card}>
        <p style={label}>{messages.empty}</p>
      </section>
    );
  }
  const status = asBig(snap.statusCode);
  const phase = status === 1n ? messages.launched : status === 2n ? messages.failed : messages.open;
  const token = shownAddress(snap.token);
  const pool = shownAddress(snap.pool);
  const template = status === 2n
    ? `${messages.refundTemplate}\n${context.launcherAddress}\n${messages.chain}\n${messages.refundAction}`
    : status === 1n
      ? `${messages.claimTemplate || messages.bidTemplate}\n${context.launcherAddress}\n${messages.chain}\n${messages.claimAction || messages.bidAction}`
      : `${messages.bidTemplate}\n${context.launcherAddress}\n${messages.chain}\n${messages.bidAction}`;
  const heading = status === 2n ? messages.refund : status === 1n ? messages.claim : messages.agent;
  return (
    <section style={card}>
      <header style={header}>
        <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1.2, letterSpacing: "-0.025em" }}>{messages.title}</h2>
        <p style={phaseStyle} role="status" aria-label={messages.phase}>
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
          {phase}
        </p>
      </header>
      <dl style={{ margin: 0, borderTop: "1px solid #303236" }}>
        <Row name={messages.bids} text={`${formatInt(snap.bidCount)} / 32`} />
        <Row name={messages.clearing} text={formatBnb(snap.clearingPrice, "price")} />
        <Row name={messages.floor} text={formatBnb(snap.floorPrice, "price")} />
        <Row name={messages.end} text={formatInt(snap.endBlock)} />
        <Row name={messages.poolQuote} text={formatBnb(snap.poolQuote)} />
        <Row name={messages.token} text={token || messages.none} />
        <Row name={messages.pool} text={pool || messages.none} />
      </dl>
      <h3 style={{ margin: "18px 0 0", fontSize: 15, lineHeight: "21px" }}>{heading}</h3>
      <p style={note}>{messages.agentBody}</p>
      <pre style={pre}>{template}</pre>
    </section>
  );
}
