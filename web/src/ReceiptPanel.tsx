import { useEffect, useMemo, useRef, useState } from "react";
import { createPublicClient, http, type Hash } from "viem";
import { formatBnb } from "./curve";
import { inspectHash, matchingHashes, type Intent, type Receipt, type Tracking } from "./receipts";

const labels = { bid: "出价", settle: "结算", claim: "领取", refund: "退款" };

export function ReceiptPanel({ rpc, local, draft, tracking }: {
  rpc: string; local: boolean; draft: Intent | null; tracking: Tracking | null;
}) {
  const client = useMemo(() => createPublicClient({ transport: http(rpc, { timeout: 8_000, retryCount: 1 }) }), [rpc]);
  const [open, setOpen] = useState(false);
  const [hash, setHash] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  useEffect(() => {
    setReceipt(null);
    setNote("");
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
              setNote("");
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
    if (!/^0x[0-9a-f]{64}$/i.test(value)) { setNote("哈希是 0x 开头的 66 位字符。"); return; }
    if (!intent) { setNote("请先选择要核对的操作。"); return; }
    const version = ++request.current;
    setBusy(true);
    setNote("");
    try {
      const result = await inspectHash(client, value as Hash, intent);
      if (request.current !== version) return;
      if (result.state === "matched") setReceipt(result);
      else setNote(result.state === "reverted" ? "这笔交易在链上失败了。" : "交易与当前指令的地址、操作或参数不符。");
    } catch (error) {
      if (request.current === version) {
        const message = String(error);
        setNote(/fetch|HTTP|timeout|network/i.test(message) ? "读不到链，请稍后重试。" : "暂时查不到已确认的交易，请检查网络和哈希。");
      }
    } finally {
      if (request.current === version) setBusy(false);
    }
  }

  return <>
    {tracking && !receipt && <p className="help" role="status">等待代理钱包确认，回执将自动显示。</p>}
    {receipt && <div className="result-card" role="status">
      <h2>{labels[receipt.action]}已核对</h2>
      <div className="result-row"><span>区块</span><b>{receipt.block.toLocaleString("en-US")}</b></div>
      <div className="result-row"><span>发送地址</span><b>{receipt.account.slice(0, 6)}…{receipt.account.slice(-4)}</b></div>
      {receipt.action === "bid" && <div className="result-row"><span>出价</span><b>{formatBnb(receipt.value)} BNB</b></div>}
      {local ? <span className="help">本地分叉回执</span> : <a href={`https://testnet.bscscan.com/tx/${receipt.hash}`} target="_blank" rel="noreferrer">BscScan ↗</a>}
    </div>}
    <button type="button" className="hash-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>已发送？贴哈希核对</button>
    {open && <div className="hash">
      <label htmlFor="txhash">交易哈希</label>
      <div className="window"><input id="txhash" value={hash} spellCheck={false} autoComplete="off" onChange={e => { setHash(e.target.value); setNote(""); }} /></div>
      {note && <p className="help bad" role="status">{note}</p>}
      <button type="button" className="text-btn" disabled={busy} onClick={() => void check()}>{busy ? "核对中…" : "核对"}</button>
    </div>}
  </>;
}
