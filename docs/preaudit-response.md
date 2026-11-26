# Flap 预审答复与四笔出价验算

本分支是 128 笔安全加固候选版。公开 BSC 测试网收据记录的是此前的 32 笔版本。本轮分叉合约使用本地筛查和身份测试件。公开部署要先确定 Flap 名称筛查服务和新工厂审核状态。[公开发射](public-testnet-evidence.md) · [Flap 工厂接入要求](https://docs.flap.sh/en/flap/v2/developers/pool-launch/build-on-pool-launch)

| 预审项 | 候选版改动 | 验收或依赖 |
| --- | --- | --- |
| 名称和符号 | 工厂在创建 Launcher、锁 salt 前分别通过不可变名称策略检查名称和符号。命中拒绝创建，服务调用失败也会回滚。 | 本地测试覆盖两类命中和服务不可用。Flap 的正式 `isScamWord` 合约、API 或适配方式待官方核对。部署必须给出有代码的 `FLAP_NAME_POLICY`。 |
| Binance Agent ID | 主网按 NFT 的真实 `tokenId` 调用 `ownerOf` 并按该编号去重。地址编号只供链 97 的历史测试替身兼容使用。 | Binance 公告说明该产品是不可转让 ERC-721。合约仍依赖真实 token ID 来去重。[Binance 公告](https://www.binance.com/en/square/post/389517582957261) |
| ERC-8004 和席位 | 128 笔容量。创建时固定最多 128 个合格钱包，同一钱包只占一席。主网必须配置名单。测试网可运行名单场和开放测试场。 | 自注册 ERC-8004 仅能证明某个代理编号。入选要另经组织者核验。名单场能为每个入选钱包保留一个席位，无法证明每个钱包背后都是不同的人。[ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) |
| 报价与 gas | 使用 Portal 当前原生币报价、创建线、毕业线。把较大门槛向上折算为 BNB，再加 0.05 BNB 的业务余量。报价不可用时继续开放结算重试。 | 保留 13M 入口防误判门槛和 14M 客户端建议。分别使用测试网、主网分叉测量 128 笔，主网测试的工厂启用只发生在分叉中。 |
| Vault 和募集余量 | Vault owner 先提名，新 owner 主动接收。Guardian 的紧急提现仍只转给当时的 owner。销售配额余量可单独转到固定销毁地址。 | 验证了提名取消、权限切换、Guardian 受益人、余量处理前后领取余额。请 Flap 确认两步交接的受益人权限设计。 |

在 BSC 测试网和主网分叉分别以 128 个测试钱包各出价 0.2 BNB。两个场次均通过 Flap 建池，池中本金 25.6 BNB，末位出价者完成领取。测试网结算调用使用 **8,700,891 gas**，主网结算调用使用 **9,949,826 gas**。这两次启用工厂均由测试环境模拟，正式上链仍需 Flap 审核。全套 Forge 测试结果为 **75 通过、0 失败**。[分叉测试](../test/Uniform.fork.t.sol)

## 四笔出价

保留价为 **0.00001 BNB/枚**，销售配额 **500,000 枚**。合约托管 10 BNB。以下示例沿用 500,000 枚固定池配额，协议费为零。

| 出价 | 托管预算 | 限价（BNB/枚） | 成交金额 | 获得代币，约 | 通过 `claim()` 取回 |
| --- | ---: | ---: | ---: | ---: | ---: |
| A | 4 BNB | 0.00003 | 4 BNB | 285,714.285714 | 0 BNB |
| B | 3 BNB | 0.00002 | 3 BNB | 214,285.714286 | 0 BNB |
| C | 2 BNB | 0.000012 | 0 BNB | 0 | 2 BNB |
| D | 1 BNB | 0.00001 | 0 BNB | 0 | 1 BNB |

**资金合计为 10 BNB = 7 BNB 入池 + 3 BNB 待领回。** A+B 的全额前缀给出 **0.000014 BNB/枚**。把 C 加进去得到 0.000018，超过 C 的限价。卡在 C 的 0.000012 时，A+B 已足以买超过 50 万枚，因此 C 也进不了边际成交。两位成交者使用同一清算价，实际分配向下取整，剩下 **1 个最小代币单位（10⁻¹⁸ 枚）**。此例限价各异。遇到全额前缀的同价边界时，下单顺序仍可能改变分配。

成功结算且通过 Flap 时，**7 BNB + 500,000 枚**是初始池储备，初始储备现货比率为 **0.000014**。首次实际买卖的成交价格还受价格冲击、DEX 手续费和代币税影响。Vault owner 可以提取后续到账的税，Guardian 只能把 Vault 余额转给当时的 owner。

### 买家确认前

页面使用**最高可扣预算**。在本例中 A 和 B 花满预算。边际部分成交可能退差额，零成交则退全部预算。出价提交后资金由合约托管，窗口内不可撤单。到期后要有一笔结算交易才能领取。页面根据拍卖状态展示当前应该调用的方法。

- **整场成功**，包括零成交的 C、D，都走 `claim()`。同一笔调用领取代币和未用预算。
- **整场失败**，例如仅收到 C、D 的 3 BNB，有效需求不足以按保留价卖出 50 万枚。结算标记失败后走 `refund()`，各取回 2 BNB 和 1 BNB。网络 gas 由各交易承担。Guardian 提前取消时，失败状态也允许即时退款。

### 0.1% 收费路线

如日后从 7 BNB 成交款扣 0.007 BNB，固定 50 万枚池配额对应的初始储备比率就是 **0.000013986 BNB/枚**。要保留 **开盘现货比率等于清算价**，可以让创建者从独立资金付 0.1% 成功费，或调整初始池的代币配额。当前合约按零协议费结算，本分支不启用收费。收费设计要先明确资金来源、失败处理和入池比率，再纳入下一轮审查。[收费路线图](roadmap.md)


## 待 Flap 确认

> For Pool Launch on BSC Testnet (chain 97), what is the supported `isScamWord` integration for a custom Launcher Factory? Please send the contract address and verified ABI (or the official API), the expected name and symbol inputs, and the distinction between a blocked value and an unavailable service. Our factory checks both fields before the salt lock and reverts if the check is unavailable.
>
> For the Vault, the current owner nominates a new owner and the nominee must accept. The Guardian can send the full balance only to the current owner. Can you confirm how this two-step ownership policy should satisfy your Guardian requirements?
