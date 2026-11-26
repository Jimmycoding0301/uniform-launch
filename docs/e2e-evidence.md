# 本机验收和测试网签名

公开测试网的部署、创建、出价、发射和领取见[链上回执](marketing-testnet-evidence.md)。本机演练使用独立的 Anvil 实例。

## 本机六幕

运行 `bash script/demo.sh`，打开终端打印的地址。脚本创建三场使用 MARKETING 税款路径的拍卖。

| 场景 | 验证点 |
| --- | --- |
| 接单 | 九笔出价。比较同一个 1 BNB 预算在两个限价下的成交和退款。 |
| 已发射 | 40 BNB 入池，清算价 0.00008 BNB/枚。交易税通过 Flap 支付给创建者。 |
| 失败 | 三笔出价合计 3 BNB，低于最低入池额，可以退回全部预算。 |

满 128 笔的测试网和主网分叉实测见[预审答复](preaudit-response.md)。六幕截图可以[离线查看](../qa/submission/README.md)。

## 准备公开测试网交易

`plan` 默认使用已部署的新版工厂及其身份适配器，输出单笔未签名交易。此工厂已完成公开发射。[新版实际交易](marketing-testnet-evidence.md)

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

逐笔等实际回执成功。可将每一步输出交给代理预览。核对链 97、目标、金额、calldata、gas 上限及价格后，由操作者使用支持 BSC 测试网的签名工具确认。创建准备时会读取 Portal 暂停位和创建费，并预演实际的 Portal 调用。出价前会检查窗口。结算前会核对预期清算结果。如果公开场次出现其他出价，先重新评估该场的清算预览。结算后检查 Launcher 的 `statusCode() = 1`、`AuctionSettled` 事件以及 token、pool 地址，再准备领取。若实际状态是 2，出价人按失败场流程申请退款。领取后核对 500,000 枚代币到账。公开测试网的创建与结算交易见 [发射回执](marketing-testnet-evidence.md)。
