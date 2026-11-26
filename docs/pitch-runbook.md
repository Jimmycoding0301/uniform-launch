# Uniform Launch 路演与答辩

## 2 分钟台上讲稿

主讲用 PPT 的第 1–6 页。第 7 页的四笔资金流和第 8 页的 Flap 界面用于答辩。

提前打开[公开试算](https://jimmycoding0301.github.io/uniform-launch/?demo=1&scene=3&lang=en)、[真实拍卖](https://jimmycoding0301.github.io/uniform-launch/?network=testnet&launcher=0xADD4e8b95B194D457611b4754e53c45A6E2A41d6&lang=en)和发射、领取回执。公开试算使用九笔示例订单，无需钱包。展示代理生成的未签名交易时，可打开页面下方的 MCP 实测结果。

| 时间 | 操作 | 英文开口 | 中文提词 |
| --- | --- | --- | --- |
| 00:00–00:08 | 第 1 页 | Why should two people with the same budget pay different prices for the same launch? | 同样的预算，为什么开盘时两个人要付不同的单价？ |
| 00:08–00:19 | 第 2 页，指向预售和曲线 | Take two buyers, two and a half BNB each. A fixed presale sets the price up front. On our illustrative curve, the earlier wallet gets more tokens. | 两个人各出 2.5 BNB。预售提前定价，示例曲线里先到的拿得更多。 |
| 00:19–00:31 | 第 2 页，指绿色同价行 | In Uniform, bids set the clearing price. Both buyers get one hundred twenty-five thousand tokens at that same price. | 同价发射由出价形成清算价，两位买家各得 12.5 万枚，单价一致。 |
| 00:31–00:40 | 第 3 页，指身份和限价 | Each eligible wallet and identity bids once, with a budget and a maximum price. | 合格钱包和身份各限一笔，填预算和最高价。 |
| 00:40–00:50 | 第 3 页，指结果 | At the deadline, Flap launches the token if the pool qualifies. If the auction falls short, bidders can reclaim all their principal. | 达到入池条件就通过 Flap 发币建池。否则所有人可领回全部出价本金。 |
| 00:50–00:58 | 切浏览器，点较低限价 | Here’s the agent preview. With one BNB and the lower limit, I get zero tokens. My bid budget comes back. | 看代理预览。1 BNB 预算选较低限价，成交零枚，预算全退。 |
| 00:58–01:05 | 点较高限价 | Same budget, higher limit. This preview now fills fifty thousand tokens. | 同样预算，提高限价，现在显示成交五万枚。 |
| 01:05–01:16 | 指向 MCP 实测链接，切回第 4 页 | The agent can prepare the transaction. I still choose the limit and approve the signature. | 代理可以生成未签名交易，用户自己决定限价并确认签名。 |
| 01:16–01:26 | 第 5 页，点发射回执 | Here’s the public proof. The auction sent four point four five testnet BNB and half the supply to Pancake Swap. | 这是公开链上证据。4.45 tBNB 和一半代币进入 PancakeSwap 池。 |
| 01:26–01:39 | 点领取回执，再切真实拍卖页 | The second receipt confirms the bidder received the other half. The auction page shows the same clearing price and the tax recipient. | 领取回执确认买家拿到另一半。拍卖页展示统一清算价和交易税收款人。 |
| 01:39–01:48 | 第 6 页，指规模和权限 | We cap each auction at a hundred and twenty-eight bids. Mainnet uses Agent ID and a fixed wallet roster. | 每场最多 128 笔。主网用 Agent ID 和固定钱包名单。 |
| 01:48–02:00 | 第 6 页，指收费和仓库 | The protocol charges zero today. The roadmap proposes a tenth of a percent on successful launches. The repo has the code and receipts. Thank you. | 现在协议费为零。计划只对成功发射按成交额收 0.1%。代码和回执都在仓库，谢谢。 |

## 常见答辩题

**为什么有人愿意参加拍卖？**

提交前可以同时约束预算和最高价。统一清算后，先到的人在同一场没有单价优势。竞拍要托管资金，成交后仍承担二级市场价格风险。

**和固定预售、价格曲线的区别？**

固定预售让项目方预先定价。曲线按成交顺序更新价格。Uniform 把订单汇总，由需求决定一个清算价。对比页是同预算示例，额度和池参数以演示设定为准。

**开盘后有人马上卖怎么办？**

初始池储备比率与清算价对齐，随后由 PancakeSwap 的买卖决定价格。交易费用和价格冲击影响实际成交。机制只消除场内早到价差，首发后的市场由交易者定价。

**项目方还能有老鼠仓吗？**

同一场里项目方钱包参与成交也用同一清算价，早到无法获得更低的场内单价。创建者仍控制名单，关联方拿到多个合格身份也是一个边界。

**AI 在哪里？会自动决定出价吗？**

CLI 和 MCP 读取链上出价簿并模拟价格、实付、份额和退款。代理可以比较多个限价并准备未签名交易。最终限价及签名由用户确认，链上合约负责最终清算。

**怎么防止占坑和身份绕过？**

主网使用 Binance Agent ID 和固定合格钱包名单，每个钱包、每个身份各限一笔。名单由创建者管理。测试网演示用身份替身，公开这场没有钱包名单。

**为什么 128 笔？还可以扩吗？**

128 是当前按单次链上结算测得的上限。满载主网分叉约 9.74M gas。规模继续扩大要设计可验证的分步聚合或分批结算，并保持统一价和退款一致。

**钱锁多久？失败怎么退？**

接单窗口结束后，需要结算推进状态。成功场通过 claim 领取份额和未花资金，失败场通过 refund 退全部本金。网络 gas 各交易自付。

**3% 交易税和 0.1% 有什么区别？**

买卖税各 3%，持续 30 天，项目侧权益由 Flap 的 MARKETING 槽直接支付给创建者。0.1% 是未来协议成功费方案，目前为零。扣池款会改变初始储备比率，收费落地前要单独审计会计路径。

**怎么确认你们确实在 BSC 发射过？**

结算回执的 AuctionSettled 事件给出清算价、入池金额、币和池地址。领取回执和余额都确认出价者拿到 500,000 UNIFORM。两笔记录链接挂在网站与仓库。

**上线了吗？**

网页和公开测试网发射已可验证。Flap 宿主的 Mini App 权限和正式嵌入由 Flap 审核。主网计划在复审、工厂启用和试点后再推进。


## 线上核验链接

- [公开网站](https://jimmycoding0301.github.io/uniform-launch/?lang=en)
- [真实拍卖](https://jimmycoding0301.github.io/uniform-launch/?network=testnet&launcher=0xADD4e8b95B194D457611b4754e53c45A6E2A41d6&lang=en)
- [GitHub 源码](https://github.com/Jimmycoding0301/uniform-launch)
- [官方赛题](https://www.hackquest.io/hackathons/BNB-Bangkok)
- [部署](https://testnet.bscscan.com/tx/0xe751bc11de1d8f43952c732e0d304ab1be500507d36109086c207ed340498773)
- [创建](https://testnet.bscscan.com/tx/0x45c339b0d4a62da600714bd411f1d7ab966b51907a5b61379f2b09e4b362bb41)
- [出价](https://testnet.bscscan.com/tx/0xad339052f8b9e34197476bfd1defffd126373c7b87af77fd74ad0a5a5e4b8ed9)
- [结算发射](https://testnet.bscscan.com/tx/0x5cc2056b689db1a422e5dfbdbd7017a23f86fa9a764effaa6cc82c9c1051ec02)
- [领取](https://testnet.bscscan.com/tx/0x5e1f06bfce8e6ee3dd379c82593ad35330639f169d22fd189493ec7f42f6bbd9)

## 2 分 12 秒提交视频

| 时间 | 画面 | 英文旁白 | 中文提词 |
| --- | --- | --- | --- |
| 00:00–00:06 | 开场 | At launch, why should two buyers with the same budget pay different prices? | 同样的预算，为什么开盘时两个人要付不同的单价？ |
| 00:06–00:13 | 三种发射方式 | Say two buyers each have two and a half BNB. In a fixed presale, the founder sets the price. | 假设两位买家各有 2.5 BNB。固定价预售由项目方提前定价。 |
| 00:13–00:20 | 三种发射方式 | In a rising curve, the earlier wallet gets about one hundred eighty-one thousand tokens. The next gets one fifty-three. | 在示例曲线中，先到的钱包约拿 18.1 万枚，后到的约拿 15.3 万枚。 |
| 00:20–00:27 | 三种发射方式 | In Uniform, their bids set one price. Each receives one hundred twenty-five thousand tokens. | 在同价发射里，订单形成统一清算价，两人都拿 12.5 万枚。 |
| 00:27–00:34 | 同价机制 | Each eligible wallet and identity bids once. The bid contains a budget and a maximum price. | 每个合格钱包和身份各限一笔。出价含预算和最高价。 |
| 00:34–00:41 | 同价机制 | At the deadline, winners pay the same clearing price. Flap launches the token if the pool qualifies. | 到期后统一清算。达到入池条件，Flap 发币并建池。 |
| 00:41–00:47 | 失败退款 | If it falls short, everyone can reclaim their full bid principal. | 整场未达到发射条件，所有出价者可领回全部本金。 |
| 00:47–00:54 | 出价台 | Here’s the bidding desk. I set a one-BNB budget and start with the lower limit. | 这里是出价台。我填 1 BNB，先试较低的限价。 |
| 00:54–01:00 | 较低限价 | The agent reads the order book. At this limit I get zero tokens and my full budget back. | 代理读出价簿。这个限价下我拿零枚，1 BNB 全退。 |
| 01:00–01:07 | 较高限价 | Raise the limit, same budget. Now the preview shows fifty thousand tokens at the uniform price. | 提高限价，保持同一预算。现在预估按统一价成交 5 万枚。 |
| 01:07–01:14 | 复制指令 | I can copy the unsigned instruction. The buyer chooses the limit and confirms the signature. | 我可以复制未签名指令。买家决定限价并确认签名。 |
| 01:14–01:21 | Flap UI | The Flap detail component opens our Mini App, which supports bidding, settlement, claims and refunds. | Flap 详情组件可进入 Mini App，支持出价、结算、领取和退款。 |
| 01:21–01:28 | 创建与出价 | Flap’s Portal called our factory. The auction accepted one bid of four-point-four-five tBNB. | 现在看公开测试网。Flap Portal 通过工厂创建拍卖，接受了 4.45 tBNB 出价。 |
| 01:28–01:36 | 发射入池 | Settlement issued the token and paired half the supply with four-point-four-five tBNB on Pancake Swap. | 结算交易发行代币，并将一半供应量和 4.45 tBNB 一起注入 PancakeSwap。 |
| 01:36–01:43 | 领取代币 | On BscScan, the claim receipt shows the buyer received the other five hundred thousand tokens. | 领取回执确认出价人收到另外 50 万枚，两笔交易都能在 BscScan 核验。 |
| 01:43–01:50 | 已发射的拍卖 | The auction page shows the actual opening price and pool. The project’s trading tax goes directly to the creator. | 拍卖页展示实际开盘价和流动性池，项目侧交易税直接给创建者。 |
| 01:50–01:57 | 规模与准入 | The contract supports one hundred twenty-eight bids. Mainnet uses Binance Agent ID and a fixed wallet roster. | 每场最多 128 笔。主网采用 Binance Agent ID 和固定钱包名单。 |
| 01:57–02:04 | 收费路线 | The protocol fee is zero today. The roadmap proposes a tenth of a percent on successful launches. | 目前协议费为零，路线图提议成功发射收取 0.1%。 |
| 02:04–02:12 | 网站、源码和五笔回执 | The code, setup instructions and all five testnet receipts are in the repository. That’s Uniform Launch. | 代码、运行说明和五笔测试网回执都在仓库。这就是同价发射。 |
