# 演示稿

主稿 2 分 30 秒，包含指图、填单和切幕时间。

## 中文

| 时间 | 屏幕上点什么 | 嘴上说什么 | 屏幕上应该看到什么 |
| --- | --- | --- | --- |
| 0:00–0:15 | 打开 `/?demo=1`，停在第 1 幕 | 新币开盘时，机器人和狙击手会在第一个区块买走低价，后来的人接高价。曲线上第一个人和最后一个人的单价可以差到 1.8 倍。 | 接单场，清算价和阶梯 |
| 0:15–0:45 | 指一下阶梯和保留价，先不点按钮 | 代理提交限价和预算。窗口结束只清算一次，成交的人都付这个价。卖不够就全额退款。成功后经 Flap 一笔建池，税全部进金库。 | 仍是第 1 幕 |
| 0:45–1:00 | 停在第 1 幕 | 九笔出价共 15.7 BNB。这场的门槛是 5 BNB。 | 已募 15.7 BNB，门槛 5 BNB，当前清算价 0.00002 BNB/枚 |
| 1:00–1:15 | 点下一幕。指预算、最高价和复制按钮 | 填预算和最高价，把指令交给代理。每个身份只能出一笔。测试网的 Binance Agent ID 用替身演示，实际去重依赖身份来源。 | 第 2 幕，复制出价指令 |
| 1:15–1:30 | 点下一幕 | 代理先模拟。这一笔的清算价、成交枚数、实付和退回都从链上读出来。 | 第 3 幕，清算价 0.00002，成交 50,000 枚，实付 1 BNB，退回 0 BNB，入池 10 BNB |
| 1:30–1:45 | 点下一幕 | 窗口结束后一次结算。开盘价、入池和金库都在这里。 | 第 4 幕，已发射，开盘价 0.00008，入池 40 BNB，金库显示分叉上买卖产生的税款余额 |
| 1:45–2:00 | 点下一幕 | 三笔共 3 BNB，距离入池门槛还差约 1.34 BNB。每个人都能领回全部预算。 | 第 5 幕，已募 3 BNB，门槛约 4.34 BNB，可以复制退款指令 |
| 2:00–2:15 | 点下一幕 | 同一组出价，同价的单价比是 1，曲线是 1.8。这是模拟。 | 第 6 幕，同价单价比 1，曲线 1.7789 |
| 2:15–2:30 | 停在第 6 幕 | 组件包过了 Flap 检查器。测试网合约已验证。代理可以用 MCP 调用。这六幕在本机分叉上运行，真实测试网发射回执待补。 | 对照数字还在 |

## English

| Time | Click | Say | See |
| --- | --- | --- | --- |
| 0:00–0:15 | Open `/?demo=1` and stay on scene 1 | On a new listing, bots and snipers buy the cheap price in the first block. Later buyers pay more. On a curve, the first fill and the last fill can be 1.8 times apart. | Open auction, clearing price and ladder |
| 0:15–0:45 | Point at the ladder and the reserve. Do not click yet | An agent sends a limit and a budget. At the end there is one clearing, and every fill pays it. If the pool is too small, everyone is refunded. A success launches one Flap pool, and all tax goes to the vault. | Still scene 1 |
| 0:45–1:00 | Stay on scene 1 | Nine bids total 15.7 BNB. This auction needs at least 5 BNB. | 15.7 BNB in bids, 5 BNB threshold, indicative clearing price 0.00002 BNB per token |
| 1:00–1:15 | Click 下一幕. Point at 预算, 最高价 and 复制出价指令 | Enter a budget and a limit, then hand the instruction to the agent. Each identity bids once. The testnet Binance Agent ID is a stand-in. Identity assurance depends on its issuer. | Scene 2, copy instruction |
| 1:15–1:30 | Click 下一幕 | The agent simulates first. Price, tokens, spend and refund are read from the chain. | Scene 3. 清算价 0.00002, 成交 50,000 枚, 实付 1 BNB, 退回 0 BNB, 入池 10 BNB |
| 1:30–1:45 | Click 下一幕 | After the window, one settlement. Open price, pool and vault are here. | Scene 4. 已发射, open price 0.00008, 40 BNB in the pool, live vault balance from trades on the fork |
| 1:45–2:00 | Click 下一幕 | Three bids total 3 BNB, about 1.34 BNB short of the pool minimum. Each bidder can claim a full refund. | Scene 5. 3 BNB in bids, minimum about 4.34 BNB, button 复制退款指令 |
| 2:00–2:15 | Click 下一幕 | On the same bids the uniform ratio is 1 and the curve is 1.8. This is a simulation. | Scene 6. 同价单价比 1, 曲线单价比 1.7789 |
| 2:15–2:30 | Stay on scene 6 | The component passed Flap's checker. The testnet contracts are verified. An agent can call the MCP server. These six scenes run on a local fork. A live testnet launch receipt is pending. | The comparison stays on screen |

## 出事预案

- 本机分叉没起来时，再跑 `bash script/demo.sh`。需要离线展示时，打开 [第 1 幕截图](../qa/submission/scene-1.png)，按同目录的 `scene-1.png` 至 `scene-6.png` 讲解，并说明是分叉截图。
- 页面读不到链：看顶栏是不是写着正在重试。换 `script/demo.sh` 打印的地址。不要改 RPC 到公网再当场演示。
- 桌面演示使用 1440 × 900。手机投影可直接打开演示页面，贴哈希核对仅用于手动核对回执。

## 30 秒

只留三句。开场用痛点那句。然后说：窗口结束一次清算，所有成交者一个价，卖不够全额退款。点五次「下一幕」到第 6 幕：同价单价比是 1，曲线是 1.8，这是模拟。

Thirty seconds: the pain sentence, one sentence on a single clearing with full refunds, then click 下一幕 five times and read the ratio on scene 6.
