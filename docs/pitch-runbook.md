# Uniform Launch · One-Price Auctions

These are rehearsal timings for the five-slide deck. Speak the English column throughout, or use the Chinese column for a Chinese audience. At each timestamp, operate first and then speak. Hold the result until the next cue. [Pitch deck](../qa/submission/Uniform-Launch-BNB-Bangkok.pptx) · [Offline cue clock](../qa/submission/presenter-clock.html) · [Official event brief](https://www.hackquest.io/hackathons/BNB-Bangkok)

## Before the clock starts

Open the deck at slide 1 and the offline cue clock on a second screen. Press Space to start once slide 1 is visible. Run `bash script/demo.sh` in the submitted checkout and open `/?demo=1&scene=3` on the address it prints. Locate the two price buttons under **用 1 BNB 试两种限价**. Each sets the budget to 1 BNB automatically. Open the public settlement and claim in separate tabs. [Settlement](https://testnet.bscscan.com/tx/0x56d87f21c4dbd55227d9e619986555f150c7da5ddec5db663b201a9b9985ae20) · [Claim](https://testnet.bscscan.com/tx/0x732353fc11a666984971d62c5b7a0016d76775145823938bf515ef776354f27f)

For an offline room, download the deck and transaction record in advance. Stay on slide 3 and point to its two displayed outcomes at the browser cues. On slide 4 point to the pool and claim figures. Keep the same timings. [Saved public transaction record](public-testnet-evidence.md) · [Six local-fork screenshots](../qa/submission/README.md)

## Two minutes

| Clock | Stage action | Say in English | 中文口播 |
| --- | --- | --- | --- |
| 00:00 | Slide 1. Start the timer. | If two people want the same new token, why should the slower click pay more? Uniform Launch gives every winning bidder one price. | 两个人买同一种新代币，为什么点得慢就要付更多？同价发射让所有成交者都付一个价格。 |
| 00:12 | Slide 2. Point to “Set your limit.” | Each round accepts up to thirty-two bids, one per identity. You set a budget and a maximum price. The agent previews the bid before you approve it. | 每轮最多三十二单，每个身份限一单。你设定预算和每枚最高价，代理先试算，再由你确认。 |
| 00:26 | Trace “Clear once” and “Launch or refund.” | At close, we set one price. Flap launches if the pool qualifies. Otherwise, bidders can claim refunds. | 截止一起算价。达标就通过 Flap 建池。未达标，每人可领回预算。 |
| 00:36 | Slide 3. Switch to the local scene 3 tab if available. | Here's a local simulation. I'll add one BNB to the same nine-bid book, twice. | 这是本机试算。用一枚 BNB 测两个限价。 |
| 00:44 | Click **0.00003**. Point to 50,000. | With the higher limit, I spend one BNB and receive fifty thousand tokens. I pay the clearing price shown here, below my maximum. | 限价调高，这单花一枚 BNB，买到五万枚。实际支付的是屏幕上的清算价，低于我的限价。 |
| 00:58 | Click **0.000015**. Point to the refund and clearing price. | Lower only my limit. The clearing price stays at 0.00002. This bid gets zero tokens and its full BNB back. | 只调低限价，清算价仍是 0.00002。这单没有成交，一枚 BNB 全退。 |
| 01:12 | Return to the deck, advance to slide 4 and open its settlement receipt. | Here’s a different auction, on public BSC Testnet. Our Factory created the Launcher. The settlement transaction opened a PancakeSwap pool with four point four five test BNB and half a million UNIFORM. | 这是另一场拍卖，在 BSC 公共测试网。我们的工厂先创建 Launcher。这笔结算在 PancakeSwap 建池，初始储备是 4.45 枚测试币和五十万枚 UNIFORM。 |
| 01:28 | Open the claim tab. Point to the token transfer. | This second receipt shows the bidder claimed the other half million tokens. Both transactions are public. | 第二笔回执显示出价者领走了另外五十万枚代币。两笔交易都在公网上。 |
| 01:41 | Return to the deck and advance to slide 5. Point to the two evidence labels. | We built the Launcher UI on Flap’s template. The public launch linked the Vault. On a local fork, trade fees reached it and the owner withdrew them. | 发射界面基于 Flap 模板开发。公网发射关联了 Vault，分叉上的交易税已到账，所有者也成功提取。 |
| 01:55 | Leave slide 5 visible. | One auction, one price for every winning bid. Thank you. | 成交者都付同一个价。谢谢。 |
| 02:00 | Stop. | | |

## One minute

| Clock | Stage action | Say in English | 中文口播 |
| --- | --- | --- | --- |
| 00:00 | Slide 1. Start. | Why should the slower click pay more? We give every winning bidder one price. | 为什么点得慢就要付更多？我们让所有成交者付同一个价格。 |
| 00:08 | Slide 2. Point to the three steps. | One identity, one budget, one limit. We clear once and launch through Flap when the pool minimum is met. | 一个身份出一单，填预算和限价，统一清算。达到入池门槛就通过 Flap 发射。 |
| 00:17 | Slide 3. Switch to local scene 3. | One BNB. Two limits. | 同预算，两档限价。 |
| 00:20 | Click **0.00003**. | The higher limit buys fifty thousand tokens. | 高限价可以买到五万枚。 |
| 00:28 | Click **0.000015**. Point to zero. | Full refund. Same clearing price. | 这笔全退，清算价没变。 |
| 00:35 | Return to deck, advance to slide 4 and open settlement. | Our public testnet launch seeded the pool with four point four five test BNB. | 这场公共测试网发射有 4.45 枚测试币入池。 |
| 00:44 | Open the claim tab. | The bidder claimed half a million UNIFORM. | 出价者已领取五十万枚 UNIFORM。 |
| 00:52 | Return to deck, advance to slide 5 and close. | Built on Flap. Vault fees and withdrawal tested on a fork. Thank you. | 分叉已验证 Vault 收税和提款。谢谢。 |
| 01:00 | Stop. | | |

## Judge Q&A

Give one answer, then pause. The Chinese column is a cue for the presenter.

| Likely question | English answer, about ten seconds | 中文提示 |
| --- | --- | --- |
| What does one price change for a buyer? | Winners share one clearing price. At an exact marginal-price tie, submission order can still affect who gets an allocation. | 成交价相同。在边际价完全并列时，提交顺序仍可能影响分配。 |
| How do you stop someone bidding twice? | Each wallet and each identity ID within a source can bid once. Identity issuance belongs to the issuer. Our testnet used an Agent ID stand-in. | 钱包和身份双重去重，测试网身份用替身。 |
| What did you actually launch? | On public BSC Testnet, one bid funded a 4.45 tBNB pool. The bidder claimed 500,000 tokens. The multi-bid example is a local simulation. | 公网单笔发射、领取；九笔案例是本地试算。 |
| What happens below the pool minimum? | Every bidder can claim a full refund. In our fork example, three bids total three BNB against a minimum of about four point three four. | 整场失败，三位出价者可分别领取全额退款。 |
| What did you build on Flap? | Our Factory creates an auction Launcher. We built its detail UI from Flap’s template. After settlement the Portal launches the token into PancakeSwap. | 工厂、拍卖 Launcher、自制模板界面、Portal 建池。 |
| Who gets trading fees, and how did you test that? | The public launch linked the Vault. On a fork, fees from trades reached it. The owner withdrew the full balance. | 公网挂接 Vault，分叉实测税款到账和全提。 |
| Where does the agent fit in? | Our CLI and MCP tools preview a bid and prepare an unsigned transaction. The bidder authorizes it, and the desk can match its receipt. | 代理试算、生成未签名交易，出价者授权，网页核对回执。 |

[Factory and public transactions](public-testnet-evidence.md) · [Vault buy, sell and withdrawal evidence](e2e-evidence.md) · [Flap UI and checker](flap-integration.md)
