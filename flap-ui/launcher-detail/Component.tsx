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
  background: "#0B0B0D",
  color: "#EDEDED",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 4,
  padding: 16,
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px 16px",
  margin: "12px 0 0",
};

const label: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: "16px",
  color: "#8A8A93",
};

const value: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: "20px",
  fontFamily: "ui-monospace, monospace",
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
};

const phaseStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: "20px",
  color: "#F0B90B",
  fontVariantNumeric: "tabular-nums",
};

const note: CSSProperties = {
  margin: "16px 0 0",
  fontSize: 12,
  lineHeight: "16px",
  color: "#8A8A93",
};

const pre: CSSProperties = {
  margin: "8px 0 0",
  padding: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 4,
  color: "#EDEDED",
  background: "transparent",
  fontFamily: "ui-monospace, monospace",
  fontSize: 12,
  lineHeight: "16px",
  whiteSpace: "pre-wrap",
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

function formatBnb(raw: Value): string {
  const wei = asBig(raw);
  if (wei == null) return "";
  const neg = wei < 0n;
  const v = neg ? -wei : wei;
  const whole = v / 1000000000000000000n;
  const frac = (v % 1000000000000000000n).toString().padStart(18, "0").slice(0, 6);
  return `${neg ? "-" : ""}${group(whole.toString())}.${frac}`;
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

function Row({ name, text, gold }: { name: string; text: string; gold?: boolean }) {
  return (
    <>
      <p style={label}>{name}</p>
      <p style={gold ? phaseStyle : value}>{text}</p>
    </>
  );
}

export function Launcher({ context, messages }: LauncherProps) {
  const snap = context.snapshot;
  if (context.launcherAddress == null || snap == null) {
    return (
      <section style={card}>
        <p style={{ ...label, color: "#EDEDED" }}>{messages.empty}</p>
      </section>
    );
  }
  const status = asBig(snap.statusCode);
  const phase = status === 1n ? messages.launched : status === 2n ? messages.failed : messages.open;
  const token = shownAddress(snap.token);
  const pool = shownAddress(snap.pool);
  const template = status === 2n
    ? `${messages.refundTemplate}\n${context.launcherAddress}\n链编号 97\n退款，金额 0`
    : `${messages.bidTemplate}\n${context.launcherAddress}\n链编号 97\n出价。预算和最高价由代理填写。`;
  return (
    <section style={card}>
      <div style={grid}>
        <Row name={messages.phase} text={phase} gold />
        <Row name={messages.bids} text={`${formatInt(snap.bidCount)} / 32`} />
        <Row name={messages.clearing} text={formatBnb(snap.clearingPrice)} />
        <Row name={messages.floor} text={formatBnb(snap.floorPrice)} />
        <Row name={messages.end} text={formatInt(snap.endBlock)} />
        <Row name={messages.poolQuote} text={formatBnb(snap.poolQuote)} />
        <Row name={messages.token} text={token || messages.none} />
        <Row name={messages.pool} text={pool || messages.none} />
      </div>
      <p style={note}>{messages.agent}</p>
      <p style={note}>{messages.agentBody}</p>
      <pre style={pre}>{template}</pre>
    </section>
  );
}
