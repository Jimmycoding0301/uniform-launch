# HackQuest submission · BNB Bangkok

## Project fields

| Field | Text to paste |
| --- | --- |
| Project name | Uniform Launch · One-Price Auctions |
| English one-liner | One bid per identity. One price for every winner. A BNB Chain auction that launches through Flap or lets everyone reclaim their bid. |
| 中文一句话 | 一个身份出价一次，所有成交者支付同一价格。达到门槛就通过 Flap 建池，未达门槛则全额退款。 |
| Tracks | Developer Track — Build on BNB Chain · Flap Track — Build on Pool Launch |
| Repository | [Complete submission branch](https://github.com/Jimmycoding0301/uniform-launch/tree/codex/bangkok-submission) |

## English description

Suppose a founder bids just before you. The fixed-price example posts 0.00002 BNB per token in advance. Both 2.5 BNB orders have enough allocation and receive 125,000 tokens. The simulated bonding curve gives the earlier founder wallet about 181,000 and the next wallet about 153,000. The auction independently clears at 0.00002 from the bids and fills both for 125,000. Among these three launch methods, it combines a price set by demand with one unit price for every fill. The wallet roles are hypothetical. [Local order book and curve parameters](../web/public/why.json)

Each wallet and each identifier from a configured identity source can bid once. When the window closes, all winning bids pay one clearing price. If the auction falls short of its launch conditions, every bidder can reclaim their full budget.

We built a Solidity Launcher Factory, a launch interface using Flap’s template, and a CLI and MCP server that let an AI agent compare bids against the order book and prepare an unsigned transaction. For a 1 BNB budget, the local tool reported 50,000 tokens at a limit of 0.00003 and a full budget refund at 0.000015. The buyer chooses the limit and approves the transaction. [Recorded MCP previews](../qa/submission/agent-preview.json) We support Binance Agent ID and ERC-8004 identity sources. Our public testnet auction used a stand-in for Binance Agent ID.

On BSC Testnet one bid cleared at 0.0000089 tBNB per token. Flap opened a PancakeSwap V2 pool with 500,000 UNIFORM and 4.45 tBNB. The bidder claimed the other 500,000 UNIFORM. Flap also registered our Vault. On a local fork, swap taxes reached that Vault and its owner withdrew the same amount. The interactive demo uses a separate nine-bid order book so judges can try a winning and a losing limit.

## 中文备用简介

假设项目方比你早一笔出价，两人各出 2.5 BNB。固定预售由项目方预设每枚 0.00002 BNB，额度充足，两人各拿 12.5 万枚。用同一组本地出价模拟曲线，先到者约拿 18.1 万枚，后到者约拿 15.3 万枚。同价拍卖由出价形成 0.00002 的清算价，两人各拿 12.5 万枚。在这三种方式中，它同时满足按需求定价、所有成交者同价。角色为假设。[对照规则](why-uniform.md)

每个钱包和所选身份源中的每个身份各限一次。窗口关闭后，所有成交者支付同一个清算价。整场未达到发射条件，每位出价者都可领回全部预算。

我们实现了 Solidity 发射工厂、基于 Flap 模板的发射界面，以及供 AI 代理读取出价簿、比较预估成交量和退款、生成未签名交易的 CLI 和 MCP 服务。买家选择限价并确认交易，合约在截止后统一结算。[本地 MCP 返回值](../qa/submission/agent-preview.json)协议支持 Binance Agent ID 与 ERC-8004 身份源，本次公共测试网发射采用 Agent ID 替身。

BSC 公共测试网上，一笔出价以每枚 0.0000089 tBNB 成交。Flap 创建的 PancakeSwap V2 池获得 500,000 枚 UNIFORM 和 4.45 tBNB，出价者已领取另外 500,000 枚。Flap 在同笔发射中登记了 Vault。另一次本机分叉演练验证了交易税到账和所有者等额提取。交互演示另用九笔出价展示不同限价的结果。

## What to show the judges

[Download the editable English–Chinese pitch deck](../qa/submission/Uniform-Launch-BNB-Bangkok.pptx). The same two-minute video covers both tracks with the English voiceover and captions. [Stage script and judge Q&A](pitch-runbook.md) · [English captions](video-subtitles.en.srt) · [Offline cue clock](../qa/submission/presenter-clock.html)

Flap asks teams to show a public BSC Testnet launch through their Factory, share code, explain the launch mechanism, and show their custom Flap UI. Projects that include a Vault should demonstrate how it works. [Official Flap brief](https://www.hackquest.io/hackathons/BNB-Bangkok)

| What to open | What to verify |
| --- | --- |
| [Verified Launcher Factory](https://testnet.bscscan.com/address/0xE82642aC5c3B3B4b7D4cDeaf6a251Dc0BB7AcEfd#code) · [Launcher creation](https://testnet.bscscan.com/tx/0x5be4952fc75b9d2aec691ae0288eed53ee922e53552fce9812da24c1410ab93c) | The Factory emitted `UniformLauncherCreated` for this auction. Each bidder specified a budget and price limit. All winning allocations clear at the same price. |
| [BSC Testnet settlement](https://testnet.bscscan.com/tx/0x56d87f21c4dbd55227d9e619986555f150c7da5ddec5db663b201a9b9985ae20) | Block 144,926,064. The pool's first reserves were 500,000 UNIFORM and 4.45 WBNB. |
| [BSC Testnet claim](https://testnet.bscscan.com/tx/0x732353fc11a666984971d62c5b7a0016d76775145823938bf515ef776354f27f) | Block 144,927,029. The transfer delivers 500,000 UNIFORM to the bidder. |
| [Public launch record and contracts](https://github.com/Jimmycoding0301/uniform-launch/blob/55d363cb7873094ea48a5f7bbaae37f9d837f115/docs/public-testnet-evidence.md) | Factory creation, identity, bid, settlement and claim receipts, token, pair and Vault addresses. |
| [Custom Flap template UI](../flap-ui/launcher-detail) · [Official source checker results](flap-integration.md) | The Launcher detail component displays auction state through Flap's runtime. The manifest pins its Factory and chain. |
| [Public Vault address](https://testnet.bscscan.com/address/0x18942571eE5E5642837326C2Fe18510270fEEEce) · [Vault rehearsal](e2e-evidence.md) | Flap registered the Vault on public testnet. Local-fork trades deposited 0.027516256919450703 tBNB in the rehearsal Vault. Its owner withdrew the same amount. |

## Optional interactive walkthrough

To illustrate the pricing rule, run `bash script/demo.sh` from the submitted checkout with submodules and the [prerequisites](../README.md). Open `/?demo=1&scene=3&lang=en` on the local address it prints. Set a 1 BNB budget and compare limits of 0.00003 and 0.000015. The first simulated order buys 50,000 tokens at 0.00002 BNB. The second buys zero and can reclaim its full budget. [60-second recording script](judge-demo.md)

For an offline presentation, download the checkout before the event. Open the [scene 3 image](../qa/submission/scene-3.png), the [scene 5 image](../qa/submission/scene-5.png) and the local [public transaction record](public-testnet-evidence.md). The six images and the saved record open without an RPC connection. [All six scenes](../qa/submission/README.md)

## Operator checklist

- [ ] Verify organizer approval and confirm participation. Open the correct team's project.
- [ ] Enter the project name, one-liner and description. Select **Developer Track** and **Flap Track**.
- [ ] Open the submission branch in a signed-out window. If the repository field requires a root URL, enter the [project repository](https://github.com/Jimmycoding0301/uniform-launch) and end the description with `Submission code and evidence — https://github.com/Jimmycoding0301/uniform-launch/tree/codex/bangkok-submission`.
- [ ] Check that a judge can open the Factory creation, settlement and claim receipts, the custom Flap UI and the fork Vault record from the submitted links.
- [ ] Submit before **27 November 2026 at 09:00 Bangkok / 10:00 Beijing**. Check the HackQuest confirmation and retain the project URL and submission time. [Official submission instructions](https://www.hackquest.io/hackathons/BNB-Bangkok)
