# HackQuest submission · BNB Bangkok

## Project fields

| Field | Text to paste |
| --- | --- |
| Project name | Uniform Launch · 同价发射 |
| English one-liner | One bid per identity. One price for every winner. A BNB Chain auction that launches through Flap or lets everyone reclaim their bid. |
| 中文一句话 | 一个身份出价一次，所有成交者支付同一价格。达到门槛就通过 Flap 建池，未达门槛则全额退款。 |
| Tracks | Developer Track — Build on BNB Chain · Flap Track — Build on Pool Launch |
| Repository | `<FINAL_PUBLIC_REPOSITORY_VERSION_URL>` |

## English description

On a first-come token launch, the next buyer can pay more simply because someone bought first. Uniform Launch gives bidders a window to submit a BNB budget and a maximum price per token. Each wallet and each identifier from a configured identity source can bid once. When the window closes, all winning bids pay one clearing price. If the auction falls short of its launch conditions, every bidder can reclaim their full budget.

We built a Solidity Launcher Factory, a launch interface using Flap’s template, and a CLI and MCP server that let an agent preview a bid and prepare an unsigned transaction. We support Binance Agent ID and ERC-8004 identity sources. Our public testnet auction used a stand-in for Binance Agent ID.

On BSC Testnet one bid cleared at 0.0000089 tBNB per token. Flap opened a PancakeSwap V2 pool with 500,000 UNIFORM and 4.45 tBNB. The bidder claimed the other 500,000 UNIFORM. Flap also registered our Vault. On a local fork, swap taxes reached that Vault and its owner withdrew the same amount. The interactive demo uses a separate nine-bid order book so judges can try a winning and a losing limit.

## 中文备用简介

在先到先得的发行中，买入顺序会改变价格。同价发射把出价放进同一个窗口。参与者填写预算和每枚代币能接受的最高价，每个钱包和所选身份源中的每个身份各限一次。窗口关闭后，所有成交者支付同一个清算价。整场未达到发射条件，每位出价者都可领回全部预算。

我们实现了 Solidity 发射工厂、基于 Flap 模板的发射界面，以及供代理试算、生成未签名交易的 CLI 和 MCP 服务。协议支持 Binance Agent ID 与 ERC-8004 身份源，本次公共测试网发射采用 Agent ID 替身。

BSC 公共测试网上，一笔出价以每枚 0.0000089 tBNB 成交。Flap 创建的 PancakeSwap V2 池获得 500,000 枚 UNIFORM 和 4.45 tBNB，出价者已领取另外 500,000 枚。Flap 在同笔发射中登记了 Vault。另一次本机分叉演练验证了交易税到账和所有者等额提取。交互演示另用九笔出价展示不同限价的结果。

## Evidence links for the form

| What to open | What to verify |
| --- | --- |
| [BSC Testnet settlement](https://testnet.bscscan.com/tx/0x56d87f21c4dbd55227d9e619986555f150c7da5ddec5db663b201a9b9985ae20) | Block 144,926,064. The pool's first reserves were 500,000 UNIFORM and 4.45 WBNB. |
| [BSC Testnet claim](https://testnet.bscscan.com/tx/0x732353fc11a666984971d62c5b7a0016d76775145823938bf515ef776354f27f) | Block 144,927,029. The transfer delivers 500,000 UNIFORM to the bidder. |
| [Public launch record and contracts](https://github.com/Jimmycoding0301/uniform-launch/blob/55d363cb7873094ea48a5f7bbaae37f9d837f115/docs/public-testnet-evidence.md) | Factory creation, identity, bid, settlement and claim receipts, token, pair and Vault addresses. |
| [Flap runtime UI](../flap-ui/launcher-detail) · [Vault rehearsal](e2e-evidence.md) | The custom Flap component and the fork results for tax distribution and owner withdrawal. |

## 60-second demo

From the submitted checkout with submodules and the [prerequisites](../README.md), run `bash script/demo.sh`. Open `/?demo=1&scene=3` on the local address it prints. Preload the two BscScan receipts above. The demo needs no wallet or signature. [Timed English and Chinese narration](judge-demo.md)

| Time | Show |
| --- | --- |
| 00:00–00:22 | In scene 3, enter a budget of 1 BNB and a limit of 0.00003. The order buys 50,000 tokens at the shared price of 0.00002 BNB. |
| 00:22–00:35 | Lower only the limit to 0.000015. The same order buys zero tokens and gets its full 1 BNB back in the simulation. |
| 00:35–00:53 | Switch to the public settlement, then the public claim. Point to 4.45 tBNB and the 500,000-token transfer. |
| 00:53–01:00 | Open scene 5. The three bids total 3 BNB against a pool minimum of about 4.34 BNB. All three can claim a refund. |

For an offline presentation, download the checkout before the event. Open the [scene 3 image](../qa/submission/scene-3.png), the [scene 5 image](../qa/submission/scene-5.png) and the local [public transaction record](public-testnet-evidence.md). The six images and the saved record open without an RPC connection. [All six scenes](../qa/submission/README.md)

## Operator checklist

- [ ] Verify organizer approval and confirm participation. Open the correct team's project.
- [ ] Enter the project name, one-liner and description. Select **Developer Track** and **Flap Track**.
- [ ] Replace the repository placeholder with the final public GitHub version. Open it in a signed-out window. Check that the demo material and the two BscScan receipts open from what the judge receives.
- [ ] Submit before **27 November 2026 at 09:00 Bangkok / 10:00 Beijing**. Check the HackQuest confirmation and retain the project URL and submission time. [Official submission instructions](https://www.hackquest.io/hackathons/BNB-Bangkok)
