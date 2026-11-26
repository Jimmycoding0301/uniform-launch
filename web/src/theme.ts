import { t } from "./locale";
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
export const COPY_MS = 1600;

export const RISK_LINE = t("中标最多花掉整笔预算。出价锁到结算，期间不可撤单。", "Winning bids may spend the full budget. Funds stay locked until settlement.");
export const USER_LINE = t("基于 Agent ID 与 ERC-8004 的 BNB Chain 发行协议，代理限价出价，一次清算定开盘价，税进 Flap Vault。", "A BNB Chain auction for Agent ID and ERC-8004 identities. Limit bids set one launch price. Trading tax goes to the Flap vault.");
