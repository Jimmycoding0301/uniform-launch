# 同价发射

公开限价的单次统一价格批量拍卖。代理提交预算和最高价，窗口结束后按一个清算价成交。卖完固定的一半供应后，Launcher 调用一次 Flap `launchTaxTokenV2`。卖不完则全额退款。税进入 Vault，创建者直接提取。

说明在 [docs/brief.md](docs/brief.md)。

## 测试

```sh
forge install
forge test --fuzz-runs 128
BSC_TESTNET_RPC_URL=https://bsc-testnet-rpc.publicnode.com forge test --match-contract UniformForkTest
```

Fork 测试只读 BSC 测试网，在本地模拟，不向活网发交易。本地 fuzz 次数是 1024。

## 结算 gas

32 笔出价、拍卖成功并完成 `launchTaxTokenV2` 时，`settle` 的实测消耗：

| 环境 | gas |
| --- | --- |
| 本地假 Portal | 1,576,830 |
| BSC 测试网分叉，真实 Portal | 5,772,154 |

合约在进入 `settle` 时要求 `gasleft() >= 7,000,000`。页面复制的指令把 gas limit 写成 8,000,000。5,772,154 低于 7,000,000，也低于 8,000,000。gas limit 用估算值时往往到不了 7,000,000，调用会在改状态之前revert，拍卖保持开放。

安全说明在 [docs/security.md](docs/security.md)。

## 发射下限

Portal 按 `poolQuote × 700 × poolToken / totalSupply` 把入池 BNB 折成美元。本项目一半供应进池，所以乘数是 350。

| 条件 | 美元 | 入池 BNB |
| --- | --- | --- |
| 能发射，未毕业 | 750 | 2.142857142857142857 |
| 毕业，只在发射时判断 | 1500 | 4.285714285714285714 |
| 本合约最低入池 `minPoolQuote()` | 毕业线再加 0.05 | 4.335714285714285715 |

软顶 `softCap = floorPrice × 500000` 是保留价下卖完这一半时最少募到的 BNB。成功结算时入池的 BNB 大约就是实际花掉的报价。`softCap` 低于 `minPoolQuote()` 时，账面即使成交，`settle` 也会预检失败并全额退款，不会把 BNB 打进会 revert 的 `launchTaxTokenV2`。保留价建议至少 `minPoolQuote() / 500000`，约 `0.000008671428571428` BNB/枚。

`dexId = 0` 是 PancakeSwap V2 测试网：Router `0xD99D1c33F9fC3444f8101754aBC46c52416550D1`，Factory `0x6725F303b657a9451d8BA641348b6761A6CC7a17`，WBNB `0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd`。

创建费 `SALT_LOCK_FEE` 是 0.005 BNB，测试网和主网一样。

## 测试网部署

工厂要 Flap 来开权限。先部署两个工厂，把 `launcherFactory` 交给他们。脚本不会自己广播。

```sh
export DEPLOYER_PRIVATE_KEY=0x...
forge script script/DeployTestnet.s.sol \
  --rpc-url https://bsc-testnet-rpc.publicnode.com \
  --broadcast \
  --verify
```

私钥只从 `DEPLOYER_PRIVATE_KEY` 读取，日志不打印它。地址写到 `deployments/bsc-testnet.json`。

验证：

```sh
forge verify-contract --chain 97 --watch \
  <vaultFactory> src/uniform/UniformVaultFactory.sol:UniformVaultFactory \
  --constructor-args $(cast abi-encode "constructor(address)" <launcherFactory>)

forge verify-contract --chain 97 --watch \
  <launcherFactory> src/uniform/UniformLauncherFactory.sol:UniformLauncherFactory \
  --constructor-args $(cast abi-encode "constructor(address)" <vaultFactory>)
```

需要 `ETHERSCAN_API_KEY`。BscScan 的测试网验证走 chain 97。

脚本按 `block.chainid` 选择身份合约。56 上 Agent ID 和 ERC-8004 都指向官方地址。97 上 ERC-8004 指向官方 Identity Registry；主网 Agent ID 合约在测试网没有代码，所以另部署只含 `balanceOf` 的 `AgentIdStandIn`，页面右上写「测试网 Agent ID 为替身」。创建某一场时，把 `identitySources` 设成当时要接受的来源，创建后不能改。出价是 `bid(uint256 maxPrice, uint8 sourceIndex, uint256 agentId)`，代理自己申报编号。

## ERC-8004 注册表

官方规范：[ERC-8004: Trustless Agents](https://eips.ethereum.org/EIPS/eip-8004)。合约：[IdentityRegistryUpgradeable.sol](https://github.com/erc-8004/erc-8004-contracts/blob/master/contracts/IdentityRegistryUpgradeable.sol)。地址表：[Contract addresses](https://erc-8004.quicknode.com/docs/contracts)，和 [bnb-chain/erc-8004-contracts](https://github.com/bnb-chain/erc-8004-contracts) 一致。

| 网络 | Identity Registry |
| --- | --- |
| BNB Chain 主网 | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| BNB Chain 测试网 | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |

2026-11-25 在测试网读过这份代理：`getVersion()` 返回 `2.0.0`，名字 `AgentIdentity`，符号 `AGENT`。`ownerOf(uint256)` 和 `getAgentWallet(uint256)` 都返回 address。`register()` 的 eth_call 能铸出下一个编号。`tokenOfOwnerByIndex` 会 revert，合约不从地址反查。NFT 转走时 `agentWallet` 被清空。拍卖不部署自己的注册表。代理在 `bid` 里传入 `agentId`，合约核对 `ownerOf(agentId) == msg.sender` 或 `getAgentWallet(agentId) == msg.sender`。同一 `(sourceId, agentId)` 只能有一笔出价。

## 币安 Agent ID

SPACE ID 文档：[Agent ID](https://docs.space.id/agent-id)。BNB 主网合约 `0x60b9262456de011f7d15a54cdd8c48baaa8b022f`，名字 `SPACE ID Agent ID`，符号 `AI`，soulbound ERC-721。2026-11-25 用主网 RPC 只读核对：`balanceOf` 对持有者返回 1，`ownerOf(tokenId)` 返回该钱包，`supportsInterface(0x780e9d63)` 为 false，`tokenOfOwnerByIndex` 会 revert。适配器用 `balanceOf(msg.sender) > 0` 判断资格；枚举可用时取 `tokenOfOwnerByIndex(account, 0)` 作 agentId，否则用 `uint160(msg.sender)`。测试网这条地址上没有代码。部署脚本在 chain 97 部署替身，主网配置指向真合约。没有管理员可以事后往一场拍卖里加来源。

## 界面技能

装在仓库 `.agents/skills/`。

- `npx skills add nextlevelbuilder/ui-ux-pro-max-skill` 写进 `.agents/skills/ui-ux-pro-max`，同一次还带上了 `banner-design`、`brand`、`design`、`design-system`、`slides`、`ui-styling`。
- `npx skills add anthropics/skills --skill frontend-design` 写进 `.agents/skills/frontend-design`。

## 本地页面

```sh
bash script/local-fork.sh
cd web && npm install && npm run dev
```

页面在 `http://127.0.0.1:4317`。anvil 分叉在 `127.0.0.1:18545`。页面角标写明这是本地分叉。

## 三分钟演示

台上只打开本机页面，只复制指令。不向活网发交易，不导出、不粘贴私钥。地址写在 `web/public/demo.json`，页面里也可以从右上角「演示脚本」打开同一份顺序。

1. 0:00 打开接单场 `http://127.0.0.1:4317/?launcher=0x4154C58F204fcfcA9739b2EA4F835936ee4a7998`。看到台阶、当前清算价，以及灰色等宽的无名字地址。
2. 0:45 预算填 `1`，最高价填 `0.00009`，点「复制出价指令」。剪贴板写的是测试网 chainId 97、`bid(uint256)`、这场合约地址。按钮变成「已复制 ✓」。不执行。
3. 1:20 本机分叉若再进一笔，新行会有 1.2 秒金色底色淡出。不要为了这一下更换 RPC。
4. 1:40 打开已发射 `http://127.0.0.1:4317/?launcher=0xE20f0043F32E2E38d3F3d76Ec48Cfcdb0FdC4806`。看到「开盘价 BNB/枚」、淡台阶、结果卡里的「入池 BNB」，以及「本场参数」里的「入池代币」。点「复制领取指令」，内容是 `claim()`。不执行。
5. 2:20 打开失败场 `http://127.0.0.1:4317/?launcher=0x6f10Eb8eD5c3B033a9EAB172544A4a86420eb128`。看到「结果 / 没有成交」。点「复制退款指令」，内容是 `refund()`。不执行。
6. 2:45 回到接单场，停在三份指令都只在剪贴板里。
