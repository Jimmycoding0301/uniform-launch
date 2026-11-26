# Flap 对接

我们走的是 Flap 说明里的「项目用脚本经 Portal 创建的一次性 Launcher」。用户在 Flap 上看到的入口只要 `Launcher` 详情组件。出价、结算、领取、退款不放在 Flap 页面里签名，交给代理用 baw 预览，再由用户在币安 App 确认。

## 交给 Flap 的东西

- 链：97（BSC 测试网）
- 工厂：`0xE82642aC5c3B3B4b7D4cDeaf6a251Dc0BB7AcEfd`（manifest 里写小写）
- 已部署并在 BscScan 验证的 Launcher 工厂，见 `deployments/bsc-testnet.json`
- 组件包：`flap-ui/launcher-detail/` 三个文件。打包命令 `bash script/flap-zip.sh`，ZIP 在 `dist-flap/launcher-ui.zip`，不提交
- 预览地址路径：`/launcher/<launcher 地址>?chain=bnb-testnet`。主机域名以 Flap 文档为准，这里只写路径

公共测试网已通过同价 Launcher 发射代币，4.45 tBNB 入池。[实际 Launcher 与发射回执](public-testnet-evidence.md) · [固定分叉与签名步骤](e2e-evidence.md)

## 检查器

环境是 Node v22.23.4、Yarn 1.22.22。模板仓库只克隆在本机临时目录，没有拷进本仓库。Node 24 不是当前默认版本；用现成的 Node 22 跑，检查器通过了。

先确认模板自带示例能过：

```sh
node /tmp/flap-template/scripts/launcher-check-source.mjs \
  /tmp/flap-template/examples/launcher-runtime/launcher-detail-demo
```

```json
{
  "ok": true,
  "directory": "/tmp/flap-template/examples/launcher-runtime/launcher-detail-demo",
  "artifactId": "launcher-detail-demo",
  "chainId": 97,
  "factoryAddress": "0xc574f30e2ee26fe638eece6d9876217015cd0a38",
  "configContract": "launcher-detail/v1"
}
```

再查我们的目录：

```sh
node /tmp/flap-template/scripts/launcher-check-source.mjs \
  flap-ui/launcher-detail
```

```json
{
  "ok": true,
  "directory": "flap-ui/launcher-detail",
  "artifactId": "uniform-launcher-detail",
  "chainId": 97,
  "factoryAddress": "0xe82642ac5c3b3b4b7d4cdeaf6a251dc0bb7acefd",
  "configContract": "launcher-detail/v1"
}
```

这是 Flap 仓库里的 `yarn launcher:check-source` 同一份脚本。自写的 `node flap-ui/check.mjs` 只复刻字段、导出、三语、体积和禁用写法，不能代替上面的输出。

检查器要求 manifest 的键和 `launcher-detail/v1` 的清单完全一致，多一个键就失败。模板示例里没有 `match.bindings`。工厂地址写在 `factoryAddress`。

## 读数

八个无参读数：`statusCode`、`bidCount`、`clearingPrice`、`floorPrice`、`endBlock`、`poolQuote`、`token`、`pool`。这 8 个把阶段、笔数、两个价格、结束区块、入池和两个地址都放进一张交割单。检查器最多 8 个，再加图表也画不出需求阶梯，所以不加。`statusCode` 为 0 时一律显示接单中，因为这 8 个读数里没有当前区块。结束区块写在卡片上。已发射时下面换成领取指令，失败时换成退款指令，接单中才是出价指令。

`statusCode` 在合约里返回 `uint8`，`endBlock` 返回 `uint64`。ABI 编码都是 32 字节。检查器只允许声明 `address`、`bool`、`uint256`，所以 manifest 写成 `uint256`。

不声明 `transactions`。出价函数带参数，Flap 的 `actions` 只支持无参数方法。`settle` 要求进入函数时剩余 gas 达到该场的 `MIN_SETTLE_GAS`。低于门槛时，交易会在改状态前回滚。签名走代理，不走网页钱包。

## 要求和实现

| Flap 要求 | 我们的实现 |
| --- | --- |
| 工厂继承 Launcher 工厂基类，`factorySpecVersion()` 返回 `lf-v1` | `UniformLauncherFactory` 继承 `LauncherFactoryBase`，基类返回 `lf-v1` |
| 经 Portal `newLauncher` 创建 | `script/LocalFork.s.sol`、`script/E2ETestnet.s.sol` |
| 锁 salt，代币地址尾号 `7777` | 脚本把 salt 挖到预测代币地址尾号 `0x7777`，`initialize` 里调用 `lockSalt` |
| 只发射一次 | `status` 离开 Open 之后不能再 `settle` |
| `encodeCreator` | `UniformLauncher` 调 `LaunchExtensionHelper.encodeCreator` |
| Guardian 只能把实现升级或把金库提到 owner | 工厂 `upgradeVaultImplementation` 是 `onlyGuardian`；金库 `withdrawAll` 对 Guardian 只提到 owner |
| `description()` JSON | 基类把 `LauncherDescription` 编成 JSON。`targetRaise` 填 `softCap()`，也就是保留价乘以 50 万枚 |
| 真正的发射门槛 | `minPoolQuote()`，约 4.3357 BNB。低于它，或 Portal 预检不过，就失败退款。`targetRaise` 不是这条线 |
| Vault `pl-v1` | `UniformVaultFactory` 返回 `pl-v1` |
| 税进 Vault，owner 可提 | 买卖税各 3%，100% 进 `UniformVault`。owner 随时 `withdrawAll` |

四种渲染见 `qa/r15/flap-mock-null.png`、`flap-mock-0.png`、`flap-mock-1.png`、`flap-mock-2.png`。地址用的是本机分叉上的三场。卡片上的读数是为了空、接单、已发射、失败四种状态摆的，不是那一刻的链上快照。
