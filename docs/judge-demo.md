# 60 秒评审演示 · One-minute judge walkthrough

运行 `bash script/demo.sh`，在它打印的页面地址后打开 `/?demo=1&scene=3`。第 3 幕在本机分叉的九笔出价上加入你的模拟单。另开两个标签页，准备展示 BSC 公共测试网的真实交易。[发射回执 / Settlement](https://testnet.bscscan.com/tx/0x5cc2056b689db1a422e5dfbdbd7017a23f86fa9a764effaa6cc82c9c1051ec02) · [领取回执 / Claim](https://testnet.bscscan.com/tx/0x5e1f06bfce8e6ee3dd379c82593ad35330639f169d22fd189493ec7f42f6bbd9)

提前载入两个回执。开表时选一种语言，每到标记秒先操作，再念同一行。说完停在结果上，等下个提示。 / Preload both receipts. Choose one language, act on each cue, then speak. Hold the result until the next cue.

| 开始时间 | 操作 / Action | 中文口播 | English |
| --- | --- | --- | --- |
| 00:00 | 第 3 幕，预算填 `1` BNB / Set budget to `1` | 同一枚 BNB，限价怎么影响成交？我们在本地分叉试两次。 | One BNB, two price limits. Let’s try both on this local fork. |
| 00:08 | 最高价填 `0.00003` / Set the limit | 我的限价比清算价高。所有成交者都付 0.00002，我实付 1 BNB，得到五万枚。 | My limit is above the clearing price. Winning bids all pay 0.00002. My one BNB buys 50,000 tokens. |
| 00:22 | 只把最高价改为 `0.000015` / Lower only the limit | 预算不动，调低限价。清算价没变，我这笔成交零枚，1 BNB 全退。 | Same budget, lower limit. The clearing price holds. My bid buys zero tokens, so my full BNB comes back. |
| 00:35 | 切到发射回执 / Open settlement tab | 另一场已经在 BSC 公共测试网结算。这笔交易通过 Flap 建池，实际入池 4.45 tBNB。 | Here’s a separate auction on BSC Testnet. This transaction launched the Flap pool with 4.45 tBNB. |
| 00:46 | 切到领取回执，指向代币转账 / Show token transfer | 再看领取回执。出价人收到了五十万枚 UNIFORM。 | The claim receipt shows 500,000 UNIFORM delivered to the bidder. |
| 00:53 | 可选，回本地页点第 5 幕，看 3 BNB / 4.34 BNB；或停在回执 / Show scene 5 or hold the receipt | 这场三笔出价合计三枚，没到入池门槛，每个人都能全额领回。 | Three BNB falls short of this pool’s minimum. Every bidder can claim a full refund. |
| 01:00 | 停止 / Stop | | |

## 150 秒备用 · Extended version

| 开始时间 | 操作与口播 / Action and line |
| --- | --- |
| 00:00 | 开第 1 幕，指向出价簿。“九笔预算共 15.7 BNB。我们把它们放进同一个窗口清算。每个身份只能出一笔，所有成交者付同一个价。” / “Nine bids add up to 15.7 BNB. We clear them together. Each identity bids once, and every winning bidder pays the same price.” |
| 00:20 | 点第 2 幕，指预算、最高价和复制按钮。“这两格决定我愿意花多少、每枚最多付多少。我把指令复制给代理先预览。” / “These fields set my budget and the most I’ll pay per token. I copy the instruction to my agent for a preview.” |
| 00:40 | 点第 3 幕，以 60 秒稿的前三句演示两档限价。00:40 填预算 `1`，00:48 填 `0.00003`，01:02 改为 `0.000015`。 / Use the first three lines above at 00:40, 00:48 and 01:02. |
| 01:15 | 点第 4 幕，指入池额和交易税。“本机演练中 40 BNB 入池。项目侧交易税由 Flap 直接付给创建者。” / “The local rehearsal put 40 BNB into the pool. Flap routes the project trading tax to the creator.” |
| 01:32 | 点第 5 幕，指退款回执。“这里三笔共 3 BNB，入池门槛约 4.34。整场没有成交，三位出价人都能领回全部预算。” / “Three bids total 3 BNB against a minimum of about 4.34. The auction has no fills. All three bidders can recover their budgets.” |
| 01:48 | 点第 6 幕，指单价比。“同一组出价，同价成交的首笔与末笔单价之比是 1。常数乘积曲线的模拟结果约为 1.78。” / “For the same bids, the first and last uniform fills have the same unit price. In the constant-product simulation it’s about 1.78.” |
| 02:05 | 切到公共测试网发射回执，念 60 秒稿的 00:35 一句。 / Open the public settlement receipt and use the 00:35 line above. |
| 02:19 | 切到领取回执，念 00:46 一句后停在转账记录。 / Open the claim receipt, use the 00:46 line and hold on the transfer. |
| 02:30 | 停止 / Stop. |
