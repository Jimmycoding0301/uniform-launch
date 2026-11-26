/** 与 tokens.css 对齐的数值。色值只写在 tokens.css。 */
export const TOKEN = {
  bg: "var(--bg)",
  surface: "var(--surface)",
  text: "var(--text)",
  text2: "var(--text-2)",
  muted: "var(--muted)",
  accent: "var(--accent)",
  accentInk: "var(--accent-ink)",
  accentA12: "var(--accent-a12)",
  accentA24: "var(--accent-a24)",
  accentA40: "var(--accent-a40)",
  rule: "var(--rule)",
  ruleStrong: "var(--rule-strong)",
  edge: "var(--edge)",
} as const;

export const SETTLE_MS = 800;
export const SWEEP_MS = 600;
export const CURVE_MS = 400;
export const ADDR_STAGGER_MS = 150;
export const SETTLE_GAS_LIMIT = 8_000_000;
export const MIN_SETTLE_GAS = 7_000_000;
export const COPY_MS = 1600;

export const RISK_LINE = "截拍前的新增出价可能改变清算价。";
export const USER_LINE = "基于 Agent ID 与 ERC-8004 的 BNB Chain 发行协议，代理限价出价，一次清算定开盘价，税进 Flap Vault。";
