# 60 秒评审演示 · One-minute judge walkthrough

运行 `bash script/demo.sh`，在它打印的页面地址后打开 `/?demo=1&scene=3`。第 3 幕在本机分叉的九笔出价上加入你的模拟单。另开两个标签页，准备展示 BSC 公共测试网的真实交易。[发射回执 / Settlement](https://testnet.bscscan.com/tx/0x56d87f21c4dbd55227d9e619986555f150c7da5ddec5db663b201a9b9985ae20) · [领取回执 / Claim](https://testnet.bscscan.com/tx/0x732353fc11a666984971d62c5b7a0016d76775145823938bf515ef776354f27f)

| 时间 | 操作 / Action | 中文口播 | English |
| --- | --- | --- | --- |
| 0–8 秒 | 第 3 幕，预算填 `1` BNB / Set budget to `1` | 一枚 BNB 能买多少？每个身份出一次价，填预算和最高价。我们在分叉上试两次。 | How much does one BNB buy? Each identity submits one budget and one price limit. Let’s try two limits on this local fork. |
| 8–22 秒 | 最高价填 `0.00003` / Set the limit | 我愿意出到 0.00003。清算价只有 0.00002，所有成交者都付这个价。我实付 1 BNB，得到五万枚。 | My limit is 0.00003. Everyone who fills pays the clearing price of 0.00002. My one BNB buys 50,000 tokens. |
| 22–35 秒 | 只把最高价改为 `0.000015` / Lower only the limit | 预算不动，把限价降到 0.000015。清算价没变，我这笔成交零枚，1 BNB 全退。 | Same budget, lower limit. The clearing price holds. My bid falls below it, so I get zero tokens and my full BNB back. |
| 35–53 秒 | 切到发射回执，再切到领取回执 / Show both BscScan receipts | 另一场已经在 BSC 公共测试网结算。Flap 建池，4.45 tBNB 入池，清算价 0.0000089。第二张回执里，出价人领到了五十万枚 UNIFORM。 | Here’s a separate auction on BSC Testnet. Flap launched the pool with 4.45 tBNB at a clearing price of 0.0000089. The claim receipt shows 500,000 UNIFORM delivered to the bidder. |
| 53–60 秒（可选） | 回本地页，点第 5 幕 / Return to scene 5 | 最后看整场退款。三笔共 3 BNB，没到约 4.34 BNB 的入池门槛，每个人都能全额领回。 | Here the entire auction misses its minimum. Three bids total 3 BNB against a 4.34 BNB threshold. Every bidder can claim a full refund. |
