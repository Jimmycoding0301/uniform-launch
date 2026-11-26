# 端到端证据

`deployments/bsc-testnet-e2e.json` 里的哈希只在本机分叉上，BscScan 查不到。文件里的 `network` 是 `anvil-fork-of-97`。文件名不改，避免把已经写出去的链接打断。

合约的最低入池额约为 4.3357 tBNB，还要按保留价卖出 500,000 枚，并通过 Portal 毕业检查。下表 40 tBNB 的三人彩排与文末 4.6 tBNB 的单人方案分别核算。

本页发射回执来自本机分叉。公共测试网发射回执待项目方实际执行后补录。

## 三人彩排 · 本机测试网分叉

命令：`bash script/e2e-fork.sh`。RPC 是 `http://127.0.0.1:18546`，分叉 BSC 测试网，链编号 97。脚本先给已部署工厂打开 multiplier，再跑七个阶段。

| 阶段 | 交易哈希 | 结果 |
| --- | --- | --- |
| 创建 | `0xcf8b021e5341d1528d71d293abf84c15b1143ebf9e8e5cdfa4798613b51dc5ce` | Launcher `0x98a26CE56ccaA76C216d99529281a591b6dA1933`，创建费 0.005 BNB |
| Alice 领身份并出价 20 BNB | `0x258d746a0c68d4da15e89f11c685139d5d947617ea6a6733460d0b2a2b331563`、`0x383d5c05a5812bd77457b08cb72c6e2257e43adc43b702ef286c07be30ab27a9` | Agent ID 替身 |
| Bob 登记 ERC-8004 并出价 20 BNB | `0xb53e53059bfe035f16558a111b75ed42803a113fc7db009cef23fc1a4de174a6`、`0x8b3763073c3352e5ea30c7959b44c4969f8f86d4052160c73ec37b5bd9ac398b` | 身份编号 2930 |
| Carol 出价 1 BNB，最高价低于清算价 | `0x03a61b6f4588cd6ece0008bf3fe4dc55772dfa7d025cd666996be461ba6b89b0`、`0xdbc94998dfdd859ef2c4e4eff28ef5d1fc60d3c4ce9c95899712111a40dcb3ad` | 最高价 0.00002 BNB/枚 |
| 结算 | `0xc01654363438960f4dc9b36a78698d57ca35988d2920b5e9c19fa83184e593fc` | 清算价 0.00008 BNB/枚，入池 40 BNB |
| 领取 | `0xe255a22136b4deacbda3dd6b0162124d9ac3fcd6bcde7ad6413337175bbe8607`、`0x314f0a26eeaff1be52db9387337fa0e4fef7c8ed77c972432df0e1f2899602fe`、`0x9627eded465feddea82d3ba3b8cf2ee9a46d9b4fc8ba74c15539b4ecd2e3e0f0` | Alice 250000 枚，Bob 250000 枚，Carol 0 枚 |
| 买、卖、分税 | `0x707163a695d28d74107d27a3aa520dcce63df3b74eb0fcbc81c658fcefb00038`、`0xcd6e289e61faa79a3b0df421ecb26627d4a5cb1e5e8f63d91b05eaec002e47d6`、`0x76b3c337bbc37390b36469de719b61346c96bdd2c73d76fafbd4b2647ec62b9b`、`0xfe0efb120759131d9248ea0b774fea6892fe250a138f48fb7cf521527b2accd8` | 金库从 0 增到 27516256919450703 wei |
| 提走 | `0x12823ce9dbb89bc7147d0f28bd33c89656673914077eab3a58ab36615c4cbc08` | owner 余额增加 27516256919450703 wei，和金库减少的数额相同 |

代币 `0x1D9c9DA9ad42FeD14f4949a6ff23017bA3457777`。池子 `0x0f2644BA1350aaDE0B0a28eb87b2203dcEeac4D2`。金库 `0x5c9C4dE384D3c51d44765A07165d0a878D3080fe`。创建用的盐带上当时的区块，同一条链上可以再开一场，不会撞上一次的盐。

Carol 的最高价低于清算价，所以代币是 0。领取交易把她的预算退回。

原始记录在 `deployments/bsc-testnet-e2e.json`。这些哈希只存在于本机 anvil，BscScan 上查不到。

另在区块 144915595 的独立 Anvil 分叉上复核了原始 Solidity 脚本入口。沿用链上工厂配置，依次执行 `E2ETestnet.create()`、三次 `bid()`、`settle()`、`claim()`、`trade()` 和 `withdraw()`。清算价 0.00008 tBNB，入池 40 tBNB。Vault 提取前有 0.027516256919450703 tBNB，提取后为零，owner 收到相同金额（按实际回执加回 gas 核算）。逐阶段哈希、代币和池地址见[原脚本复核回执](../deployments/bsc-testnet-e2e-pinned-fork.json)。本次从官方已启用的 Launcher 工厂创建，与下方单人预算采用同一分叉起点。

## 4.6 tBNB 单人发射

创建者、出价人和领取人使用同一地址。这套方案只演示创建、领取测试身份、出价、结算和领取代币。含税买卖和 Vault 提取见上面的三人彩排。

| 参数 | 数值 |
| --- | ---: |
| 待售数量 | 500,000 枚 |
| 保留价 / 保留价对应的成交额 | 0.000008 tBNB / 枚 · 4 tBNB |
| 最低入池额 | 4.335714285714285715 tBNB |
| 唯一一笔出价 | 预算 4.45 tBNB，限价 0.000009 tBNB / 枚 |
| 预计清算价 / 入池 | 0.0000089 tBNB / 枚 · 4.45 tBNB |
| 创建费上限 | 0.005 tBNB |
| 五笔交易的 gas 上限合计 | 12,300,000 gas，每 gas 最高 10 gwei |
| 出价、创建费与 gas 的总预算上限 | 4.578 tBNB，准备 4.6 tBNB |

三人脚本的保留价是 0.00001 tBNB，对应成交门槛 5 tBNB。三人的预算分别是 20、20、1 tBNB，后续还有 1 tBNB 买卖演示。单人方案独立生成交易，使用相同的部署工厂与 Portal。

### 分叉状态

固定 BSC 测试网区块 144915595，2026-11-26 12:26:45（北京时间）。从 `https://bsc-testnet-rpc.publicnode.com` 读取的区块哈希为 [0x6fe1d57e3fea840d8d8e9a054c667bfad630c346223cf5fcdd5f7e9967d3f193](https://testnet.bscscan.com/block/144915595)。Launcher 工厂的 enabled 为 true，multiplierBps 为 1。Vault 工厂的 enabled 为 false，multiplierBps 为 10000。Portal 的 featureFlags 为 0，SALT_LOCK_FEE 为 0.005 tBNB。回放沿用这个区块的合约和配置。

从已初始化子模块的仓库根目录运行。重放器自行启动临时的 loopback Anvil，将测试地址余额设为 4.6 tBNB，结束后关闭。它会逐笔核对回执，检查代币余额、实际入池额、Vault、池合约代码以及 gas 后的地址余额。

```sh
(cd agent && npm ci)
node script/budget-launch.mjs rehearse
```

五笔本地交易均成功。清算价为 0.0000089 tBNB，入池 4.45 tBNB，出价人领取 500,000 枚代币。五笔回执的 gas 合计 0.00567579 tBNB，签名地址从 4.6 tBNB 开始，最终余额为 0.13932421 tBNB。代币、池和 Vault 地址见[本次分叉回执](../deployments/bsc-testnet-budget-fork.json)。

| 阶段 | 本地分叉交易哈希 | gas 用量 |
| --- | --- | ---: |
| 创建 | `0x4c4b8f9fd9cbe04dd9b99350e0c24788c4a12a1223f1093c76c6b57f41ee2dd9` | 565,029 |
| 领取测试身份 | `0x20289787279cc229288bb838bc6076115b8532105ad2a7f3b5466e71329ed929` | 43,355 |
| 出价 | `0x7662266ba786885f801329e3ca7631f2212c722ead564919237ed6eab61a5c2c` | 265,883 |
| 结算并发射 | `0xe35e8f7d441c6959076b03752f3f899f7692aa10b73b6c400cf343b11599be0a` | 4,604,207 |
| 领取代币 | `0xa2a5cf70b41d7a63df90a1e7f4649e81aec6fe1845d48ed246e190f9fbc25aff` | 197,316 |

### 项目方签名

Jimmy 或指定操作者用同一地址完成创建、出价和领取。以下 `plan` 命令会模拟当前步骤并输出未签名交易。先准备好签名设备，查该地址在测试身份替身中的 `balanceOf`。余额为 0 时，先登记身份并等回执。已登记的地址从创建开始。

```sh
SIGNER=0x36ABB7cC5C3d3b944eC2c88cDB0DFE40f9a4712c
cast call 0x89c60E8E5aF13508900152e5FEE149bf5708d8a0 'balanceOf(address)(uint256)' "$SIGNER" --rpc-url https://bsc-testnet-rpc.publicnode.com
# 余额为 0 时，准备这笔登记并由操作者签名
node script/budget-launch.mjs plan identity --signer "$SIGNER"
# 身份就绪后创建。每一场换新 run 编号，同一场重试保持编号与时长。
node script/budget-launch.mjs plan create --signer "$SIGNER" --run 1 --duration 1200
# 从创建回执里的 UniformLauncherCreated 事件取本场地址，设为 LAUNCHER
node script/budget-launch.mjs plan bid --signer "$SIGNER" --launcher "$LAUNCHER"
# 等到 endBlock 后再准备结算
node script/budget-launch.mjs plan settle --signer "$SIGNER" --launcher "$LAUNCHER"
node script/budget-launch.mjs plan claim --signer "$SIGNER" --launcher "$LAUNCHER"
```

创建时可选 200 至 20,000 个区块，默认 200。人工签名建议用 1,200 个区块，前 1,180 个区块接单，按平均每块 0.45 秒估算约 9 分钟。以链上区块为准，出价须在 `endBlock - 20` 前上链，结算从 `endBlock` 开始。已经创建的场次也支持 `plan identity --signer "$SIGNER" --launcher "$LAUNCHER"`，拍卖窗口会继续计时。

逐笔等实际回执成功。可将每一步输出交给代理预览。核对链 97、目标、金额、calldata、gas 上限及价格后，由操作者使用支持 BSC 测试网的签名工具确认。创建准备时会读取当时的工厂状态、Portal 暂停位和创建费。出价前会检查窗口。结算前会核对预期清算结果。如果公开场次出现其他出价，先重新评估该场的清算预览。结算后检查 Launcher 的 `statusCode() = 1`、`AuctionSettled` 事件以及 token、pool 地址，再准备领取。若实际状态是 2，出价人按失败场流程申请退款。领取后核对 500,000 枚代币到账。公共测试网的创建、结算哈希与 BscScan 链接待实际回执。
