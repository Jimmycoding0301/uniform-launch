# 同价发射

给 Jimmy 的开工说明。按这份做，不要再加机制。

一句话：基于 Agent ID 的 BNB Chain 发行协议。代理提交限价单，一次清算决定开盘价，再把带税代币发进流动性池。

选定的东西是单次统一价格批量拍卖（uniform-price batch auction）。保留价（reserve price）以下不成交。卖完固定的一半供应才算成功，成功后 Launcher 从自己的地址调用一次 `launchTaxTokenV2`。卖不完就全额退款，不发币。税 100% 进 Vault，创建者随时提走，没有投票。

开发期按 2026-11-25 20:00 到 2026-11-27 08:00（上海）排。HackQuest 截止 2026-11-27 10:00 上海，曼谷 09:00。这轮只写说明，不部署，不发交易，不碰私钥。

## 结论

做公开限价的单次批量拍卖，不做密封出价，不做荷兰拍，不做短局游戏。

代理是定价主体：清算价只由出价的预算和最高价算出来。创建者只定保留价和窗口，不能改价，不能抽走出价里的 BNB。签名主路径是页面生成指令、代理 `baw contract-call preview` 再 `execute`、用户在币安 App 确认。浏览器插件钱包不做主按钮。

邻近机制里，它最接近 Gnosis EasyAuction 的单次批量拍卖，再加上 Flap 的「清算完立刻建池」。Uniswap CCA 是同一族的连续版本，36 小时做不完，不实现。

## 用词

| 词 | 在本项目里的意思 |
| --- | --- |
| 限价单 | 一笔出价 = 预算（BNB）+ 最高价。最高价是每 1 枚代币愿意出的 BNB |
| 统一清算价 | 成交的人付同一个价。高于这个价的整笔花掉；等于这个价的按比例成交；低于这个价的整笔退回 |
| 保留价 | 创建者设的最低清算价。到不了就整场失败 |
| 软顶 | 保留价乘以待售代币数量，即最低要募到的 BNB。页面用它做进度。价格没有硬顶 |
| 批量拍卖 | 窗口内收集订单，窗口结束后一次清算。不是每来一笔就成交 |
| 公平发射 | 这里只指：开盘价由这场拍卖决定，创建者没有单独的第一笔买入，LP 由 Portal 销毁 |

不叫密封拍卖。订单在链上是公开的。

## 邻近机制

数字和规则对过公开文档，时间截止 2026-11-25。

| 机制 | 实际怎么定价 | 和本项目的关系 |
| --- | --- | --- |
| Gnosis EasyAuction（`gnosis/ido-contracts`） | 卖固定数量。买家挂限价单。从高价往低价累加买单，直到盖住出售量，该档决定统一清算价。更高的单按这个价成交，更低的不成交。订单公开。在取消截止时间之前可以撤单。不是 commit-reveal | 结算规则的母本。我们改成不能撤单、报价用原生 BNB、成交的 BNB 直接做池子的报价侧 |
| CoW Protocol | 一批意图一起清算。同一方向的同一交易对用统一方向清算价（uniform directional clearing price）。求解器在链下竞争 | 只借「一批人一个价」。不做求解器，不做链下订单 |
| Fjord LBP / Balancer LBP | 权重随时间从高代币权重滑向高报价权重，价格从高往低走，买的人按当时的池价成交（类似荷兰拍）。起始价通常故意设高 | 方向 2 的成熟形态。价格路径是创建者事先定的，买家只是择时 |
| Uniswap CCA（2025-11-13 公布） | 把统一清算价拉到连续时间。每个区块按释放计划卖一小段，出价带预算和最高价，并摊到剩余区块。该区块一个清算价。未达募集要求则整笔退款。结束后用清算结果给 Uniswap v4 建池 | 要借的是「清算价就是开盘价」和「失败退款」。按区块释放、tick 链表、Q96 累加器不在 36 小时内 |

CCA 技术说明写明：统一价拍卖一般做不到策略无关，仍可能有压价；释放计划形状不好时，收尾阶段能被抢。单次批量拍卖把这个风险收成一件事：最后一刻可以加价，把清算价抬高。抬价的人自己也付新价格，不能买到比别人更低的价。这个缺口在下面写明，不靠密封出价去补。

## 三个方向

| | 1 密封竞价 | 2 荷兰拍 | 3 短局定盘 | 选定：公开限价批量拍卖 |
| --- | --- | --- | --- | --- |
| 新颖 | 密封在发币里少见，但 EasyAuction 已经把统一价做完了，密封是加在上面的一道手续 | LBP / 荷兰拍很常见 | 短局少见，但 2024 Q4 的 Clawdyland 已经是代理竞技场 | 统一价发进 Flap 池，这条组合没有现成获奖项目 |
| 两条赛道 | Flap 的 Launcher 完整。代理要签两次（提交、揭示），演示容易断 | Flap 完整。代理只是决定何时买，定价权在时间表 | 游戏规则一多，钱的去向就讲不清 | Launcher 从募资到建池是一条路径。清算价由代理的单子决定，接得上链上 Agent |
| 36 小时 | commit 和 reveal 是两套状态，再加 Agent 确认，时间不够 | 状态机最简单 | 要同时做公平的牌局和发射，容易两头都浅 | 结算是一个纯函数加一个状态机，可以先测纯函数 |
| 演示 | 两段确认，中间还要等揭示窗口 | 价格曲线好看，但观众看到的是时钟在降价 | 好看，评委下一句会问输家的钱在哪 | 曲线随着出价变，结算那一笔直接出代币和池子 |
| 风险 | 揭示失败会把资金卡住，规则要写得很死 | 和「一键曲线毕业」离得近，评委不好区分 | 和已有代理竞技场撞题 | 公开订单会被最后一刻加价。接受这个缺口 |

方向 1 的「税按出价贡献分给代理」和「创建者自由提税」冲突，不采用。方向 2 的「税进 Vault 自动回购」会把税锁进买盘，创建者拿不走，不采用。方向 3 的「税做下一局奖池」在一场演示里看不到下一局，不采用。

RWA 不往里塞。主奖主题有两半，这一场只接链上 Agent。报价资产是 BNB，发行的是项目代币。文案里不写 RWA，也不写 V4 Hook。Flap 这一笔是 `DIRECT_V2_POOL_TAX`，`dexId = 0`，LP 由 Portal 销毁。

## 1. 目标

观众能看懂四件事：

1. 代理出了什么价。
2. 清算价是哪一个数，哪些单成交。
3. 成交的 BNB 进池子，没成交的 BNB 退回。
4. 保留价没达到时，一枚代币都不发，BNB 全额退。

创建者能从 Vault 提走全部交易税，不需要别人投票。

演示夜有一条不断的路径：看失败局的退款 → 看一场已经截单的拍卖 → 代理发一笔结算 → 页面出现代币和池子 → 再给一笔买入和一次提税。现场如果还来得及，再出一笔新的限价单，曲线跟着动。

## 2. 现状与依赖

合约从 Flap 示例原样拷贝 `src/flap`，不要改这些文件。业务合约放在旁边的新目录。

- 示例仓库：`flap-sh/FlapPoolLaunchVaultExample`，提交 `29334f689774f6b3a39720b3fc802ab0d6a61718`
- 页面模板：`flap-sh/flap-vault-component-template`，分支 `test/pool-launch-developer-preview`，提交 `3a7fa025f7a73dd6b6ff4eecce4e990bf33e1a06`
- 文档：<https://docs.flap.sh/en/flap/v2/developers/pool-launch/build-on-pool-launch> ，机制与权限在 <https://docs.flap.sh/en/flap/v2/developers/pool-launch/basic-and-mechanism> ，地址在 <https://docs.flap.sh/en/flap/v2/developers/deployed-contract-addresses>

### 地址（BNB Chain 和测试网）

| 名称 | 地址 | 说明 |
| --- | --- | --- |
| Pool Launch Portal | `0x000042108465206185A077Edc3F3fd2b49060000` | 主网和测试网同一地址。不要打到 Bonding Curve Portal |
| 税币实现 | `0x7777c57ff7dc441c1715b2e36fa581c48B782222` | 代币地址由 Portal 用这个实现做 CREATE2，必须以 `7777` 结尾 |
| 测试网 Guardian | `0x00004d58290854c5E9880F4b5B1993c6Ad8b0000` | 只负责升级和急救。主网 Guardian 是另一个地址，不要用错 |
| AllocationStrategy | `0x000051353ef814E4779B692cb2Bb3A6Cb3710000` | 本项目不用。待售代币回到 Launcher |
| 测试网 WBNB | `0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd` | 示例 fork 里的地址，买入路径用 |
| 测试网 V2 Router | `0xc9D63ddCB9549578057EAB6A83a543DdFEE2b8c3` | 示例 fork 里的地址。`dexId = 0` 是否就是它，问 Flap 确认 |
| Portal ProxyAdmin | `0x0000Ed588dfc01749C20bA69b5f8c77d706E0000` | 只在本地 fork 里读它的 `owner()`。活网上不要对它发交易 |

链 ID：EVM 97。示例要求 Portal 版本不低于 `v1.1.2`。

### 权限

工厂必须先被 Flap 启用。Portal 的检查是：

- `newLauncher` 发现工厂没启用，revert `LauncherFactoryNotEnabled`。
- 启用函数是 `setLauncherFactoryMultiplier(factory, multiplierBps, enabled)`。`10000` 表示地板乘数为 1，不打折。调用者是 Flap 的 admin / manage / auditor。
- 示例 fork 的做法是：读 ProxyAdmin 的 `owner()`，`vm.prank` 那个地址再去启用。这只在 fork 里有效。
- 文档写明主网创建目前对普通人暂停。示例注释写测试网是开着的。两种情况都要工厂处于 enabled，Launcher 才创建得出来，也才发射得出来。
- 自 Portal `v1.1.2` 起，已登记的 Launcher 只看自己的 Launcher Factory。Vault Factory 不启用，发射仍可进行，只是没有地板折扣，也没有官方 UI 登记。我们仍然要求 Flap 两个都启用。

地板（文档原文，50% 入池时乘 2）：

```text
quoteUsd        = poolQuote × BNB 美元价
creationFloor   = 750 美元 × multiplier × totalSupply / poolToken
graduationFloor = 1500 美元 × multiplier × totalSupply / poolToken
```

文档里的例子：BNB 按 600 美元，池子放 3 BNB，50% 供应入池。quoteUsd = 1800 美元，creation floor = 1500，graduation floor = 3000。能发射，状态仍是 New。再多 2 BNB 才到 Graduated。

测试网的 BNB 美元价以 Portal 上的 `launchQuoteConfig` 为准，不要用 600。文档还写了可以用 `graduationFloorV2` 预检。函数签名以链上 ABI 为准，对不上就不要猜，改问 Flap 要当前测试网的最低 `poolQuote`。

`SALT_LOCK_FEE()` 文档写的是 BNB Chain 上 0.01 BNB，不退。测试网以链上读数为准，写进创建指令，不要写死。

### 代理钱包

官方说明在 `binance/binance-skills-hub` 的 `binance-agentic-wallet`：

- 外部合约调用固定两步：`baw contract-call preview`，用户看过模拟结果后再 `baw contract-call execute --requestId`。
- `--value` 是 wei。
- Developer Mode 只能在币安 App 里开：Agentic Wallet 管理页 → 右上角设置。余额超限会失败，错误码 `351804`。过期是 `351802`，没开是 `351801`，风控拦截是 `351803`。
- Agent ID 用 `baw wallet agent-id` 查询，领了才有 `.ai` 名字。领取在 App 里做，不在 CLI 里做。
- 官方示例里的 `baw wallet chains` 列出了 BSC `56`，没有 EVM 97。示例可能过时。开工第一小时跑一次 `baw wallet chains --json`，以返回为准。没有测试网就停在这一步去问现场的币安同学，不要改打主网 `56`。

公开文档没有给出测试网上可调用的 Agent ID 注册表。合约里不做一个假的 `onlyAgent`。资格放在指令里：代理必须先查到 Agent ID，再 preview。币安如果给出注册表地址，再给 `bid` 加一次 view 调用。

### 测试网没启用时怎么演示

1. 先找 Flap 启用。这是唯一能当「测试网跑通」的路径。
2. 启用之前，Foundry fork 测试照跑。fork 里 prank 管理员只为了测我们自己的合约。
3. 现场如果截止前仍没启用：用 anvil 分叉测试网，只在本机 impersonate ProxyAdmin 的 owner，调用 `setLauncherFactoryMultiplier`，然后走完创建、出价、结算、退款。页面角标写「本地分叉，不是测试网」。这种交易哈希不能写进 HackQuest，不能说成测试网结果。
4. 主网不要发币。主网创建在暂停，而且代理钱包的 `56` 不是这条赛道要的验收链。

## 3. 范围

做：

- `UniformLauncherFactory`、`UniformLauncher`、`UniformVaultFactory`、`UniformVault`
- 纯函数结算和 Foundry 单测，加一条对测试网 Portal 的 fork 测试
- 工厂一旦启用，就在 97 上走通：创建、两笔出价、成功发射、失败全额退款、一笔买入、`dispatch`、创建者提税
- Flap 模板里的 Launcher 组件（创建页 + 详情页）和 Vault 税费页
- 一个只读演示页，用公共 RPC 读 `getBids()`，画出精确需求曲线，主按钮是复制指令

不做：

- commit-reveal、撤单、改单、追加预算
- 荷兰拍、LBP、按区块释放的 CCA、bonding curve
- 游戏、抽签、白名单、KYC
- 硬顶。价格上不封顶。人数上限 32 是 gas 上限，不是募资硬顶
- 创建者第一笔买入、团队预留、质押挖矿、回购、持币分红、销毁税、加 LP 税
- 治理、时间锁、多签
- RWA、Uniswap v4 hook、自研 AMM
- ERC-20 报价。只收原生 BNB
- 链下订单簿和后台撮合
- 把浏览器插件钱包放成主按钮

供应量写死，避免现场配错比例。

- 总供应 `1_000_000 ether`（100 万枚，18 位小数）。在 Portal 允许的 100 到 10^15 枚之间。
- 拍卖卖出一半，`S = 500_000 ether`。另外一半是 `poolToken`。两者相加等于总供应。
- 开盘价 = 实际花掉的 BNB / `poolToken`。整笔成交时，这个数等于清算价。

## 4. 用户路径

四种人。观众不签名。另外三种人的每一步都是一条可复制的指令，没有「连接钱包」。

### 创建者

1. 填名称、符号、元数据、salt、保留价、窗口区块数。
2. 页面用最近 20 个区块估算窗口分钟数。默认 1500 个区块。允许范围 200 到 20000。
3. 页面显示软顶 = 保留价 × 50 万。并提示：软顶要比 Flap 当前 creation floor 高大约两成，躲开尘埃和报价波动。美元地板读不到时，只显示警告，不阻止复制指令。
4. 主按钮「复制创建指令」。Portal `newLauncher`，`value` 等于当时读到的 `SALT_LOCK_FEE()`。
5. 创建成功后页面从 `FlapNewLauncherCreated` 里认出新 Launcher，进入详情。

创建者不参与出价，也不能提前结算，不能改保留价，不能把出价资金转到自己地址。

### 代理

窗口条件：`startBlock <= block.number < endBlock - 20`。最后 20 个区块只展示，不接新单。这是截单，不是密封。

1. 填预算和最高价。预算 0.01 到 100 BNB。最高价不低于保留价。
2. 主按钮「复制出价指令」。
3. 页面每 3 秒读一次链。出现匹配的 `BidPlaced` 就显示「已上链」。贴交易哈希是可选项，放在页面底部。
4. 同一地址只能出一笔。

结算、领取、退款也各是一条指令。结算不附带 BNB，gas 另计。任何人都可以结算，演示里仍由代理发。

### 观众

只读。看到阶段、曲线、出价列表、清算价、代币地址、池子地址。链读失败时整页留着，中间一行字：「读不到测试网，过几秒再试。」

### 创建者提税

发射之后：

1. 指令：用测试网 V2 Router 买一小笔（`swapExactETHForTokensSupportingFeeOnTransferTokens`，path 是 WBNB → 代币）。
2. 指令：对代币的 `taxProcessor()` 调用 `dispatch()`。示例里这个函数是公开的。fork 里先确认没有权限修饰。
3. 指令：Vault `withdrawAll()`。BNB 到创建者地址。

没有税的时候，税费页显示「还没有税」，按钮仍在，点下去的指令会被合约拒绝。页面在余额为 0 时把按钮改成不可点，并写「余额为 0」。

### 阶段和空态

| 阶段 | 条件 | 主按钮 | 页面上的一句话 |
| --- | --- | --- | --- |
| 没有实例 | 地址为空 | 无 | 还没有这场拍卖 |
| 未开始 | 当前区块 < `startBlock` | 无 | 窗口还没开 |
| 接受出价，零笔 | 窗口内，`bidCount = 0` | 复制出价指令 | 还没有出价 |
| 接受出价 | 窗口内，已有出价 | 复制出价指令 | 显示笔数和当前最高限价 |
| 已截单 | 进入最后 20 个区块 | 无 | 已停止接单，等区块结束 |
| 待结算 | 已过 `endBlock`，状态仍是 Open | 复制结算指令 | 可以结算 |
| 已发射 | Succeeded | 复制领取指令 | 写出清算价、代币、池子 |
| 失败 | Failed | 复制退款指令 | 未达保留价，出价全额退回 |
| 读链失败 | RPC 错误 | 保留上一次主按钮，不可点 | 读不到测试网，过几秒再试 |

失败局要提前做一场放在测试网上：保留价设高，一笔小预算，结算后状态 Failed，退款交易已确认。演示时先打开这场。

成功局也提前做到「已截单、有两笔能过保留价的出价、还没结算」。现场的代理动作优先是结算。出价窗口若来得及，再补一笔新单。

## 5. 合约设计

四个合约。工厂没有 owner。升级只有 Guardian，走 beacon。生产工厂用 `LauncherFactoryBase` / `DirectLaunchVaultFactoryBase` 自带的 hub 和 guardian，不要把主网地址写进构造函数。

部署顺序和示例 Crowd 一样：先按 nonce 预测 Launcher Factory 地址，Vault Factory 构造时记下它，再部署 Launcher Factory，并把 Vault Factory 地址设进去。

### 状态机

`Open`、`Succeeded`、`Failed`。未开始、接单中、截单、待结算都是 `Open`，用区块号区分。

- `bid` 只在接单区间，且 `Open`
- `settle` 只在 `block.number >= endBlock` 且 `Open`，只成功一次
- `guardianFail` 只在 `Open`。把状态改成 `Failed`，不转走 BNB，不发射。调用者只能是 Guardian
- `Succeeded` 之后每个人 `claim`
- `Failed` 之后每个人 `refund`
- 创建者没有取消函数

`settle` 先在内存里算结果。发射成功才把成交写进存储。`launchTaxTokenV2` 用 try/catch。内部回滚则整笔交易不回滚，状态改为 `Failed`，出价按原预算退。这样流动性不足、salt 冲突、工厂中途被关掉，都不会把 BNB 卡死。

### 结算

纯函数，先写测试再写合约。价格单位是「1 枚代币（1e18 wei）需要多少 wei BNB」。整除一律向下。

输入：待售量 `S`，保留价 `floor`，出价列表 `(index, budget, maxPrice)`。`index` 越小越早。

只考虑 `maxPrice >= floor` 的单。按 `maxPrice` 从高到低，同价按 `index` 从小到大。

两种候选，取得出的清算价更高的那个。价格相同就留全额成交那一种。

全额前缀。前 `k` 笔预算之和为 `B`，其中最低限价为 `mMin`。

```text
P = B * 1e18 / S
可行条件：P >= floor 且 P <= mMin 且 B > 0
```

这 `k` 个人预算全部花掉。代币 `budget * S / B`，余数给这 `k` 个人里 `index` 最小的，使代币之和等于 `S`。

卡在某一档 `m`（`m >= floor`）。严格高于 `m` 的是价内单，等于 `m` 的是边际单。

```text
价内代币 = 每个价内预算 * 1e18 / m，再求和（各自向下取整）
若价内代币 >= S：这一档作废
剩余 = S - 价内代币
花费 = 剩余 * m / 1e18
若边际预算之和 < 花费：这一档作废
```

价内单按上面的代币数成交，花费 = 代币 × `m` / 1e18，没花掉的退回。边际单按预算比例分 `剩余` 枚，再向下取整，代币尘埃给边际里 `index` 最小的。没有任何候选就失败。

手算，单位是枚和 BNB，方便对账。实现时用 wei，公式相同。

| 例子 | 输入 | 结果 |
| --- | --- | --- |
| 整笔成交 | S=100，floor=1；A 预算 40、限价 5；B 预算 60、限价 2 | P=1。A 花 40 得 40 枚，B 花 60 得 60 枚 |
| 边际成交 | S=100，floor=1；A 预算 40、限价 4；B 预算 100、限价 1 | 前缀凑不出不低于 floor 的价。P 卡在 1。A 花 40 得 40 枚，B 花 60 得 60 枚，退 40 |
| 失败 | S=100，floor=2；A 预算 100、限价 3 | 全额前缀的价是 1，低于保留价。卡在限价 3 要 300，预算不够。失败 |
| 尘埃 | S=100，floor=0.01；三笔预算都是 1，限价都高于 floor | P=0.03。每笔代币 33，余 1 枚给 index 最小的那笔。三笔预算都花掉 |

成功时 `poolToken = S`，`poolQuote = 实际花掉的 BNB 之和`。全额前缀里这个和等于 `B`，开盘价等于 `P`。边际成交里因为再次整除，开盘价可以比 `m` 低一点点，不允许高过 `m`。

展示用的 8 个分档不是结算依据。第 `i` 档的边是 `floor << i`（1 倍、2 倍、4 倍……128 倍）。出价时若 `maxPrice >= edge`，就把预算加进该档。`demand0` 等于全部合法预算。`floor` 必须满足 `floor << 7` 不溢出。

### 函数和事件

```solidity
struct LaunchConfig {
    string name;
    string symbol;
    string meta;
    bytes32 salt;
    uint256 floorPrice;
    uint64 durationBlocks;
}

function initialize(address hub, address creator, LaunchConfig calldata config) external payable;
function bid(uint256 maxPrice) external payable;
function settle() external;
function claim() external;
function refund() external;
function guardianFail() external;

function getBids() external view returns (
    address[] memory agents,
    uint256[] memory budgets,
    uint256[] memory maxPrices
);
function demand0() external view returns (uint256);
// demand1 … demand7 同样是无参 uint256
function status() external view returns (uint8);
function floorPrice() external view returns (uint256);
function clearingPrice() external view returns (uint256);
function softCap() external view returns (uint256);
function bidCount() external view returns (uint256);
function endBlock() external view returns (uint64);
function token() external view returns (address);
function pool() external view returns (address);
function creator() external view returns (address);

event BidPlaced(address indexed agent, uint256 indexed bidId, uint256 budget, uint256 maxPrice);
event AuctionSettled(uint256 clearingPrice, uint256 poolQuote, address token, address pool);
event AuctionFailed(uint8 reason); // 1 没有成交候选，2 发射回滚
event Claimed(address indexed agent, uint256 tokens, uint256 quoteRefunded);
event Refunded(address indexed agent, uint256 amount);
event FlapDistributionInitialized(address token, uint256 amount);
```

`initialize` 的 `msg.value` 必须等于 `SALT_LOCK_FEE()`，由 Launcher 自己调用 `lockSalt(salt, 0)`。多出来的 wei 直接 revert。名称、符号不要空，长度分别不超过 32 和 8。`meta` 非空。`durationBlocks` 在 200 和 20000 之间。`startBlock = block.number`，`endBlock = startBlock + durationBlocks`。

`bid`：一个地址一笔；预算在 0.01 ether 和 100 ether 之间；`maxPrice >= floorPrice`；人数少于 32；加总时不溢出。不收低于保留价的单。

Vault：

```solidity
function withdraw(address to, uint256 amount) external;
function withdrawAll() external;
function owner() external view returns (address);
function accrued() external view returns (uint256);

event TaxWithdrawn(address indexed to, uint256 amount);
```

`newVault` 的 `creator` 参数是发射调用者，也就是 Launcher，不是人。示例 Crowd 就是这样。Vault 要求：

- `onlyHub`
- `portal.getLauncher(creator).launcherFactory` 等于配对的那一个 Launcher Factory
- `vaultData` 严格等于 `abi.encode(address launcher)`，且这个地址等于 `creator` 参数
- 报价代币是 `address(0)`
- 恰好一个指向本工厂的 VAULT 槽，bps 为 10000
- distribution 不是 VAULT。调用基类的 `_requireNoReserveDistribution`
- 然后 `owner = Launcher(creator).creator()`

`withdraw(to, amount)` 只有 `owner` 能调，`to` 不能是 0，金额不超过余额。`withdrawAll()` 中 `owner` 和 Guardian 都能调，收款地址只能是 `owner`。`receive()` 只做余额记账，不能 revert。人的 BNB 误转进来也算进可提余额，演示时不要往 Vault 乱转。

`description()` 用文字写明：税的 100% 进入这个 Vault，`owner` 可以提到任意地址，Guardian 只能提到 `owner`。没有第二个收款人。

`vaultUISchema()` 列出 `accrued`、`owner`、`withdraw`、`withdrawAll`。

### description

用 `LauncherBase._description()`，不要手写 JSON。

| 字段 | 值 |
| --- | --- |
| name / symbol | 创建者填的 |
| quoteToken | 零地址 |
| targetRaise | 软顶，wei |
| poolTokenRatio | `0.5e18` |
| titleZh | 统一价拍卖 |
| titleEn | Uniform-price auction |
| summaryZh | 代理提交限价和预算。窗口结束后按一个清算价卖出一半供应，另一半和成交的 BNB 注入池子。到不了保留价就全额退款，不发射。 |
| summaryEn | Agents submit a limit and a budget. At the end, half the supply sells at one clearing price. The other half and the BNB taken seed the pool. Below the reserve price, bidders are refunded in full and nothing launches. |

标题和摘要里不要出现引号和反斜杠。这是展示数据，合约逻辑不要读它。

### launchTaxTokenV2 的取值

| 字段 | 值 |
| --- | --- |
| name, symbol, meta, salt | 创建时存的 |
| totalSupply | `1_000_000 ether` |
| quoteToken | `address(0)` |
| dexId | `0` |
| poolQuote | 本场实际花掉的 BNB |
| poolToken | `500_000 ether` |
| buyTaxRate, sellTaxRate | `300`，`300`（3%） |
| taxDuration | `30 days` |
| antiFarmerDuration | `1 days`。和示例一致。若 fork 证明更小的值合法且不影响提税，再改，不在演示当天才改 |
| feeConfigs | 一个槽：`FeeSlotType.VAULT`，bps `10000`，`configData = abi.encode(vaultFactory, abi.encode(address(this)))` |
| antiSniperMode | `0` |
| exemptWindow | `0` |
| exemptAddrs | 空数组 |
| creatorBuyQuote | `0` |
| extensionID, extensionData | `LaunchExtensionHelper.encodeCreator(creator)` |
| commissionReceiver | `address(0)` |
| distribution | `EXPLICIT`，strategy 是 Launcher 自己，amount 是 `500_000 ether`，configData 空 |
| creatorBuy | `minOutputAmount = 0`，`permitData` 空 |
| msg.value | 等于 `poolQuote` |

`initializeDistribution` 只在发射那一次、只接受 Portal、拉走恰好 `500_000 ether` 枚。之后 `claim` 从这里把代币转给成交的人。

`MARKETING` 和 `VAULT` 不能同时用。税要进 Vault，所以没有 MARKETING 槽。bps 不拆给销毁、LP 或分红，创建者才能拿走全部税。

### 安全点

- 出价、领取、退款先改存储再转 BNB、再转代币。
- Launcher 的 `receive()` 直接 revert。BNB 只从 `bid` 和 `initialize` 进来。
- `settle` 里除了 Portal 和随后的 `initializeDistribution`，没有别的外部调用。不在结算循环里给人转账。
- 发射进行中拒绝 `bid`。
- 失败不写 `tokensOwed`。退款用原始预算。成功后未成交的人走 `claim`，`quoteRefunded` 等于原预算，代币为 0。
- 创建者改不了已有出价，也碰不到这些 BNB。
- 工厂没有提现、没有暂停、没有白名单。
- 不用 `tx.origin`，不做元交易。
- salt 只能由 Launcher 锁定。工厂去锁会让发射 revert `FlapSaltLockedByAnotherUser`。
- 代理指令里的金额由页面生成。代理不得改金额。这是操作约束，不是合约约束。

公开订单的剩余风险：截单前最后一个区块仍可以加价，把清算价抬高。后出价的人付的是新的统一价，不会比早期出价更便宜。演示和提交材料都这样讲。

## 6. 前端与审美

两处界面，一套视觉。

1. 演示页，给现场投影。Vite 单页即可，读公共 RPC，不接钱包。默认端口不要用 3000、5173、8080。
2. Flap 模板组件，交给 Workbench。`launcher-config-preview/v1`，chainId `97`，导出 `LauncherConfig` 和 `Launcher`。详情用 snapshot 的无参读取。Vault UI 用 `yarn vault:scaffold`。

模板限制要守：只读详情最多 8 个无参读取；声明了 `transactions` 之后最多 16 个；返回值只能是 address、bool、uint256。`bid(uint256)` 带参数，不能放进 `transactions.actions`。`settle`、`claim`、`refund` 可以声明，但页面上不做成主按钮。主按钮是复制。源码检查要求 `en`、`zh`、`ko` 键一致。韩文按中文意思写短句。

snapshot 用满 16 个：`demand0` 到 `demand7`，`status`，`floorPrice`，`clearingPrice`，`bidCount`，`endBlock`，`softCap`，`token`，`pool`。模板上的曲线用这 8 个分档，标注「分档只用于展示」。精确曲线在演示页，数据来自 `getBids()`。

### 参照

Uniswap 官网和 CCA 说明页：近黑底、大数字、细线，需求画成阶梯。MegaETH 官网：网格、等宽数字、颜色很少。两边都不要照搬插画和字体标识。

不用组件库的默认卡片、默认圆角和默认紫色。Flap 组件若不能外链字体，就用 `ui-sans-serif` 和 `ui-monospace`，字号和颜色仍按下面来。演示页自托管 Geist Sans 和 Geist Mono。

### 参数

| 项 | 值 |
| --- | --- |
| 页面底 | `#07080A` |
| 块面 | `#101114` |
| 主文字 | `#F5F5F5` |
| 次文字 | `#9A9AA2` |
| 网格 | 64px，1px，`rgba(255,255,255,0.06)`，不拦截点击 |
| 强调色 | `#F0B90B`。只用在主按钮、清算价、曲线、当前区块刻度 |
| 按钮上的字 | `#14120A` |
| 失败 | 不使用红色。1px 白边 `rgba(255,255,255,0.24)`，文字仍是 `#F5F5F5` |
| 圆角 | 0 |
| 阴影 | 不加 |
| 页边 | 桌面 48px，手机 24px |
| 块间距 | 32px |
| 标题 | 桌面 56px / 行高 64px，手机 36px / 44px，字重 500，字距 -0.03em |
| 清算价 | 桌面 72px，手机 48px，字重 500，等宽，金色 |
| 正文 | 16px / 24px |
| 标签 | 12px / 16px，次文字。中文不加字距 |
| 主按钮 | 高 56px，宽 100%，金底，字号 16px |

### 曲线

SVG。桌面绘图区高 420px，手机 240px。`viewBox="0 0 700 420"`，内边距 24。

- 横轴是价格，从保留价到「最高限价和 4 倍保留价里的较大者」。线性。
- 纵轴是「限价不低于该价格的预算之和」。
- 阶梯折线，描边 `#F0B90B`，宽 1.5。线下填充 `rgba(240,185,11,0.08)`。
- 坐标轴 1px，`rgba(255,255,255,0.16)`。图内不放标题和图例。
- 清算价是一根同样细的竖线，交点用 4px 的方块，不用圆点。
- 没有动画。空数据时只留坐标轴，中央写「还没有出价」。

### 首屏

桌面两栏。左栏：代币名、一行说明、保留价、软顶、剩余区块。左栏底部就是预算、最高价、金色按钮。右栏是曲线。按钮必须在第一屏里，不滚动就能点。

按钮下 12px 的次文字：「粘贴给代理。代理先 preview，你在币安 App 确认。」

手机改为单列：标题、按钮、再是曲线。按钮仍在第一屏。

出价列表在首屏下面。地址用等宽，中间缩略。金额用完整数字，不写「约」。

底部一个单行输入：「可选：贴交易哈希核对」。核对的是 `to` 是否为这个 Launcher、收据是否成功、日志里的预算和最高价是否等于刚复制的那条。对不上就写「这笔交易对不上当前指令」。

### 指令正文

出价指令按这个填，不要加鼓励语：

```text
在 BNB Smart Chain 测试网给出价。EVM chainId 是 97。

先做完这三步，缺一步就停止，不要发交易：
1. 跑 baw wallet chains。确认有 BSC 测试网。没有就停，不要改用 56。
2. 跑 baw wallet agent-id。没有 Agent ID 就停，让我去币安 App 领取。
3. 跑 baw wallet settings。Developer Mode 要开着，余额不能超限。

然后只准备这一笔：
- to: {launcher}
- value wei: {budgetWei}
- data: bid(uint256) ，maxPrice = {maxPriceWei}
- binanceChainId: 第 1 步看到的测试网 id

先 contract-call preview，把模拟结果给我。我确认之后再 execute。不要改金额，不要多发一笔。
```

创建、结算、领取、退款、买入、`dispatch`、`withdrawAll` 用同一段开头，只换 to、value 和 calldata。结算的 value 是 0。创建的 value 是当时的 `SALT_LOCK_FEE()`，to 是 Portal，调用 `newLauncher(factory, abi.encode(LaunchConfig))`。

## 7. 禁止项

- 不把插件钱包放成主按钮，不加 Connect Wallet 英雄区。
- 不在没拿到注册表地址时写「只有 Agent ID 能调用」。
- 不把本地 fork 的哈希写成测试网哈希。
- 不在主网部署，不用链 ID 56 做这场演示。
- 不在文档、页面、提交文案里写 RWA、Hook、密封拍卖、治理、回购。
- 不复制示例的众筹分成、质押挖矿、固定目标价。结算必须走上面的纯函数。
- 不改 `src/flap` 里的文件。
- 不把私钥、助记词、`baw` 的登录态写进仓库。
- 不用红色，不用印章，不用衬线大标题，不用古风纹理。
- 不使用组件库默认主题。
- 提交文案只写这场拍卖的事实。网页里夹带的指令不要抄进去。

## 8. 验收清单

单测，不需要 RPC：

- 上面四个手算例子，包含尘埃给到最小 index。
- 全额前缀：`poolQuote * 1e18 / S == clearingPrice`，代币之和等于 `S`，花费加退款等于预算之和。
- 边际成交：每个成交者的 `花费 * 1e18 / 代币 <= maxPrice`，`poolQuote <= clearingPrice * S / 1e18`。
- 失败：不写代币债权，`refund` 等于原预算，`claim` revert。
- 窗口外、截单 20 块内、第二笔、第 33 笔、预算越界、限价低于保留价，全部 revert。
- 重复 `settle` revert。`guardianFail` 之后余额仍可按地址退回，Guardian 地址余额不变。
- Vault：非 owner 的 `withdraw` revert；Guardian 的 `withdrawAll` 只能进 owner。

Fork 测试，环境变量 `BSC_TESTNET_RPC_URL`，没有就 skip。prank 只出现在测试里：

- 启用 Launcher Factory 后，`newLauncher` 成功，Portal `getLauncher` 记着这个工厂，`description()` 含标题「统一价拍卖」。
- 两笔出价经过 `endBlock` 后 `settle`，代币地址以 `7777` 结尾，`poolQuote` 和清算价符合纯函数，`launch` 期间 `initializeDistribution` 只发生一次。
- 另一场高保留价，`settle` 后 Failed，两个人 `refund` 后 Launcher 的 BNB 为 0，`token()` 仍是 0。
- 把工厂关掉再 `settle`，发射回滚，状态 Failed，钱能退。
- 买入一笔并 `dispatch` 后，Vault 余额增加，owner `withdrawAll` 之后 Vault 余额为 0，owner 收到刚才的差额。

测试网交易，工厂启用之后才做。每笔都留哈希：

| 步骤 | 要看到的事件或状态 |
| --- | --- |
| 创建 | Portal `FlapNewLauncherCreated`，description 里有名称和 `poolTokenRatio` |
| 两笔出价 | 两笔 `BidPlaced`，`bidCount = 2` |
| 结算成功 | `AuctionSettled`，随后 Portal 的发射事件。代币、池子非零。再 `settle` 会失败 |
| 领取 | `Claimed` 的代币数和退款数等于存储 |
| 失败局退款 | `AuctionFailed`，两笔 `Refunded`，金额等于出价 |
| 提税 | 买入交易、`dispatch` 交易、`TaxWithdrawn`。提走前后 Vault 余额对得上 |

页面：

- 零出价、失败、已发射、RPC 失败，四种状态都有对应的那一句文案，主按钮在第一屏。
- 桌面和 390px 宽各看一次。手机上按钮在曲线上面。
- 复制出来的指令含 launcher 地址、wei、`chainId 97`，并写明没有测试网就停止。
- 可选哈希对不上时出现「这笔交易对不上当前指令」。
- 页面源码里没有私钥，也没有插件钱包的连接代码。

`forge test -vv` 在单测范围全绿。fork 在有 RPC 时全绿。

## 9. 回报格式

每完成一个时间块，用下面的格式回报，不要改写成宣传稿。

```text
时段：
做完：
没做：
测试：命令和失败数量
链上：网络（97 或本地分叉）、合约地址、交易哈希。没有就写「无」
阻塞：需要 Flap 或币安回答的问题。没有就写「无」
```

最终回报在这个格式后面加五块：工厂地址和两个 Launcher 地址、成功与失败的哈希、提税哈希、演示页地址、和本说明不一致的地方。不一致要列出，不要悄悄改规则。

## 36 小时

起点 2026-11-25 20:00 上海。实际开幕更晚就整表后移，10:00 的截止不后移。08:00 之后只修演示会失败的缺陷，不改结算。

| 时间 | 做什么 | 这块结束时要有的东西 |
| --- | --- | --- |
| 20:00–21:00 | 跑 `baw wallet chains` 和 `baw wallet settings`。把文末的问题发给 Flap。读测试网 creation floor。初始化 Foundry，拷入 `src/flap` | 一份链列表截图或终端输出；Flap 联系记录 |
| 21:00–00:00 | 只写结算纯函数和四个手算测试 | `forge test` 里结算全绿 |
| 00:00–04:00 | Launcher 的出价、截单、失败退款。先不连 Portal | 窗口和退款单测全绿 |
| 04:00–08:00 | 接上 `launchTaxTokenV2`、distribution、Vault、两个工厂 | 本地测试能走完成功和失败。fork 还没要求 |
| 08:00–10:00 | 写 fork 测试。向 Flap 要启用结果。没启用就继续修 fork，不空等 | fork 全绿，或一条写明失败原因的日志 |
| 10:00–14:00 | 启用了就部署到 97 并做成功、失败两场。没启用就把演示页接到本机 anvil 分叉，角标写明 | 两场的地址。测试网或标明为分叉 |
| 14:00–18:00 | 演示页：曲线、复制、3 秒轮询、哈希核对、四种状态 | 桌面和手机各一条路径能点完 |
| 18:00–22:00 | Flap 组件和 Vault 页，16 个读取接上分档曲线 | `launcher:check-source` 通过 |
| 22:00–02:00 | 提税三步在 fork 走通；测试网可用就发那三笔。准备已截单的成功局和已退款的失败局 | 提税哈希，或 fork 日志加「测试网未做」 |
| 02:00–05:00 | 按 3 分钟演示脚本彩排两遍。只改文案、RPC 和会 revert 的参数 | 两遍都在 3 分钟内讲完 |
| 05:00–08:00 | 冻结合约。写提交文案、收哈希、录一版备用屏幕 | 提交材料齐，代码不再改结算 |

27 日 08:00–09:30 提交。09:30 后不再改文案。白天给赞助方看的就是这版。晚上 Demo Night 用同一场已截单的局；如果那场已经在彩排里结算掉了，就再开一场窗口更长的，保证晚上还有一笔待结算。

## 3 分钟演示

上场前页面打开失败局。旁边那一场已经截单、有两笔出价、还没结算。Agent ID、Developer Mode、测试网 chain id 都先查过。

| 秒 | 做什么 | 说的话 |
| --- | --- | --- |
| 0–20 | 失败局。指出退款哈希和两边余额 | 保留价没到，所以没有代币。两笔 BNB 都退回去了 |
| 20–40 | 切到待结算那场。指出曲线和两笔限价 | 价高的整笔成交，价低的按同一个清算价成交。这个数就是等下的开盘价 |
| 40–90 | 点「复制结算指令」，交给代理。preview 的数字给观众看，再在 App 里确认 | 签名在币安 App 里。页面在等链上的 AuctionSettled |
| 90–130 | 页面变成已发射。念清算价、poolQuote、代币地址末尾 7777 | 一半代币进池，另一半在这里等领取。花掉的 BNB 就是池子里的 BNB |
| 130–160 | 打开税费页。若已经有税，复制提税指令并确认 | 税全部在 Vault。创建者直接提，没有投票 |
| 160–180 | 若时间不够就停。若出价窗口还开着，补一句 | 新的限价单也是同一条路径。最后一块仍可能把价抬高，抬价的人自己也付新价格 |

结算确认超过 40 秒还没上链：停在 preview 画面，改口「指令已经固定，哈希我们用彩排那笔」，打开提前结算好的备用局，把备用哈希念出来。不要改走插件钱包。

本地分叉时，第一句就说这是分叉，不是测试网。

## HackQuest 提交

表单以页面上看得见的字段为准。下面这些提前备好。

- 名称：同价发射
- 一句话：代理提交限价单，一次清算决定开盘价，达标后 Launcher 把带税代币发进 Flap 池子；不达标全额退款。
- 赛道：Flap、Developer 都选。
- 链：BNB Smart Chain 测试网，97。
- 地址：Portal、两个工厂、成功 Launcher、失败 Launcher、代币、池子、Vault。
- 哈希：创建、两笔出价、结算、领取、退款、买入、dispatch、提税。
- 仓库和演示页链接。
- 3 分钟材料用同一套口径。不提 RWA，不提 Hook，不提密封。

若截止时工厂还没启用：提交里写明「测试网启用未完成，完整路径在 fork 测试和本地分叉」，并附测试命令和分叉步骤。不要把分叉哈希填进测试网哈希那一栏。

## 问 Flap 和币安

一次问完，带上工厂地址（部署后补）：

1. 测试网谁能调用 `setLauncherFactoryMultiplier`？现场找谁，黑客松期间能不能先启用未审计的工厂？
2. 乘数能不能低于 10000，让 50% 入池时的 creation floor 降到大约 1 tBNB？
3. 测试网 BNB 的美元价现在是多少？50% 入池时，creation floor 和 graduation floor 各是多少 tBNB？`graduationFloorV2` 的参数是什么？
4. Vault Factory 不启用时，`newVault` 还会不会被调用？我们希望启用，方便税费页登记。
5. 测试网创建现在是否暂停？未启用的工厂是在 `newLauncher` 就 revert，还是只在暂停时拦截？
6. 测试网 `SALT_LOCK_FEE()` 是不是 0.01 tBNB？
7. `taxDuration` 和 `antiFarmerDuration` 的合法区间？发射后立刻买入再 `dispatch`，税能不能在同一小时进 Vault？
8. `dexId = 0` 在测试网是不是 router `0xc9D63ddCB9549578057EAB6A83a543DdFEE2b8c3`？
9. 元数据 CID 有没有必填字段？
10. `launcher-config-preview/v1` 的 ZIP，27 日 10:00 前能不能挂上预览？
11. 问币安：`baw wallet chains` 里有没有 BSC 测试网？没有的话，现场代理签名能落到哪条链？测试网有没有 Agent ID 注册表合约，`bid` 可以调用？

第 1 个和第 11 个决定演示能不能在测试网上由代理签名完成。没有答复之前，按第 2 节的分叉备份做，不改拍卖规则。
