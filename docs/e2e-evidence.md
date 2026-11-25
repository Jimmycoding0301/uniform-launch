# 端到端证据

测试网成功发射至少要入池 4.3357 tBNB，加上 0.005 tBNB 创建费和 gas，建议准备 4.6 tBNB。失败退款路径每人 0.01 tBNB 加 gas 就够。

这些数字来自本机分叉。测试网还没跑，下面第二节不填哈希。

## 本机测试网分叉

命令：`bash script/e2e-fork.sh`。RPC 是 `http://127.0.0.1:18546`，分叉 BSC 测试网，链编号 97。脚本先给已部署工厂打开 multiplier，再跑七个阶段。

| 阶段 | 交易哈希 | 结果 |
| --- | --- | --- |
| 创建 | `0x6e97420e56177539431bd954cf31b42f43b252a54417196f48b65ed3ad51651c` | Launcher `0x67d6d25bcfc55c906B9628a31F96E81EFf7682e3`，创建费 0.005 BNB |
| Alice 领身份并出价 20 BNB | `0x258d746a0c68d4da15e89f11c685139d5d947617ea6a6733460d0b2a2b331563`、`0x71d8e4470131704c5ccb2c775b94c9b0c8e07043b0890038f24830e186f18958` | Agent ID 替身 |
| Bob 登记 ERC-8004 并出价 20 BNB | `0xb53e53059bfe035f16558a111b75ed42803a113fc7db009cef23fc1a4de174a6`、`0x15338769fc4d5beee52842cfa23da02f13e2e061673409eac5dcee32fc1db8e9` | 身份编号 2923 |
| Carol 出价 1 BNB，最高价低于清算价 | `0x03a61b6f4588cd6ece0008bf3fe4dc55772dfa7d025cd666996be461ba6b89b0`、`0x835558a858a01537e9a5035806f3c2b5ce89b82cd10581ae08897ff60aefaece` | 最高价 0.00002 BNB/枚 |
| 结算 | `0xd37d8c76bb7b3bb23778f67f837200d7d9195250f8b70baedb81f52f7451b853` | 清算价 0.00008 BNB/枚，入池 40 BNB |
| 领取 | `0x380ec6858fa06cb5cb200ccddb10e950f99b6084c331a4fa6d91b63be973d186`、`0x21e61ed105cb8717a94dee2547b7621ee9e6df3e03ee290cd3cce9992819601b`、`0xffa682b3f0b2e2ed75956f6b84151fa7696231a0b4da5dce71f59872723fb7e8` | Alice 250000 枚，Bob 250000 枚，Carol 0 枚 |
| 买、卖、分税 | `0xc677c3813f6ab75d7970bb4f6ffaa7a63b79a870257be39eb91079a8c6ce6248`、`0x34c96fda14062653b2007e77549086fb673e345b3f37a4dceb6aa45a23587dbf`、`0x83ea40eccb57226af53129c276190abcd9622dfa25463715545d3ca912ae65cb`、`0x77f98a1498f58b952ed33804cc8364cc5c2af9f2d43f564f69f0a4845b2e3e51` | 金库从 0 增到 27516256919450703 wei |
| 提走 | `0x5b9ff2b1acb9b70b13794c23f774f17c773d139a15439fc91c3347561cb24f93` | owner 余额增加 27516256919450703 wei，和金库减少的数额相同 |

代币 `0xe70018757F585d9F1C7bbe726F164a48D19f7777`。池子 `0x853fDB01b08bcB0A6Dc2ea21613DbB226018655E`。金库 `0xbadFB4C7c18003a509Ef2777c42dA410FA479c33`。

Carol 的最高价低于清算价，所以代币是 0。领取交易把她的预算退回。

原始记录在 `deployments/bsc-testnet-e2e.json`。这些哈希只存在于本机 anvil，BscScan 上查不到。

对着公共测试网、不广播：

```text
Flap 还没开这个工厂的权限
0xE82642aC5c3B3B4b7D4cDeaf6a251Dc0BB7AcEfd
Error: script failed: flap-not-enabled
```

对着公共测试网、带 `--broadcast`：

```text
拒绝广播：RPC 不是本机
Error: script failed: remote-broadcast
```

没有发出交易。主机名必须正好是 `127.0.0.1` 或 `localhost`。别的主机、路径或参数里夹着这两个词不算本机。

## BSC 测试网

等 Flap 给工厂 `0xE82642aC5c3B3B4b7D4cDeaf6a251Dc0BB7AcEfd` 打开权限，并且创建者地址上有大约 4.6 tBNB 之后，由项目方执行。这一节不填哈希。

当前脚本拒绝任何非本机 RPC 的广播。项目方确认要发到测试网时，需要先改这个限制。这一轮不改。

顺序：

1. `forge script script/E2ETestnet.s.sol --sig "create()" --rpc-url "$BSC_TESTNET_RPC_URL"`。先看它是不是打印「Flap 还没开这个工厂的权限」。
2. 权限打开、余额够了，再 `create()`。需要 0.005 tBNB 创建费加 gas。
3. 三个地址分别 `bid()`。成交路径需要入池至少 4.3357 tBNB。
4. 等到结束区块，`settle()`。燃料上限 8000000。
5. `claim()`。
6. `trade()`，确认金库余额增加。
7. `withdraw()`，确认 owner 增加的数额和金库减少的数额相同。
8. `show()`。
