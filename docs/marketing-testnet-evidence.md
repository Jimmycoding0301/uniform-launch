# MARKETING 工厂的公开测试网回执

新版 Uniform Launch 已在 BSC 测试网（链 97）部署工厂、创建拍卖并收下一笔 4.45 tBNB 出价。新版与此前公开发射的 Vault 版是两套部署。[旧版完整发射](public-testnet-evidence.md)

| 步骤 | 区块 | 链上证据 |
| --- | ---: | --- |
| 部署 Launcher Factory | 145037925 | 工厂 `0x5A995C7ee958a631FDD151C9582604d347D7799A`。[部署回执](https://testnet.bscscan.com/tx/0xe751bc11de1d8f43952c732e0d304ab1be500507d36109086c207ed340498773) |
| 创建拍卖 | 145038938 | Flap Portal 登记 Launcher `0xADD4e8b95B194D457611b4754e53c45A6E2A41d6`。[创建回执](https://testnet.bscscan.com/tx/0x45c339b0d4a62da600714bd411f1d7ab966b51907a5b61379f2b09e4b362bb41) |
| 提交出价 | 145038962 | 预算 4.45 tBNB，限价 0.000009 tBNB/枚。[出价回执](https://testnet.bscscan.com/tx/0xad339052f8b9e34197476bfd1defffd126373c7b87af77fd74ad0a5a5e4b8ed9) |
| 结算、发射和领取 | 待确认 | `endBlock` 为 145040138。该笔出价的链上预览为 0.0000089 tBNB/枚、4.45 tBNB 入池；以成功结算和领取回执为准。预测代币地址 `0x81fD4df6F9E4De108C7790961856D92690867777`。 |

新版的项目侧买卖税各为 3%，持续 30 天。Flap 的 `MARKETING` 槽把分配的交易税发给该场拍卖的创建者，本场创建者正好是部署者。测试网这场的名单为空，仍须通过已配置的身份来源验证。主网必须在创建时填写固定钱包名单。[部署记录](../deployments/bsc-testnet-marketing.json) · [机制与预审答复](preaudit-response.md)
