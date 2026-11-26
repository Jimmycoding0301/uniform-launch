# Flap 对接

**新版候选。** 发布脚本部署 Launcher Factory，用一个 `MARKETING` 槽把项目侧交易税支付给创建者。新版发射仍从 Flap Pool Launch Portal 创建和结算。详情组件显示实时出价笔数。详情组件的 manifest 已绑定经核对的新版测试网工厂。[预审答复及新版记录](preaudit-response.md)

新版使用只读 Launcher 详情组件和 Flap Mini App。详情页用 `host.redirect` 打开 `/apps/uniform-launch/launcher/<address>`。Mini App 通过官方钱包 SDK 模拟创建、出价、结算、领取和退款，由用户确认签名。

## 测试网绑定与复审文件

- 链：97（BSC 测试网）
- 新版工厂：`0x5A995C7ee958a631FDD151C9582604d347D7799A`。已有公开 Launcher `0xADD4e8b95B194D457611b4754e53c45A6E2A41d6`。[部署和创建回执](marketing-testnet-evidence.md)
- 组件包：`flap-ui/launcher-detail/` 三个文件。打包命令 `bash script/flap-zip.sh`，ZIP 在 `dist-flap/launcher-ui.zip`，不提交
- Mini App 源码在 `flap-ui/mini-app/uniform-launch`。将新版工厂地址、链上 runtime code 的 keccak256 传给 `node flap-ui/mini-app/prepare.mjs <新目录> <工厂> <代码哈希>`，生成候选签名权限配置。使用 Flap 官方模板 main 的 `app:check` 和 `app:package`。将两份 UI 包与链编号、确认后的工厂和实际 Launcher 地址交给 Flap。
- 预览地址路径：`/launcher/<launcher 地址>?chain=bnb-testnet`。主机域名以 Flap 文档为准，这里只写路径

公共测试网已通过同价 Launcher 发射代币，4.45 tBNB 入池。[实际 Launcher 与发射回执](marketing-testnet-evidence.md) · [固定分叉与签名步骤](e2e-evidence.md)

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
  "factoryAddress": "0x5a995c7ee958a631fdd151c9582604d347d7799a",
  "configContract": "launcher-detail/v1"
}
```

这是 Flap 仓库里的 `yarn launcher:check-source` 同一份脚本。自写的 `node flap-ui/check.mjs` 只复刻字段、导出、三语、体积和禁用写法，不能代替上面的输出。

检查器要求 manifest 的键和 `launcher-detail/v1` 的清单完全一致，多一个键就失败。模板示例里没有 `match.bindings`。工厂地址写在 `factoryAddress`。

## 读数

八个无参读数为 `statusCode`、`bidCount`、`clearingPrice`、`floorPrice`、`endBlock`、`poolQuote`、`token`、`minPoolQuote`。状态 0 显示未结算，Mini App 根据实时区块区分接单、截单和待结算。创建完成且尚未发射时，Launcher 的 `expectedToken()` 可供按预测代币地址导流。

`statusCode` 在合约里返回 `uint8`，`endBlock` 返回 `uint64`。ABI 编码都是 32 字节。检查器只允许声明 `address`、`bool`、`uint256`，所以 manifest 写成 `uint256`。

不声明 `transactions`。出价函数带参数，Flap 的 `actions` 只支持无参数方法。`settle` 要求进入函数时剩余 gas 达到该场的 `MIN_SETTLE_GAS`。低于门槛时，交易会在改状态前回滚。有参数的调用通过 Mini App。

## 要求和实现

| Flap 要求 | 我们的实现 |
| --- | --- |
| 工厂继承 Launcher 工厂基类，`factorySpecVersion()` 返回 `lf-v1` | `UniformLauncherFactory` 继承 `LauncherFactoryBase`，基类返回 `lf-v1` |
| 经 Portal `newLauncher` 创建 | `script/LocalFork.s.sol`、`script/E2ETestnet.s.sol` |
| 锁 salt，代币地址尾号 `7777` | 脚本把 salt 挖到预测代币地址尾号 `0x7777`，`initialize` 里调用 `lockSalt` |
| 只发射一次 | `status` 离开 Open 之后不能再 `settle` |
| `encodeCreator` | `UniformLauncher` 调 `LaunchExtensionHelper.encodeCreator` |
| Guardian 控制实现升级 | 工厂 `upgradeVaultImplementation` 是 `onlyGuardian` |
| `description()` JSON | 基类把 `LauncherDescription` 编成 JSON。`targetRaise` 取 `softCap()` 与 `minPoolQuote()` 中较大值 |
| 真正的发射门槛 | `minPoolQuote()` 读取 Portal 的实时创建线和毕业线，加 0.05 BNB 余量。低于门槛或 Portal 返回预检不通过时，可全额退款 |
| 项目税路径 | 新版由 Flap 的 MARKETING 槽直接支付给创建者。 |

历史四种渲染见 `qa/r15/flap-mock-null.png`、`flap-mock-0.png`、`flap-mock-1.png`、`flap-mock-2.png`。地址用的是本机分叉上的三场。卡片上的读数是为了空、接单、已发射、失败四种状态摆的，不是那一刻的链上快照。
