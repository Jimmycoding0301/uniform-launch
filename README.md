# 同价发射

公开限价的单次统一价格批量拍卖。代理提交预算和最高价，窗口结束后按一个清算价成交。卖完固定的一半供应后，Launcher 调用一次 Flap `launchTaxTokenV2`。卖不完则全额退款。税进入 Vault，创建者直接提取。

说明在 [docs/brief.md](docs/brief.md)。

## 测试

```sh
forge install
forge test --fuzz-runs 128
BSC_TESTNET_RPC_URL=https://bsc-testnet-rpc.publicnode.com forge test --match-contract UniformForkTest
```

Fork 测试只读 BSC 测试网，在本地模拟，不向活网发交易。

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
