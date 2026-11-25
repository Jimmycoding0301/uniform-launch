# 演示稿

主稿 2 分 30 秒。口播按每分钟 220 个汉字、150 个英文单词估算，写在文末。不说收益，不用感叹号。

## 中文

| 时间 | 屏幕上点什么 | 嘴上说什么 | 屏幕上应该看到什么 |
| --- | --- | --- | --- |
| 0:00–0:15 | 打开 `/?demo=1`，停在第 1 幕 | 新币开盘时，机器人和狙击手会在第一个区块买走低价，后来的人接高价。曲线上第一个人和最后一个人的单价可以差到 1.8 倍。 | 接单场，清算价和阶梯 |
| 0:15–0:45 | 指一下阶梯和保留价，先不点按钮 | 代理提交限价和预算。窗口结束只清算一次，成交的人都付这个价。卖不够就全额退款。成功后经 Flap 一笔建池，税全部进金库。 | 仍是第 1 幕 |
| 0:45–1:00 | 停在第 1 幕 | 这是接单场。横线是当前清算价，阶梯是需求。 | 清算价 0.00002，需求阶梯 |
| 1:00–1:15 | 点下一幕。指预算和复制按钮 | 填预算和最高价，把这段交给代理。页面不签名。 | 第 2 幕，复制出价指令 |
| 1:15–1:30 | 点下一幕 | 代理先模拟。这一笔的清算价、成交枚数、实付和退回都从链上读出来。 | 第 3 幕，终端回执 |
| 1:30–1:45 | 点下一幕 | 窗口结束后一次结算。开盘价、入池和金库都在这里。 | 第 4 幕，已发射，入池 40 BNB |
| 1:45–2:00 | 点下一幕 | 入池不够就没有代币。每个人拿回全部预算。 | 第 5 幕，没有成交 |
| 2:00–2:15 | 点下一幕 | 同一组出价，同价的单价比是 1，曲线是 1.8。这是模拟。 | 第 6 幕，三行对照 |
| 2:15–2:30 | 停在第 6 幕 | 组件包过了 Flap 检查器。测试网合约已验证。代理可以用 MCP 调用。下一步是等 Flap 开权限。 | 对照数字还在 |

## English

| Time | Click | Say | See |
| --- | --- | --- | --- |
| 0:00–0:15 | Open `/?demo=1` and stay on scene 1 | On a new listing, bots and snipers buy the cheap price in the first block. Later buyers pay more. On a curve, the first fill and the last fill can be 1.8 times apart. | Open auction, clearing price and ladder |
| 0:15–0:45 | Point at the ladder and the reserve. Do not click yet | An agent sends a limit and a budget. At the end there is one clearing, and every fill pays it. If the pool is too small, everyone is refunded. A success launches one Flap pool, and all tax goes to the vault. | Still scene 1 |
| 0:45–1:00 | Stay on scene 1 | This is the live book. The line is the clearing price. The steps are demand. | Clearing price 0.00002 and the ladder |
| 1:00–1:15 | Next scene. Point at the budget and the copy button | Enter a budget and a limit, then hand this text to the agent. The page does not sign. | Scene 2, copy instruction |
| 1:15–1:30 | Next scene | The agent simulates first. Price, tokens, spend and refund are read from the chain. | Scene 3, the receipt |
| 1:30–1:45 | Next scene | After the window, one settlement. Open price, pool and vault are here. | Scene 4, launched, 40 BNB in the pool |
| 1:45–2:00 | Next scene | If the pool is short, there is no token. Everyone gets the full budget back. | Scene 5, no fill |
| 2:00–2:15 | Next scene | On the same bids the uniform ratio is 1 and the curve is 1.8. This is a simulation. | Scene 6, three lines |
| 2:15–2:30 | Stay on scene 6 | The component passed Flap's checker. The testnet contracts are verified. An agent can call the MCP server. Next we wait for Flap to enable the factory. | The comparison stays on screen |

## 出事预案

- 本机分叉没起来：再跑 `bash script/demo.sh`。还不行就打开已经截好的 `qa/r15/demo-1-1440.png`，按稿说，不要假装链在动。
- 页面读不到链：看顶栏是不是写着正在重试。换 `script/demo.sh` 打印的地址。不要改 RPC 到公网再当场演示。
- 投影分辨率不对：优先 1440 宽。如果只能投手机宽，用 `qa/r15/demo-1-390.png` 那一组，主按钮在演示条上面。

## 30 秒

只留三句。开场用痛点那句。然后说：窗口结束一次清算，所有成交者一个价，卖不够全额退款。最后指第 6 幕：同价单价比是 1，曲线是 1.8，这是模拟。

Thirty seconds: the pain sentence, one sentence on a single clearing with full refunds, then the ratio on scene 6.

## 字数

中文主稿口播 254 个汉字，按每分钟 220 字，约 1.2 分钟。英文主稿口播 195 个单词，按每分钟 150 词，约 1.3 分钟。时间轴排到 2 分 30 秒，多出来的时间用来指屏幕，不另加句子。都低于 3 分钟。30 秒附录另计。
