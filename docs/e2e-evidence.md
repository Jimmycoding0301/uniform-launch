# 端到端证据

测试网成功发射至少要入池 4.3357 tBNB，加上 0.005 tBNB 创建费和 gas，建议准备 4.6 tBNB。失败退款路径每人 0.01 tBNB 加 gas 就够。

这些数字来自本机分叉。测试网还没跑，下面第二节不填哈希。

## 本机测试网分叉

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

1. `forge script script/E2ETestnet.s.sol --sig "create()" --rpc-url "$BSC_TESTNET_RPC_URL"`。不带 `--broadcast`。先看它是不是打印「Flap 还没开这个工厂的权限」。
2. 权限打开、创建者余额够了，仍不带 `--broadcast` 再跑 `create()`。它应打印预计花费，不再停在权限。创建费 0.005 tBNB 加 gas。
3. 这一轮脚本拒绝非本机广播。要真正发出去，先改这个限制，再给 `UNIFORM_RPC_URL` 和 `--broadcast`。没改之前不要加 `--broadcast`。
4. 三个地址分别 `bid()`。成交路径需要入池至少 4.3357 tBNB。失败退款路径每人 0.01 tBNB 加 gas。
5. 等到结束区块，`settle()`。燃料上限 8000000。
6. `claim()`。
7. `trade()`。先把链上时间推进两天再分税，确认金库余额增加。
8. `withdraw()`。确认 owner 增加的数额和金库减少的数额相同。
9. `show()`。
