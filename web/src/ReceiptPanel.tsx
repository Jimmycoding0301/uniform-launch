import { useEffect, useMemo, useRef, useState } from "react";
import { createPublicClient, http, type Hash } from "viem";
import { formatBnb } from "./curve";
import { inspectHash, matchingHashes, type Intent, type Receipt, type Tracking } from "./receipts";
import { t } from "./locale";

const labels = {
  bid: ["出价已核对", "Bid verified"],
  settle: ["结算已核对", "Settlement verified"],
  claim: ["领取已核对", "Claim verified"],
  refund: ["退款已核对", "Refund verified"],
} as const;
const notes = {
  hash: ["哈希是 0x 开头的 66 位字符。", "Enter a 66-character hash beginning with 0x."],
  intent: ["请先选择要核对的操作。", "Choose the action to verify first."],
  reverted: ["这笔交易在链上失败了。", "This transaction reverted on-chain."],
  mismatch: ["交易与当前指令的地址、操作或参数不符。", "The transaction does not match the address, action, or parameters."],
  network: ["读不到链，请稍后重试。", "Could not reach the chain. Try again."],
  unavailable: ["暂时查不到已确认的交易，请检查网络和哈希。", "No confirmed transaction found. Check the network and hash."],
} as const;

export function ReceiptPanel({ rpc, local, draft, tracking }: {
  rpc: string; local: boolean; draft: Intent | null; tracking: Tracking | null;
}) {
  const client = useMemo(() => createPublicClient({ transport: http(rpc, { timeout: 8_000, retryCount: 1 }) }), [rpc]);
  const [open, setOpen] = useState(false);
  const [hash, setHash] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [note, setNote] = useState<keyof typeof notes | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  useEffect(() => {
    setReceipt(null);
    setNote(null);
    setBusy(false);
    request.current++;
    if (!tracking) return () => { request.current++; };
    let stopped = false;
    let timer = 0;
    let cursor = BigInt(tracking.afterBlock) + 1n;
    const read = async () => {
      try {
        const head = await client.getBlockNumber({ cacheTime: 0 });
        if (stopped) return;
        if (cursor <= head) {
          const end = cursor + 63n < head ? cursor + 63n : head;
          const hashes = await matchingHashes(client, tracking.intent, cursor, end);
          for (const candidate of hashes) {
            if (stopped) return;
            const result = await inspectHash(client, candidate, tracking.intent);
            if (!stopped && result.state === "matched") {
              setReceipt(result);
              setNote(null);
              return;
            }
          }
          cursor = end + 1n;
        }
      } catch {
        // Retain the cursor so a temporary RPC interruption cannot skip a receipt.
      }
      if (!stopped) timer = window.setTimeout(read, 3000);
    };
    void read();
    return () => { stopped = true; clearTimeout(timer); request.current++; };
  }, [client, tracking]);

  async function check() {
    const intent = tracking?.intent ?? draft;
    const value = hash.trim();
    if (!/^0x[0-9a-f]{64}$/i.test(value)) { setNote("hash"); return; }
    if (!intent) { setNote("intent"); return; }
    const version = ++request.current;
    setBusy(true);
    setNote(null);
    try {
      const result = await inspectHash(client, value as Hash, intent);
      if (request.current !== version) return;
      if (result.state === "matched") setReceipt(result);
      else setNote(result.state === "reverted" ? "reverted" : "mismatch");
    } catch (error) {
      if (request.current === version) {
        const message = String(error);
        setNote(/fetch|HTTP|timeout|network/i.test(message) ? "network" : "unavailable");
      }
    } finally {
      if (request.current === version) setBusy(false);
    }
  }

  return <>
    {tracking && !receipt && <p className="help" role="status">{t("等待代理钱包确认，回执将自动显示。", "Waiting for the agent wallet. The receipt will appear here.")}</p>}
    {receipt && <div className="result-card" role="status">
      <h2>{t(labels[receipt.action][0], labels[receipt.action][1])}</h2>
      <div className="result-row"><span>{t("区块", "Block")}</span><b>{receipt.block.toLocaleString("en-US")}</b></div>
      <div className="result-row"><span>{t("发送地址", "Sender")}</span><b>{receipt.account.slice(0, 6)}…{receipt.account.slice(-4)}</b></div>
      {receipt.action === "bid" && <div className="result-row"><span>{t("出价", "Bid")}</span><b>{formatBnb(receipt.value)} BNB</b></div>}
      {local ? <span className="help">{t("本地分叉回执", "Local fork receipt")}</span> : <a href={`https://testnet.bscscan.com/tx/${receipt.hash}`} target="_blank" rel="noreferrer">BscScan ↗</a>}
    </div>}
    <button type="button" className="hash-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>{t("已发送？贴哈希核对", "Already sent? Verify by hash")}</button>
    {open && <div className="hash">
      <label htmlFor="txhash">{t("交易哈希", "Transaction hash")}</label>
      <div className="window"><input id="txhash" value={hash} spellCheck={false} autoComplete="off" onChange={e => { setHash(e.target.value); setNote(null); }} /></div>
      {note && <p className="help bad" role="status">{t(notes[note][0], notes[note][1])}</p>}
      <button type="button" className="text-btn" disabled={busy} onClick={() => void check()}>{busy ? t("核对中…", "Verifying…") : t("核对", "Verify")}</button>
    </div>}
  </>;
}
