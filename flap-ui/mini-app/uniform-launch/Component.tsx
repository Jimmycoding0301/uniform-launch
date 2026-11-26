"use client";

import { useEffect, useRef, useState } from "react";
import { concatHex, decodeEventLog, encodeAbiParameters, formatEther, getAddress, isAddress,
  keccak256, maxUint256, parseAbiParameters, parseEther, stringToHex, toHex, zeroAddress, type Address, type Hex } from "viem";
import { useFlapSdk, useMiniAppRouter } from "@/src/sdk";
import { FactoryABI, PortalABI, VaultABI } from "./VaultABI";

const PORTAL = "0x000042108465206185A077Edc3F3fd2b49060000" as const;
const CERTIFIED_FACTORY: Address = zeroAddress;
// ERC-1167 creation-code hash for the documented chain-97 tax-token implementation.
const CLONE_INIT_HASH = "0xc7e15deb24b23c120ed65985516639441790ec6e89090f4aa0a87169aa9c2730" as const;
const CONFIG = parseAbiParameters("(string name,string symbol,string meta,bytes32 salt,uint256 floorPrice,uint64 durationBlocks,address[] identitySources,address[] admittedWallets)");
const fieldStyle = "w-full min-w-0 rounded-lg border border-current/20 bg-transparent px-3 py-2 text-base";
const buttonStyle = "rounded-lg border border-current/30 px-4 py-2 font-semibold disabled:opacity-50";
const primaryStyle = "rounded-lg bg-lime-300 px-4 py-2 font-semibold text-black disabled:opacity-50";
type Action = "create" | "bid" | "settle" | "claim" | "refund";
type Sdk = ReturnType<typeof useFlapSdk>;
type Preview = {
  request: Awaited<ReturnType<Sdk["simulateContract"]>>["request"];
  account: Address; action: Action; target: Address; value: bigint; details: [string, string][];
  factory: Address; salt?: Hex; token?: Address;
};
type Summary = { status: number; floor: bigint; end: bigint; block: bigint; sources: { index: number; key: string; address: Address }[] };

function localError(key: string): never { throw new Error("uniform/" + key); }
function positiveEther(value: string, key: string) {
  if (!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(value)) localError(key);
  const amount = parseEther(value);
  if (amount <= 0n || amount > maxUint256) localError(key);
  return amount;
}
function walletList(text: string) {
  const items = text.split(/[\s,]+/).filter(Boolean);
  if (items.length > 128 || items.some(x => !isAddress(x) || x.toLowerCase() === zeroAddress)) localError("invalidWallets");
  const wallets = items.map(x => getAddress(x));
  if (new Set(wallets).size !== wallets.length) localError("invalidWallets");
  return wallets;
}
function createFields(name:string, symbol:string, meta:string, floor:string, duration:string, admitted:string) {
  const n=name.trim(), s=symbol.trim(), cid=meta.trim();
  if (!n || (stringToHex(n).length-2)/2>32 || !s || (stringToHex(s).length-2)/2>8) localError("invalidName");
  if (!cid || !/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,128})$/.test(cid)) localError("invalidMeta");
  const reserve=positiveEther(floor,"invalidFloor");
  if (reserve>10n**36n) localError("invalidFloor");
  if (!/^\d+$/.test(duration) || BigInt(duration)<200n || BigInt(duration)>20000n) localError("invalidDuration");
  return {n,s,cid,reserve,admissions:walletList(admitted)};
}
async function mineSalt(account: Address, name: string, block: bigint, active: () => boolean) {
  const seed = keccak256(encodeAbiParameters(parseAbiParameters("address,string,uint256,uint256"),
    [account, name, block, BigInt(Date.now())]));
  const prefix = concatHex(["0xff", PORTAL]);
  for (let i = 1; i <= 1_000_000; i++) {
    if (i % 512 === 0) {
      await new Promise(r => setTimeout(r, 0));
      if (!active()) localError("cancelled");
    }
    const salt = keccak256(concatHex([seed, toHex(i, {size: 32})]));
    const digest = keccak256(concatHex([prefix, salt, CLONE_INIT_HASH]));
    if (digest.endsWith("7777")) return {salt, token: getAddress("0x" + digest.slice(-40))};
  }
  return localError("mineFailed");
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid min-w-0 gap-1.5 text-sm font-medium">{label}{children}</label>;
}
function same(a?: string, b?: string) { return !!a && !!b && a.toLowerCase() === b.toLowerCase(); }

export default function Component() {
  const sdk = useFlapSdk({ chainId: 97 });
  const router = useMiniAppRouter();
  const [input, setInput] = useState("");
  const t = sdk.i18n.t;
  const root = sdk.context.manifest.walletContracts?.find(entry => entry.chainId === 97 && entry.id === "uniform-factory" && !!entry.codeHash);
  const factory = root && same(root.address, CERTIFIED_FACTORY) ? CERTIFIED_FACTORY : undefined;
  const [page, raw, extra] = router.segments;
  const create = page === "create" && !raw;
  const detail = page === "launcher" && raw && isAddress(raw) && !extra ? getAddress(raw) : undefined;
  const validInput = isAddress(input.trim()) && input.trim().toLowerCase() !== zeroAddress;
  return <main className="mx-auto grid min-h-screen w-full max-w-2xl gap-5 p-4 sm:p-7">
    <header className="grid gap-2"><div className="text-sm font-medium opacity-75">{t("network")}</div>
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-sm leading-relaxed opacity-80">{t("intro")}</p></header>
    {!page ? <div className="grid gap-5">
      <button className={primaryStyle} onClick={() => router.push("/create")}>{t("create")}</button>
      <Field label={t("launcher")}><input className={fieldStyle} value={input} onChange={e => setInput(e.target.value)} /></Field>
      <button className={buttonStyle} disabled={!validInput} onClick={() => router.push("/launcher/" + getAddress(input.trim()))}>{t("view")}</button>
    </div> : <><button className="justify-self-start text-sm underline" onClick={() => router.push("/")}>{t("home")}</button>
      {create || detail ? <Order key={[router.pathname, sdk.wallet.address, sdk.wallet.chainId, factory].join(":")} sdk={sdk}
        factory={factory} target={detail} open={address => router.push("/launcher/" + address)} /> : <p role="alert">{t("badRoute")}</p>}</>}
  </main>;
}

function Order({ sdk, factory, target, open }: { sdk: Sdk; factory?: Address; target?: Address; open: (address: Address) => void }) {
  const {wallet} = sdk; const t = sdk.i18n.t;
  const [name, setName] = useState(""), [symbol, setSymbol] = useState(""), [meta, setMeta] = useState("");
  const [floor, setFloor] = useState("0.00001"), [duration, setDuration] = useState("1200"), [admitted, setAdmitted] = useState("");
  const [budget, setBudget] = useState(""), [limit, setLimit] = useState(""), [sourceIndex, setSource] = useState("0"), [id, setId] = useState("");
  const [summary, setSummary] = useState<Summary>(), [reload, setReload] = useState(0);
  const [preview, setPreview] = useState<Preview>(), [receiptHash, setHash] = useState<Hex>();
  const [draft, setDraft] = useState(false);
  const [finished, setFinished] = useState(false), [created, setCreated] = useState<Address>();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false), mounted = useRef(false), receiptLock = useRef<Hex | undefined>(undefined);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function failure(err: unknown) {
    const text = err instanceof Error ? err.message : "";
    setError(text.startsWith("uniform/") ? t(text.slice(8)) : t("hostError") + (text ? " · " + text.slice(0, 220) : ""));
  }
  useEffect(() => {
    if (!factory || !target) return;
    let cancelled = false;
    async function read() {
      try {
        const handle = await sdk.resolveContract("uniform-auction", [target]);
        if (!same(handle.address, target)) localError("badTarget");
        const [status, reserve, end, block, count, agent, erc] = await Promise.all([
          sdk.readContract<number>({ contract: handle, abi: VaultABI, functionName: "statusCode" }),
          sdk.readContract<bigint>({ contract: handle, abi: VaultABI, functionName: "floorPrice" }),
          sdk.readContract<bigint>({ contract: handle, abi: VaultABI, functionName: "endBlock" }), sdk.getBlockNumber(),
          sdk.readContract<bigint>({contract:handle, abi:VaultABI, functionName:"identitySourceCount"}),
          sdk.readContract<Address>({address:CERTIFIED_FACTORY, abi:FactoryABI, functionName:"agentIdSource"}),
          sdk.readContract<Address>({address:CERTIFIED_FACTORY, abi:FactoryABI, functionName:"erc8004Source"})
        ]);
        if (count < 1n || count > 4n) localError("badSources");
        const sources = await Promise.all(Array.from({length:Number(count)}, async (_,index) => {
          const address = await sdk.readContract<Address>({contract:handle, abi:VaultABI,functionName:"identitySources",args:[BigInt(index)]});
          if (!same(address,agent) && !same(address,erc)) localError("badSources");
          return {index,address,key:same(address,agent)?"binance":"erc"};
        }));
        if (!cancelled) setSummary({status: Number(status), floor: reserve, end, block, sources});
      } catch (err) { if (!cancelled) { setSummary(undefined); failure(err); } }
    }
    void read();
    const refresh = setInterval(() => void read(), 12_000);
    return () => { cancelled = true; clearInterval(refresh); };
  }, [sdk, factory, target, reload]);

  async function run(body: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await body(); } catch (err) { if (mounted.current) failure(err); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  function checkWallet() {
    if (!factory) return localError("unbound");
    if (!wallet.isConnected || !wallet.address || wallet.isWrongNetwork || wallet.chainId !== 97) return localError("walletRequired");
    return wallet.address;
  }
  async function prepare(action: Action) {
    if (receiptLock.current) return;
    const account = checkWallet(); if (!factory) return;
    let prepared: Preview;
    if (action === "create") {
      const {n,s,cid,reserve,admissions}=createFields(name,symbol,meta,floor,duration,admitted);
      const [agent, erc, fee, block] = await Promise.all([
        sdk.readContract<Address>({address:CERTIFIED_FACTORY, abi: FactoryABI, functionName:"agentIdSource"}),
        sdk.readContract<Address>({address:CERTIFIED_FACTORY, abi: FactoryABI, functionName:"erc8004Source"}),
        sdk.readContract<bigint>({address:PORTAL, abi:PortalABI, functionName:"SALT_LOCK_FEE"}), sdk.getBlockNumber()
      ]);
      if (!isAddress(agent) || !isAddress(erc) || same(agent,erc) || same(agent,zeroAddress) || same(erc,zeroAddress)) localError("badSources");
      const {salt, token} = await mineSalt(account,n,block,() => mounted.current);
      const config = encodeAbiParameters(CONFIG,[{name:n,symbol:s,meta:cid,salt,floorPrice:reserve,durationBlocks:BigInt(duration),identitySources:[agent,erc],admittedWallets:admissions}]);
      const { request } = await sdk.simulateContract({address:PORTAL,abi:PortalABI,functionName:"newLauncher",args:[factory,config],value:fee,account});
      prepared={request,account,action,target:PORTAL,value:fee,factory,salt,token, details:[
        ["asset",n+" · "+s],["meta",cid],["factory",factory],["reserve",formatEther(reserve)],["duration",duration],
        ["binance",agent],["erc",erc],["admitted",admissions.length?admissions.join(", "):t("allIdentities")],["salt",salt],["predicted",token]]};
    } else {
      if (!target) return localError("badTarget");
      const handle = await sdk.resolveContract("uniform-auction",[target]);
      if (!same(handle.address,target)) localError("badTarget");
      const details: [string,string][] = [];
      let value = 0n; let args: unknown[] = [];
      if (action === "bid") {
        value = positiveEther(budget,"invalidBudget"); if (value < parseEther("0.01") || value > parseEther("100")) localError("invalidBudget");
        const price = positiveEther(limit,"invalidLimit");
        if (!/^(0|[1-9]\d*)$/.test(id) || BigInt(id)>maxUint256) localError("invalidIdentity");
        const selected = summary?.sources.find(s=>s.index===Number(sourceIndex));
        if (!selected) localError("invalidIdentity");
        const actual = await sdk.readContract<Address>({contract:handle,abi:VaultABI,functionName:"identitySources",args:[BigInt(selected.index)]});
        if (!same(actual,selected.address)) localError("badSources");
        const reserve = await sdk.readContract<bigint>({ contract:handle, abi:VaultABI,functionName:"floorPrice" }); if (price<reserve || price>10n**36n) localError("invalidLimit");
        args=[price,Number(sourceIndex),BigInt(id)];
        details.push(["limit",formatEther(price)],["source",t(selected.key)+" · "+actual],["agentId",id]);
      }
      const gas = action==="settle" ? 15_000_000n : undefined;
      if (gas) details.push(["gas",gas.toString()]);
      const {request}=await sdk.simulateContract({contract:handle,abi:VaultABI,functionName:action,args,account,...(value?{value}:{}),...(gas?{gas}:{})});
      prepared={request,account,action,target,value,factory,details};
    }
    if (!same(checkWallet(),account)) localError("walletRequired");
    if (mounted.current) setPreview(prepared);
  }
  async function reconcile(hash: Hex, snapshot?: Preview) {
    const receipt = await sdk.waitForTx(hash);
    if (!mounted.current) return;
    if (receipt.status !== "success") {
      receiptLock.current = undefined; setHash(undefined); setPreview(undefined); localError("reverted");
    }
    setFinished(true); setPreview(undefined); setReload(x=>x+1);
    if (snapshot?.action === "create") {
      for (const log of receipt.logs) {
        if (!same(log.address,snapshot.factory)) continue;
        try {
          const decoded = decodeEventLog({abi:FactoryABI, eventName:"UniformLauncherCreated",data:log.data,topics:log.topics});
          if (same(decoded.args.creator,snapshot.account) && decoded.args.salt===snapshot.salt) {
            setCreated(decoded.args.launcher); break;
          }
        } catch { continue; }
      }
    }
  }
  async function submit() {
    if (!preview || receiptLock.current) return;
    const account=checkWallet(); if (!same(account,preview.account)) localError("walletRequired");
    const {request}=await sdk.simulateContract(preview.request);
    if (!mounted.current || !same(checkWallet(),account)) return;
    const hash=await sdk.writeContract(request);
    receiptLock.current=hash;
    if (mounted.current) { setHash(hash); await reconcile(hash,preview); }
  }
  const locked=busy || draft || !!preview || !!receiptHash;
  const canSign=!!factory && wallet.isConnected && !wallet.isWrongNetwork && !busy && !receiptHash;
  const closed=summary && summary.block>=summary.end, accepts=summary && summary.status===0 && summary.block+20n<summary.end;
  return <section className="grid min-w-0 gap-4">
    <h2 className="text-xl font-semibold">{t(target?"auction":"create")}</h2>
    {!factory && <p role="status" className="rounded-lg border p-3 text-sm">{t("unbound")}</p>}
    {target && <p className="break-all font-mono text-xs">{target}</p>}
    {summary && <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm"><p>{t("state")}<br/><b>{t(summary.status===0?"open":summary.status===1?"launched":"failed")}</b></p><p>{t("reserve")}<br/><b>{formatEther(summary.floor)}</b></p><p>{t("block")}<br/><b>{summary.block.toString()}</b></p><p>{t("end")}<br/><b>{summary.end.toString()}</b></p></div>}
    {!target ? <fieldset disabled={locked} className="grid gap-3">
      <div className="grid grid-cols-2 gap-3"><Field label={t("name")}><input className={fieldStyle} value={name} onChange={e=>setName(e.target.value)}/></Field>
      <Field label={t("symbol")}><input className={fieldStyle} value={symbol} onChange={e=>setSymbol(e.target.value)}/></Field></div>
      <Field label={t("meta")}><input className={fieldStyle} value={meta} onChange={e=>setMeta(e.target.value)}/></Field>
      <Field label={t("reserve")}><input className={fieldStyle} inputMode="decimal" value={floor} onChange={e=>setFloor(e.target.value)}/></Field>
      <Field label={t("duration")}><input className={fieldStyle} inputMode="numeric" value={duration} onChange={e=>setDuration(e.target.value)}/></Field>
      <small>{t("durationHint")}</small>
      <Field label={t("admitted")}><textarea className={fieldStyle} value={admitted} onChange={e=>setAdmitted(e.target.value)}/></Field>
      <small>{t("admissionHint")}</small>
    </fieldset> : summary?.status===0 && !closed ? <fieldset disabled={locked} className="grid gap-3">
      <div className="grid grid-cols-2 gap-3"><Field label={t("budget")}><input className={fieldStyle} inputMode="decimal" value={budget} onChange={e=>setBudget(e.target.value)} /></Field>
      <Field label={t("limit")}><input className={fieldStyle} inputMode="decimal" value={limit} onChange={e=>setLimit(e.target.value)} /></Field></div>
      <Field label={t("source")}><select className={fieldStyle} value={sourceIndex} onChange={e=>setSource(e.target.value)}>{summary.sources.map(s=><option key={s.index} value={String(s.index)}>{t(s.key)}</option>)}</select></Field>
      <Field label={t("agentId")}><input className={fieldStyle} inputMode="numeric" value={id} onChange={e=>setId(e.target.value)}/></Field>
      <p className="text-sm">{t("bidRisk")}</p>
    </fieldset> : null}
    {!wallet.isConnected && factory && <p>{t("walletRequired")}</p>}
    {wallet.isWrongNetwork && <button className={buttonStyle} disabled={busy} onClick={()=>void run(()=>wallet.switchChain())}>{t("switch")}</button>}
    {!factory && !target && !draft && <button className={buttonStyle} onClick={()=>void run(async()=>{
      createFields(name,symbol,meta,floor,duration,admitted);setDraft(true);
    })}>{t("reviewDraft")}</button>}
    {draft && <div className="grid gap-2 rounded-lg border p-4"><h3 className="font-semibold">{t("draft")}</h3>
      <p className="break-all">{name.trim()} · {symbol.trim()}</p><p>{t("reserve")} · {floor}</p>
      <p>{t("duration")} · {duration}</p><p className="break-all">{t("meta")} · {meta.trim()}</p>
      <p className="break-all">{t("admitted")} · {admitted.trim() || t("allIdentities")}</p>
      <button className={buttonStyle} onClick={()=>setDraft(false)}>{t("edit")}</button></div>}
    {!preview && !receiptHash && <div className="flex flex-wrap gap-2">
      {!target && <button className={primaryStyle} disabled={!canSign} onClick={()=>void run(()=>prepare("create"))}>{t("previewCreate")}</button>}
      {target && summary?.status===0 && !closed && <button className={primaryStyle} disabled={!canSign || !accepts} onClick={()=>void run(()=>prepare("bid"))}>{t(accepts?"previewBid":"cutoff")}</button>}
      {target && summary?.status===0 && closed && <button className={primaryStyle} disabled={!canSign} onClick={()=>void run(()=>prepare("settle"))}>{t("previewSettle")}</button>}
      {target && summary?.status===1 && <button className={primaryStyle} disabled={!canSign} onClick={()=>void run(()=>prepare("claim"))}>{t("previewClaim")}</button>}
      {target && summary?.status===2 && <button className={primaryStyle} disabled={!canSign} onClick={()=>void run(()=>prepare("refund"))}>{t("previewRefund")}</button>}
    </div>}
    {preview && !receiptHash && <div className="grid gap-3 rounded-lg border p-4">
      <h3 className="font-semibold">{t("preview")} · {t(preview.action)}</h3>
      <dl className="grid gap-2 text-sm">{[["method",preview.request.functionName],["wallet",preview.account],["target",preview.target],["value",formatEther(preview.value)],...preview.details].map(([label,value])=>
        <div className="grid gap-1" key={label}><dt className="opacity-70">{t(label)}</dt><dd className="break-all font-mono">{value}</dd></div>)}</dl>
      <p className="text-sm">{t("signHint")}</p><div className="flex flex-wrap gap-2">
      <button className={primaryStyle} disabled={!canSign} onClick={()=>void run(submit)}>{t("confirm")}</button>
      <button className={buttonStyle} disabled={busy} onClick={()=>setPreview(undefined)}>{t("edit")}</button></div>
    </div>}
    {busy && <p aria-live="polite">{t(receiptHash?"awaitReceipt":"working")}</p>}
    {error && <p role="alert" className="break-words text-sm">{error}</p>}
    {receiptHash && <div className="grid min-w-0 gap-2 rounded-lg border p-3"><b>{t(finished?"done":"awaitReceipt")}</b>
      <button className="break-all text-left font-mono text-xs underline" onClick={()=>sdk.openExplorerTx(receiptHash)}>{receiptHash}</button>
      {!finished && !busy && <button className={buttonStyle} onClick={()=>void run(()=>reconcile(receiptHash,preview))}>{t("recheck")}</button>}
      {created && <button className={primaryStyle} onClick={()=>open(created)}>{t("view")}</button>}
      {finished && !created && <button className={buttonStyle} onClick={()=>{receiptLock.current=undefined;setHash(undefined);setFinished(false);setError("");}}>{t("back")}</button>}
    </div>}
  </section>;
}
