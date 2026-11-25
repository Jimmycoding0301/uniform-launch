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
