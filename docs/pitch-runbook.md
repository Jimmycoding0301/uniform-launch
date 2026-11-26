# Uniform Launch · One-Price Auctions

## Two-minute submission video

Use the English column as the voiceover. The Chinese columns direct the screen capture and give the meaning of each line. Start each shot at the marked second and hold the result until the next cut. These timings belong to this recording. [English subtitles](video-subtitles.en.srt) · [Five-slide deck](../qa/submission/Uniform-Launch-BNB-Bangkok.pptx) · [Offline cue clock](../qa/submission/presenter-clock.html)

The Flap brief asks for the Factory, a complete BSC Testnet launch, a custom Flap-template launch UI, evidence for an included Vault, source code and an explanation of the mechanism. The same public contracts and the agent CLI and MCP tools support the Developer Track entry. [Official event brief](https://www.hackquest.io/hackathons/BNB-Bangkok) · [Submission code](https://github.com/Jimmycoding0301/uniform-launch/tree/codex/bangkok-submission)

### Preload the five public receipts

| Video cue | Public BSC Testnet receipt | Point to |
| --- | --- | --- |
| 00:12 | [Register test identity](https://testnet.bscscan.com/tx/0x4df7fbf222c358de87017d42267aabf006c525abdc505634369b1c6cfc78b2d0) | Testnet Agent ID stand-in. Block 144,923,523. |
| 00:18 | [Factory creates Launcher](https://testnet.bscscan.com/tx/0x5be4952fc75b9d2aec691ae0288eed53ee922e53552fce9812da24c1410ab93c) | UniformLauncherCreated. Block 144,924,369. |
| 00:22 | [Submit the only bid](https://testnet.bscscan.com/tx/0xac2f7be859199de2d0fc11c57fcdf59308b5f856b5928afa75aaecde40dafa01) | 4.45 tBNB, limit 0.000009 tBNB per token. Block 144,924,882. |
| 01:12 | [Settle and launch](https://testnet.bscscan.com/tx/0x56d87f21c4dbd55227d9e619986555f150c7da5ddec5db663b201a9b9985ae20) | Clearing price 0.0000089 tBNB. Pair reserves 500,000 UNIFORM and 4.45 WBNB. Block 144,926,064. |
| 01:28 | [Claim tokens](https://testnet.bscscan.com/tx/0x732353fc11a666984971d62c5b7a0016d76775145823938bf515ef776354f27f) | Transfer of 500,000 UNIFORM to the bidder. Block 144,927,029. |

For the interactive shot, run `DEMO_WEB_PORT=4417 bash script/demo.sh` in the submitted checkout and open `/?demo=1&scene=3` at the printed address. Both price buttons set the budget to one BNB. Preload the five receipts, the Flap UI and the submission code. Offline, use the two outcomes printed on slide 3, the saved public transaction record and the fork Vault record. If the browser is slow during the recording, cut directly to the preloaded tab. [Public record and contract addresses](public-testnet-evidence.md) · [Local-fork screenshots](../qa/submission/README.md) · [Custom Flap component](../flap-ui/launcher-detail) · [Fork Vault receipts](e2e-evidence.md)

### Voice and screen cues

| Time | 画面与操作 | Read aloud in English | 中文提词 |
| --- | --- | --- | --- |
| 00:00 | 第 1 页，按空格开表。 | Why should the second buyer pay more for the same token? With Uniform Launch, each identity bids once. Winners pay one price. | 为什么晚点买就贵？每个身份出一单，成交者支付同一个价格。 |
| 00:12 | 第 2 页，显示公网身份回执，指向 Success。 | On public BSC Testnet, our bidder registered a stand-in Agent ID. | 这笔交易登记了测试身份，用的是 Agent ID 替身。 |
| 00:18 | 切到 Factory 创建交易，指 Launcher 创建事件。 | Our Factory created this Launcher. | 我们开发的工厂创建了这场拍卖。 |
| 00:22 | 切到出价回执，指 Value 4.45 tBNB。 | One bidder committed 4.45 test BNB. | 这场公开拍卖只有一笔出价。 |
| 00:26 | 回第 2 页，指 Clear once 和 Launch or refund。 | After close, anyone can settle. That call launches through Flap if the pool qualifies. Otherwise, bidders can claim full refunds. | 到期后任何人都能发起结算。达标即建池，失败可全额退款。 |
| 00:36 | 第 3 页，切到本机第 3 幕。 | On this local nine-bid book, I set a one-BNB budget and try two price limits. | 下面是本地九单簿的试算。预算固定，改变最高价。 |
| 00:44 | 点 0.00003，指预计成交 50,000 和实付 1 BNB。 | At the higher limit, my one BNB buys fifty thousand tokens. I pay the shared clearing price shown here, below my maximum. | 较高限价成交五万枚。成交价低于我填的最高价。 |
| 00:58 | 点 0.000015，指预计成交 0、退回 1 BNB 和不变的清算价。 | Now I lower only my limit. The clearing price stays at 0.00002. My bid gets zero tokens and the whole BNB back. | 改成较低限价。这单零成交，全退。两次清算价都是 0.00002。 |
| 01:12 | 第 4 页，回到公网，开发射回执的 Pair Sync 日志。屏幕标 0.0000089 tBNB/枚。 | Back on public testnet, that single bid funded a real launch. Settlement opened a PancakeSwap V2 pool with half a million UNIFORM and 4.45 test BNB. | 回到刚才的公网单笔拍卖。结算创建池，五十万枚 UNIFORM 与 4.45 枚 WBNB 配对。 |
| 01:28 | 打开展示第五笔领取回执，指 ERC-20 Transfer，金额 500,000。 | Here is the fifth transaction. The bidder claimed the other half million tokens. You can verify that transfer on BscScan. | 与入池份额分开，出价者实际领到另外五十万枚。 |
| 01:41 | 第 5 页，指 Flap 自制界面。并排显示公共 Vault 绑定、分叉分税和提款证据。 | We built the Launcher interface using Flap’s template. The public launch linked the Vault. On a separate fork, trading fees reached it and the owner withdrew them. | 公网验证 Vault 绑定。分叉上实际做过交易、收税和提款。 |
| 01:55 | 停在第 5 页，显示最终 GitHub 提交分支。 | Our code is public for both the Flap and Developer tracks. | Flap 与 Developer 两个赛道共用这份公开代码。 |
| 02:00 | 停表。 | | |

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
| What did you build on Flap? | Our Factory creates an auction Launcher. We built its detail UI from Flap’s template. During settlement, the Portal launches the token into PancakeSwap. | 工厂、拍卖 Launcher、自制模板界面、Portal 建池。 |
| Who gets trading fees, and how did you test that? | The public launch linked the Vault. On a fork, fees from trades reached it. The owner withdrew the full balance. | 公网挂接 Vault，分叉实测税款到账和全提。 |
| Where does the agent fit in? | Our CLI and MCP tools preview a bid and prepare an unsigned transaction. The bidder authorizes it, and the desk can match its receipt. | 代理试算、生成未签名交易，出价者授权，网页核对回执。 |
| Does the launch happen by itself at the deadline? | Anyone can call settle after the window closes. If the auction qualifies, that transaction triggers issuance and creates the pool through Flap. | 到期后需有人调用 settle，一次交易内完成发币和建池。 |
| Where can we inspect or run what you built? | Our public submission branch includes the contracts, the Flap UI, the agent CLI and MCP server, and a command to reproduce the demo. | 公开提交分支包含合约、Flap 前端、代理工具及复现命令。 |

[Shared code for Flap and Developer](https://github.com/Jimmycoding0301/uniform-launch/tree/codex/bangkok-submission) · [Factory and public transactions](public-testnet-evidence.md) · [Vault buy, sell and withdrawal evidence](e2e-evidence.md) · [Flap UI and checker](flap-integration.md)
