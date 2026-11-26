# 演示稿

主稿 2 分 30 秒，包含指图、填单和切幕时间。六幕中的 Vault 画面属于历史本机演练。讲新版公测网时切到新 Launcher，说明项目税通过 MARKETING 直接支付给创建者，测试网空名单仍要求身份验证，主网必须预填名单。[新版公开交易](marketing-testnet-evidence.md)

## 中文

| 时间 | 屏幕上点什么 | 嘴上说什么 | 屏幕上应该看到什么 |
| --- | --- | --- | --- |
| 0:00–0:15 | 打开 `/?demo=1`，停在第 1 幕 | 如果买得越晚、价格越高，同一场开盘就会有人为同一种代币付不同的价。我们让大家先报限价，再一起清算。 | 九笔出价的限价节点，双环标出当前清算价 |
| 0:15–0:45 | 指向限价节点、保留价线和清算双环 | 每一笔出价都带预算和最高价。窗口结束时，所有成交者付同一个价。达到入池条件后经 Flap 建池。新版把项目税直接发给创建者。条件不满足，每个人都可以领回全部预算。 | 仍是第 1 幕，清算双环位于 0.00002 BNB/枚 |
| 0:45–1:00 | 指向已募金额，再指清算双环 | 九笔预算共 15.7 BNB，门槛是 5 BNB。其中 11 BNB 的出价限价达到清算价。按现在的订单结算，预计 10 BNB 入池。 | 已募 15.7 BNB，门槛 5 BNB，预计入池 10 BNB |
| 1:00–1:15 | 点下一幕。指预算、最高价和复制按钮 | 填预算和最高价，把指令交给代理。每个身份只能出一笔。测试网的 Binance Agent ID 用替身演示，实际去重依赖身份来源。 | 第 2 幕，复制出价指令 |
| 1:15–1:30 | 点下一幕 | 代理先模拟。这一笔的清算价、成交枚数、实付和退回都从链上读出来。 | 第 3 幕，清算价 0.00002，成交 50,000 枚，实付 1 BNB，退回 0 BNB，入池 10 BNB |
| 1:30–1:45 | 点下一幕 | 窗口结束后一次结算。这里显示分叉演练的开盘价和入池。画面中的金库是历史版本。 | 第 4 幕，已发射，开盘价 0.00008，入池 40 BNB，金库显示分叉上买卖产生的税款余额 |
| 1:45–2:00 | 点下一幕 | 三笔共 3 BNB，距离入池门槛还差约 1.34 BNB。每个人都能领回全部预算。 | 第 5 幕，已募 3 BNB，门槛约 4.34 BNB，可以复制退款指令 |
| 2:00–2:15 | 点下一幕，指向两个单价比 | 这一幕单独做了对照模拟。同一组九笔出价，从第一笔到最后一笔成交，统一清算的单价比是 1，常数乘积曲线是 1.7789。 | 第 6 幕，两种机制下最后与最先成交的单价比 |
| 2:15–2:30 | 停在第 6 幕 | 组件包过了 Flap 检查器。测试网合约已验证。代理可以用 MCP 调用。这六幕在本机分叉上运行。公开测试网也已完成发射，4.45 tBNB 入池。 | 对照数字还在 |

## English

| Time | Click | Say | See |
| --- | --- | --- | --- |
| 0:00–0:15 | Open `/?demo=1` and stay on scene 1 | When a launch gets more expensive with each purchase, people pay different prices for the same token. Here, everyone submits a limit before the auction clears. | Limit-price markers for the nine bids, with a double ring at the indicative clearing price |
| 0:15–0:45 | Point to the limit-price markers, the reserve line and the double ring | Each bid sets a budget and a maximum price. When the window closes, every fill pays the same price. If the pool qualifies, Flap creates it. The current release sends the project tax to the creator. Otherwise bidders can claim their full budgets back. | Scene 1, with the double ring at 0.00002 BNB per token |
| 0:45–1:00 | Point to the total bid budget, then the double ring | The nine bids total 15.7 BNB against a 5 BNB threshold. Bids worth 11 BNB meet the clearing price. At these bids and limits, 10 BNB would enter the pool. | 15.7 BNB in bids, 5 BNB threshold and 10 BNB projected for the pool |
| 1:00–1:15 | Click 下一幕. Point at 预算, 最高价 and 复制出价指令 | Enter a budget and a limit, then hand the instruction to the agent. Each identity bids once. The testnet Binance Agent ID is a stand-in. Identity assurance depends on its issuer. | Scene 2, copy instruction |
| 1:15–1:30 | Click 下一幕 | The agent simulates first. Price, tokens, spend and refund are read from the chain. | Scene 3. 清算价 0.00002, 成交 50,000 枚, 实付 1 BNB, 退回 0 BNB, 入池 10 BNB |
| 1:30–1:45 | Click 下一幕 | After the window, one settlement. The opening price and reserves are shown here. The vault in this fork demo belongs to the original release. | Scene 4. 已发射, open price 0.00008, 40 BNB in the pool, live vault balance from trades on the fork |
| 1:45–2:00 | Click 下一幕 | Three bids total 3 BNB, about 1.34 BNB short of the pool minimum. Each bidder can claim a full refund. | Scene 5. 3 BNB in bids, minimum about 4.34 BNB, button 复制退款指令 |
| 2:00–2:15 | Click 下一幕 and point to the two price ratios | This separate simulation uses the same nine bids for both mechanisms. The last fill costs the same per token as the first under uniform clearing, and 1.7789 times as much on the constant-product curve. | Scene 6, last-to-first fill price ratios of 1 and 1.7789 |
| 2:15–2:30 | Stay on scene 6 | The component passed Flap's checker. The testnet contracts are verified. An agent can call the MCP server. These six scenes run on a local fork. We also launched on public BSC Testnet, with 4.45 tBNB deposited into the pool. | The comparison stays on screen |

## 出事预案

- 本机分叉没起来时，再跑 `bash script/demo.sh`。需要离线展示时，打开 [第 1 幕截图](../qa/submission/scene-1.png)，按同目录的 `scene-1.png` 至 `scene-6.png` 讲解，并说明是分叉截图。
- 页面读不到链：看顶栏是不是写着正在重试。换 `script/demo.sh` 打印的地址。不要改 RPC 到公网再当场演示。
- 桌面演示使用 1440 × 900。手机投影可直接打开演示页面，贴哈希核对仅用于手动核对回执。

## 30 秒

点出开盘先后可能带来的价差，然后指向清算双环。窗口结束后所有成交者付同一个价，条件不满足可以领回全部预算。切到第 6 幕，说明独立对照模拟中，最后与最先成交的单价比为 1 和 1.7789。

Explain how arrival order can change the price on a curve, then point to the double ring. Everyone who fills pays one clearing price, and a failed auction allows a full refund. In scene 6, give the last-to-first fill price ratios from the separate simulation, 1 and 1.7789.
