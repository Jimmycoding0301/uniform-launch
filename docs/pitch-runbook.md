# Uniform Launch · One-Price Auctions

## Two-minute submission video

Use the English column as the voiceover. The Chinese columns direct the screen capture and give the meaning of each line. Start each shot at the marked second and hold the result until the next cut. These timings belong to this recording. [English subtitles](video-subtitles.en.srt) · [Five-slide deck](../qa/submission/Uniform-Launch-BNB-Bangkok.pptx) · [Offline cue clock](../qa/submission/presenter-clock.html)

The Flap brief asks for the Factory, a complete BSC Testnet launch, a custom Flap-template launch UI, evidence for an included Vault, source code and an explanation of the mechanism. The same public contracts and the agent CLI and MCP tools support the Developer Track entry. [Official event brief](https://www.hackquest.io/hackathons/BNB-Bangkok) · [Submission code](https://github.com/Jimmycoding0301/uniform-launch/tree/codex/bangkok-submission)

### Preload the five public receipts

| Video cue | Public BSC Testnet receipt | Point to |
| --- | --- | --- |
| 00:18 | [Register test identity](https://testnet.bscscan.com/tx/0x4df7fbf222c358de87017d42267aabf006c525abdc505634369b1c6cfc78b2d0) | Testnet Agent ID stand-in. Block 144,923,523. |
| 00:24 | [Factory creates Launcher](https://testnet.bscscan.com/tx/0x5be4952fc75b9d2aec691ae0288eed53ee922e53552fce9812da24c1410ab93c) | UniformLauncherCreated. Block 144,924,369. |
| 00:28 | [Submit the only bid](https://testnet.bscscan.com/tx/0xac2f7be859199de2d0fc11c57fcdf59308b5f856b5928afa75aaecde40dafa01) | 4.45 tBNB, limit 0.000009 tBNB per token. Block 144,924,882. |
| 01:18 | [Settle and launch](https://testnet.bscscan.com/tx/0x56d87f21c4dbd55227d9e619986555f150c7da5ddec5db663b201a9b9985ae20) | Clearing price 0.0000089 tBNB. Pair reserves 500,000 UNIFORM and 4.45 WBNB. Block 144,926,064. |
| 01:34 | [Claim tokens](https://testnet.bscscan.com/tx/0x732353fc11a666984971d62c5b7a0016d76775145823938bf515ef776354f27f) | Transfer of 500,000 UNIFORM to the bidder. Block 144,927,029. |

For the interactive shot, run `DEMO_WEB_PORT=4417 bash script/demo.sh` in the submitted checkout and open `/?demo=1&scene=3&lang=en` at the printed address. Both price buttons set the budget to one BNB. Switch languages from the header while keeping the current scene. Preload the five receipts, the Flap UI and the submission code. Offline, use the two outcomes printed on slide 3, the saved public transaction record and the fork Vault record. [Public record and contract addresses](public-testnet-evidence.md) · [Local-fork screenshots](../qa/submission/README.md) · [Custom Flap component](../flap-ui/launcher-detail) · [Fork Vault receipts](e2e-evidence.md)

The fixed-price example posts 0.00002 BNB per token in advance. Both 2.5 BNB orders have enough allocation and receive 125,000 tokens. The simulated bonding curve gives the earlier founder wallet about 181,000 and the next wallet about 153,000. The auction independently clears at 0.00002 from the bids and fills both for 125,000. Among these three launch methods, it combines a price set by demand with one unit price for every fill. The founder and buyer are hypothetical roles for bids 2 and 3 of the local nine-bid book. [Nine-bid inputs and curve parameters](https://github.com/Jimmycoding0301/uniform-launch/blob/7ca35931639b23c678ae57f6e03213864ce3841a/web/public/why.json)

### Voice and screen cues

| Time | 画面与操作 | Read aloud in English | 中文提词 |
| --- | --- | --- | --- |
| 00:00 | 第 1 页，指固定价预售一行，两人各出 2.5 BNB。 | Fixed-price presale? The founder picks the price. | 固定价预售，由项目方提前定价。示例中两人各拿 12.5 万枚。 |
| 00:05 | 指曲线一行。先到的项目方钱包约拿 18.1 万枚，后一个约拿 15.3 万。 | On the curve, the founder bids just before you. Same budget, more tokens. | 同样预算，曲线上先到的项目方买得更多。 |
| 00:11 | 指绿色同价拍卖一行，再指页面底部的结论。 | In our auction, the bids set one price. You both get 125,000 tokens. | 出价共同决定一个清算价，两人各拿 12.5 万枚。三种方式里，只有它同时满足需求定价和同价成交。 |
| 00:18 | 第 2 页，切到真实身份登记回执。 | Each identity bids once. Our public testnet bidder used a stand-in Agent ID. | 每个身份出价一次。公网测试使用测试身份替身。 |
| 00:24 | 指 Factory 的 Launcher 创建事件。 | Our Factory created this Launcher. | 工厂创建本场拍卖。 |
| 00:28 | 指公网出价回执中的 4.45 tBNB。 | One bidder committed 4.45 test BNB. | 公网拍卖只有一笔出价。 |
| 00:32 | 第 2 页，指结算触发。 | After close, anyone can settle. | 窗口结束，任何人都可以发起结算。 |
| 00:35 | 指成功分支和 Flap 建池。 | That call launches through Flap if the pool qualifies. | 达标就通过 Flap 发射。 |
| 00:39 | 指失败退款分支。 | Otherwise, bidders can claim full refunds. | 未达到发射条件，买家可以领回全部出价本金。 |
| 00:42 | 第 3 页，切到实录，填 1 BNB 和限价、复制给代理的指令。 | I give my AI agent one BNB and two price limits. It previews both against the local bids. | 同一笔 1 BNB 预算，代理在本机分叉的订单簿上试算两档限价。 |
| 00:50 | 点 0.00003，指预计成交量。 | At the higher limit, my one BNB buys fifty thousand tokens. | 高限价下，预计 1 BNB 买到五万枚。 |
| 00:57 | 切到本地 MCP 工具实测，指两行返回值与待签交易路径。 | The agent prepares an unsigned bid. I review it before signing. | 代理准备未签名出价。我核对金额与限价后，才确认签名。画面显示预演。 |
| 01:04 | 回到网页，选择 0.000015，指清算价。 | Now I lower only my limit. The clearing price stays at 0.00002. | 只调低自己的限价，试算清算价仍是 0.00002。 |
| 01:12 | 指预估成交 0、可取回 1 BNB。 | My bid gets zero tokens and the whole BNB back. | 这笔买不到代币，可拿回整个预算。 |
| 01:18 | 第 4 页，打开公网发射回执。 | Back on public testnet, that single bid funded a real launch. | 回到公网测试网。此前那笔出价确实触发了一次成功发射。 |
| 01:25 | 指结算交易与 Pair 创建。 | Settlement opened a PancakeSwap V2 pool | 结算创建 PancakeSwap V2 流动性池。 |
| 01:29 | 指 Pair 的初始储备。 | with half a million UNIFORM and 4.45 test BNB. | 池内是 50 万枚 UNIFORM 和 4.45 枚 WBNB。 |
| 01:34 | 打开第五笔领取回执，指 Transfer 金额。 | Here is the fifth transaction. The bidder claimed the other half million tokens. | 出价者实际领取另外五十万枚。 |
| 01:41 | 第 5 页，展示自制 Flap 界面。 | We built the Launcher interface using Flap’s template. | 用 Flap 的模板做了 Launcher 详情界面。 |
| 01:45 | 指公网 Vault 地址。 | The public launch linked the Vault. | 公网发射已关联金库。 |
| 01:48 | 展示分叉 Vault 的收税和提取记录。 | On a separate fork, trading fees reached it and the owner withdrew them. | 分叉上验证税费进入金库并由 owner 提取。 |
| 01:55 | 停在 GitHub 提交分支。 | Our code is public for both the Flap and Developer tracks. | 两个赛道共用这份公开代码。 |
| 02:00 | 停表。 | | |

## One minute

| Clock | Stage action | Say in English | 中文口播 |
| --- | --- | --- | --- |
| 00:00 | Slide 1. Trace the three pricing rules. | Presales post a price. Curves move it. Here, bids set one price for every winner. | 预售由项目方定价，曲线逐单变价，我们由出价共同定价且所有成交者同价。 |
| 00:08 | Slide 2. Point to the three steps. | One identity, one budget, one limit. We clear once and launch through Flap when the pool minimum is met. | 一个身份出一单，填预算和限价，统一清算。达到入池门槛就通过 Flap 发射。 |
| 00:17 | Slide 3. Point to both limits. | My agent previews both limits. | 代理用同一预算试算两档限价。 |
| 00:20 | Click **0.00003**. | The higher limit buys fifty thousand tokens. | 高限价可以买到五万枚。 |
| 00:28 | Select the lower limit and show the refund. | Full refund. My agent prepares the bid. I sign. | 低限价全退。代理准备交易，我来确认。 |
| 00:35 | Return to deck, advance to slide 4 and open settlement. | Our public testnet launch seeded the pool with four point four five test BNB. | 这场公共测试网发射有 4.45 枚测试币入池。 |
| 00:44 | Open the claim tab. | The bidder claimed half a million UNIFORM. | 出价者已领取五十万枚 UNIFORM。 |
| 00:52 | Return to deck, advance to slide 5 and close. | Built on Flap. Vault fees and withdrawal tested on a fork. Thank you. | 分叉已验证 Vault 收税和提款。谢谢。 |
| 01:00 | Stop. | | |

## Judge Q&A

Give one answer, then pause. The Chinese column is a cue for the presenter.

| Likely question | English answer, about ten seconds | 中文提示 |
| --- | --- | --- |
| Why choose this over a fixed-price presale or a bonding curve? | A presale gives buyers a known price. A curve allows immediate trading. Our auction is the best fit when we want bids to discover the price and every fill to share it. Buyers wait for the window to close. | 固定预售提前知道价格，曲线能即时成交。若目标是让需求定价、所有成交者同价，这三种方式里我们最合适；代价是要等结算。 |
| Why do the presale and auction give both wallets 125,000? | We deliberately posted the presale at the eventual auction price, with enough supply for both bids. The presale creator had to choose that price upfront. Our buyers’ budgets and limits determined it above the reserve. | 预售对照故意选相同价格，且额度充足。项目方预设价格，同价拍卖则由有效出价在保留价约束下形成清算价。 |
| What work does the AI agent actually save a buyer? | I give it a budget and two limits. It reads the live order book, compares fills and refunds, and prepares the bid for me to review. I approve the transaction, and the contract sets the price. | 不用手算两笔结果或手写交易。代理读取出价簿、比较预计成交和退款、准备待签交易，用户确认，合约定价。新出价会改变预估。 |
| Could a founder still buy most of the supply and sell later? | Yes. A founder can buy a large allocation and sell it later. Bidding earlier gives them no price advantage over another winning bid in that auction. | 项目方仍可买很多，也可以卖。对已成交的两人，先提交没有首发单价优势。 |
| What if the founder sells the moment the pool opens? | Our pool starts at the auction price. With no intervening buys, a sale pushes the price down. The founder receives less per token than they paid. | 以本场建池比例为前提，若没有后续买单，项目方马上卖会压低池价，实际卖出均价低于首发成本。 |
| Did two public testnet wallets produce the comparison? | The two wallets are hypothetical roles for bids two and three in our nine-bid simulation. The public launch had one bidder and a 4.45 tBNB pool. | 开场两种身份是假设；数量来自九笔本地订单。公网发射只有一笔出价。 |
| What does one price change for a buyer? | Winners share one clearing price. At an exact marginal-price tie, submission order can still affect who gets an allocation. | 成交价相同。在边际价完全并列时，提交顺序仍可能影响分配。 |
| How do you stop someone bidding twice? | Each wallet and each identity ID within a source can bid once. Identity issuance belongs to the issuer. Our testnet used an Agent ID stand-in. | 钱包和身份双重去重，测试网身份用替身。 |
| What did you actually launch? | On public BSC Testnet, one bid funded a 4.45 tBNB pool. The bidder claimed 500,000 tokens. The multi-bid example is a local simulation. | 公网单笔发射、领取；九笔案例是本地试算。 |
| What happens below the pool minimum? | Every bidder can claim a full refund. In our fork example, three bids total three BNB against a minimum of about four point three four. | 整场失败，三位出价者可分别领取全额退款。 |
| What did you build on Flap? | Our Factory creates an auction Launcher. We built its detail UI from Flap’s template. During settlement, the Portal launches the token into PancakeSwap. | 工厂、拍卖 Launcher、自制模板界面、Portal 建池。 |
| Who gets trading fees, and how did you test that? | The public launch linked the Vault. On a fork, fees from trades reached it. The owner withdrew the full balance. | 公网挂接 Vault，分叉实测税款到账和全提。 |
| Does the launch happen by itself at the deadline? | Anyone can call settle after the window closes. If the auction qualifies, that transaction triggers issuance and creates the pool through Flap. | 到期后需有人调用 settle，一次交易内完成发币和建池。 |
| Where can we inspect or run what you built? | Our public submission branch includes the contracts, the Flap UI, the agent CLI and MCP server, and a command to reproduce the demo. | 公开提交分支包含合约、Flap 前端、代理工具及复现命令。 |

[Shared code for Flap and Developer](https://github.com/Jimmycoding0301/uniform-launch/tree/codex/bangkok-submission) · [Factory and public transactions](public-testnet-evidence.md) · [Vault buy, sell and withdrawal evidence](e2e-evidence.md) · [Flap UI and checker](flap-integration.md)
