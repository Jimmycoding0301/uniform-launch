# MARKETING 工厂的公开测试网回执

Uniform Launch 已在 BSC 测试网（链 97）完成公开发射。清算价为 0.0000089 tBNB/枚，4.45 tBNB 与 500,000 枚代币进入 PancakeSwap V2 池，出价人领取另外 500,000 枚。

| 步骤 | 区块 | 链上证据 |
| --- | ---: | --- |
| 部署 Launcher Factory | 145037925 | 工厂 `0x5A995C7ee958a631FDD151C9582604d347D7799A`。[部署回执](https://testnet.bscscan.com/tx/0xe751bc11de1d8f43952c732e0d304ab1be500507d36109086c207ed340498773) |
| 创建拍卖 | 145038938 | Flap Portal 登记 Launcher `0xADD4e8b95B194D457611b4754e53c45A6E2A41d6`。[创建回执](https://testnet.bscscan.com/tx/0x45c339b0d4a62da600714bd411f1d7ab966b51907a5b61379f2b09e4b362bb41) |
| 提交出价 | 145038962 | 预算 4.45 tBNB，限价 0.000009 tBNB/枚。[出价回执](https://testnet.bscscan.com/tx/0xad339052f8b9e34197476bfd1defffd126373c7b87af77fd74ad0a5a5e4b8ed9) |
| 结算并发射 | 145040241 | `AuctionSettled` 记录统一清算价、入池 4.45 tBNB、代币和池地址。[发射回执](https://testnet.bscscan.com/tx/0x5cc2056b689db1a422e5dfbdbd7017a23f86fa9a764effaa6cc82c9c1051ec02) |
| 领取 | 145040258 | `Claimed` 记录 500,000 枚代币，退款为 0。[领取回执](https://testnet.bscscan.com/tx/0x5e1f06bfce8e6ee3dd379c82593ad35330639f169d22fd189493ec7f42f6bbd9) |

代币为 [`0x81fD4df6F9E4De108C7790961856D92690867777`](https://testnet.bscscan.com/address/0x81fD4df6F9E4De108C7790961856D92690867777)，池地址为 [`0x597e3a231D6bDDba2123A3055D854dc53Db17683`](https://testnet.bscscan.com/address/0x597e3a231D6bDDba2123A3055D854dc53Db17683)。

项目侧买卖税各为 3%，持续 30 天。Flap 的 `MARKETING` 槽把分配的交易税发给该场拍卖的创建者，本场创建者正好是部署者。测试网这场的名单为空，仍须通过已配置的身份来源验证。主网必须在创建时填写固定钱包名单。[部署记录](../deployments/bsc-testnet-marketing.json) · [机制与预审答复](preaudit-response.md)
