# 演示稿

主稿 2 分 30 秒。口播按每分钟 220 个汉字、150 个英文单词估算，写在文末。不说收益，不用感叹号。

## 中文

| 时间 | 屏幕上点什么 | 嘴上说什么 | 屏幕上应该看到什么 |
| --- | --- | --- | --- |
| 0:00–0:15 | 打开 `/?demo=1`，停在第 1 幕 | 新币开盘时，机器人和狙击手会在第一个区块买走低价，后来的人接高价。曲线上第一个人和最后一个人的单价可以差到 1.8 倍。 | 接单场，清算价和阶梯 |
| 0:15–0:45 | 指一下阶梯和保留价，先不点按钮 | 代理提交限价和预算。窗口结束只清算一次，成交的人都付这个价。卖不够就全额退款。成功后经 Flap 一笔建池，税全部进金库。 | 仍是第 1 幕 |
| 0:45–1:00 | 停在第 1 幕 | 这是接单场。横线是当前清算价，阶梯是需求。 | 清算价 0.00002。图上成交 11 BNB 是过线预算，入池是 10 BNB。 |
| 1:00–1:15 | 点下一幕。指预算和复制按钮 | 填预算和最高价，把这段交给代理。每个身份只能出一笔：Binance Agent ID 或 ERC-8004 编号，一场固定一种来源。测试网 Agent ID 是演示替身，防女巫要在主网上才成立。 | 第 2 幕，复制出价指令 |
| 1:15–1:30 | 点下一幕 | 代理先模拟。这一笔的清算价、成交枚数、实付和退回都从链上读出来。 | 第 3 幕，清算价 0.00002，成交 50,000 枚，实付 1 BNB，退回 0 BNB，入池 10 BNB |
| 1:30–1:45 | 点下一幕 | 窗口结束后一次结算。开盘价、入池和金库都在这里。 | 第 4 幕，已发射，开盘价 0.00008，入池 40 BNB，金库余额 0.0275 BNB |
| 1:45–2:00 | 点下一幕 | 入池不够就没有代币。每个人拿回全部预算。 | 第 5 幕，没有成交，出价全额退回，按钮是复制退款指令 |
| 2:00–2:15 | 点下一幕 | 同一组出价，同价的单价比是 1，曲线是 1.8。这是模拟。 | 第 6 幕，同价单价比 1，曲线 1.7789 |
| 2:15–2:30 | 停在第 6 幕 | 组件包过了 Flap 检查器。测试网合约已验证。代理可以用 MCP 调用。下一步是等 Flap 开权限。 | 对照数字还在 |

## English

| Time | Click | Say | See |
| --- | --- | --- | --- |
| 0:00–0:15 | Open `/?demo=1` and stay on scene 1 | On a new listing, bots and snipers buy the cheap price in the first block. Later buyers pay more. On a curve, the first fill and the last fill can be 1.8 times apart. | Open auction, clearing price and ladder |
| 0:15–0:45 | Point at the ladder and the reserve. Do not click yet | An agent sends a limit and a budget. At the end there is one clearing, and every fill pays it. If the pool is too small, everyone is refunded. A success launches one Flap pool, and all tax goes to the vault. | Still scene 1 |
| 0:45–1:00 | Stay on scene 1 | This is the live book. The line is the clearing price. The steps are demand. | Clearing price 0.00002. The chart's 成交 11 BNB is qualifying budget. The pool is 10 BNB. |
| 1:00–1:15 | Click 下一幕. Point at 预算 and 复制出价指令 | Enter a budget and a limit, then hand this text to the agent. Each identity bids once: a Binance Agent ID or an ERC-8004 number, one source for the auction. The testnet Agent ID is a stand-in. Sybil checks hold on mainnet. | Scene 2, copy instruction |
| 1:15–1:30 | Click 下一幕 | The agent simulates first. Price, tokens, spend and refund are read from the chain. | Scene 3. 清算价 0.00002, 成交 50,000 枚, 实付 1 BNB, 退回 0 BNB, 入池 10 BNB |
| 1:30–1:45 | Click 下一幕 | After the window, one settlement. Open price, pool and vault are here. | Scene 4. 已发射, open price 0.00008, 40 BNB in the pool, 金库余额 0.0275 BNB |
| 1:45–2:00 | Click 下一幕 | If the pool is short, there is no token. Everyone gets the full budget back. | Scene 5. 没有成交, 出价全额退回, button 复制退款指令 |
| 2:00–2:15 | Click 下一幕 | On the same bids the uniform ratio is 1 and the curve is 1.8. This is a simulation. | Scene 6. 同价单价比 1, 曲线单价比 1.7789 |
| 2:15–2:30 | Stay on scene 6 | The component passed Flap's checker. The testnet contracts are verified. An agent can call the MCP server. Next we wait for Flap to enable the factory. | The comparison stays on screen |

## 出事预案

- 本机分叉没起来：再跑 `bash script/demo.sh`。没有 `web/node_modules` 时它会先安装页面依赖。还不行就打开已经截好的 `qa/r15/demo-1-1440.png`，按稿说，不要假装链在动。
- 页面读不到链：看顶栏是不是写着正在重试。换 `script/demo.sh` 打印的地址。不要改 RPC 到公网再当场演示。
- 投影分辨率不对：优先 1440 宽。如果只能投手机宽，用 `qa/r15/demo-1-390.png` 那一组，主按钮在演示条上面。桌面底部的「已发送？贴哈希核对」可能在演示条后面，往上滚一下再点。主按钮不被挡住。

## 30 秒

只留三句。开场用痛点那句。然后说：窗口结束一次清算，所有成交者一个价，卖不够全额退款。点五次「下一幕」到第 6 幕：同价单价比是 1，曲线是 1.8，这是模拟。

Thirty seconds: the pain sentence, one sentence on a single clearing with full refunds, then click 下一幕 five times and read the ratio on scene 6.

## 字数

中文主稿口播 288 个汉字，按每分钟 220 字，约 1.3 分钟。英文主稿口播 220 个单词，按每分钟 150 词，约 1.5 分钟。第 2 幕用身份那句换掉了「页面不签名」，时间轴仍到 2 分 30 秒。多出来的时间用来指屏幕。都低于 3 分钟。30 秒附录另计。
