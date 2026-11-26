# BSC 公共测试网发射回执

2026 年 11 月 26 日，同价发射在 BNB Smart Chain 测试网（链 97）经 Flap 发射。区块 144,926,064 的结算回执包含本场 Launcher 的 `AuctionSettled` 事件。链上 `statusCode()` 为 1，清算价为每枚 0.0000089 tBNB，4.45 tBNB 进入 PancakeSwap V2 池。[BscScan 结算与发射回执](https://testnet.bscscan.com/tx/0x56d87f21c4dbd55227d9e619986555f150c7da5ddec5db663b201a9b9985ae20)

| 步骤 | 区块 | 结果 |
| --- | ---: | --- |
| 登记测试身份 | 144,923,523 | 领取测试网 Agent ID 替身。[身份回执](https://testnet.bscscan.com/tx/0x4df7fbf222c358de87017d42267aabf006c525abdc505634369b1c6cfc78b2d0) |
| 创建拍卖 | 144,924,369 | 创建费 0.005 tBNB。工厂发出 `UniformLauncherCreated` 事件。[创建回执](https://testnet.bscscan.com/tx/0x5be4952fc75b9d2aec691ae0288eed53ee922e53552fce9812da24c1410ab93c) |
| 提交出价 | 144,924,882 | 一笔出价，预算 4.45 tBNB，最高价为每枚 0.000009 tBNB。[出价回执](https://testnet.bscscan.com/tx/0xac2f7be859199de2d0fc11c57fcdf59308b5f856b5928afa75aaecde40dafa01) |
| 结算并发射 | 144,926,064 | 实际入池 4.45 tBNB，达到 4.335714285714285715 tBNB 的入池门槛。[发射回执](https://testnet.bscscan.com/tx/0x56d87f21c4dbd55227d9e619986555f150c7da5ddec5db663b201a9b9985ae20) |
| 领取拍卖代币 | 144,927,029 | 出价者领取 500,000 UNIFORM。[领取回执](https://testnet.bscscan.com/tx/0x732353fc11a666984971d62c5b7a0016d76775145823938bf515ef776354f27f) |

同笔结算交易中，交易池的 `Sync` 事件记录了初始储备 500,000 枚 UNIFORM 和 4.45 枚 WBNB。[结算事件](https://testnet.bscscan.com/tx/0x56d87f21c4dbd55227d9e619986555f150c7da5ddec5db663b201a9b9985ae20#eventlog)

| 合约 | 公共测试网地址 |
| --- | --- |
| Launcher | [0xEc6410ACea44ac8aaD7f048f68CE45D3c113c59e](https://testnet.bscscan.com/address/0xEc6410ACea44ac8aaD7f048f68CE45D3c113c59e) |
| 代币 | [0x1f2BECb4418D444bd7659CaD892463dAeAF07777](https://testnet.bscscan.com/address/0x1f2BECb4418D444bd7659CaD892463dAeAF07777) |
| PancakeSwap V2 池 | [0xb46442c9Ba4fb3e26d65fe6ee2171f7d8Ee642b3](https://testnet.bscscan.com/address/0xb46442c9Ba4fb3e26d65fe6ee2171f7d8Ee642b3) |
| Vault | [0x18942571eE5E5642837326C2Fe18510270fEEEce](https://testnet.bscscan.com/address/0x18942571eE5E5642837326C2Fe18510270fEEEce) |

在发射区块读取 Flap Portal 的 `getLaunchVault(token)`，返回上表中的 Vault 和项目的 Vault 工厂。代币、池和 Vault 在该区块均有合约代码。分税到账及 owner 提款的验证来自本机分叉。[Vault 工厂](https://testnet.bscscan.com/address/0x2EF7a93b2fE4FBF520D5210b3ea39a72E5133dc6) · [分叉分税和提款回执](e2e-evidence.md)

领取回执同时包含 Launcher 的 `Claimed` 事件和代币的 `Transfer` 事件。在区块 144,927,029 读取出价者的代币余额，确认到账 500,000 UNIFORM。
