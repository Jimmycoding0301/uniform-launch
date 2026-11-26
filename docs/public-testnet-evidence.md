# Public BSC Testnet launch · 公共测试网发射回执

On November 26, 2026, Uniform Launch used its Launcher Factory to launch UNIFORM through Flap on BNB Smart Chain Testnet (chain ID 97). One bidder received 500,000 tokens at **0.0000089 tBNB per token**. The other 500,000 tokens and **4.45 tBNB** seeded a PancakeSwap V2 pool. All five public transactions succeeded. [Settlement receipt](https://testnet.bscscan.com/tx/0x56d87f21c4dbd55227d9e619986555f150c7da5ddec5db663b201a9b9985ae20)

这场公开发射只有一笔出价。该买家付出 4.45 tBNB，领取 50 万枚。另有 50 万枚与这笔资金一起进入流动性池。[五步交易的发起地址](https://testnet.bscscan.com/address/0x36ABB7cC5C3d3b944eC2c88cDB0DFE40f9a4712c)

| 步骤 | Block · 区块 | What the receipt shows · 链上结果 |
| --- | ---: | --- |
| 登记测试身份 | 144,923,523 | **Register identity.** The bidder claimed an identity from the testnet Agent ID stand-in. [Identity receipt](https://testnet.bscscan.com/tx/0x4df7fbf222c358de87017d42267aabf006c525abdc505634369b1c6cfc78b2d0) |
| 创建拍卖 | 144,924,369 | **Create auction.** The creator sent 0.005 tBNB to Flap Portal. The Uniform Launcher Factory emitted `UniformLauncherCreated` with the launcher and creator addresses. [Factory creation receipt](https://testnet.bscscan.com/tx/0x5be4952fc75b9d2aec691ae0288eed53ee922e53552fce9812da24c1410ab93c) |
| 提交出价 | 144,924,882 | **Place bid.** `BidPlaced` records the 4.45 tBNB budget and a limit of 0.000009 tBNB per token. [Bid receipt](https://testnet.bscscan.com/tx/0xac2f7be859199de2d0fc11c57fcdf59308b5f856b5928afa75aaecde40dafa01) |
| 结算并发射 | 144,926,064 | **Settle and launch.** `AuctionSettled` records the clearing price of 0.0000089 tBNB per token and the 4.45 tBNB used for liquidity, above the launcher's minimum of 4.335714285714285715 tBNB. [Launch receipt](https://testnet.bscscan.com/tx/0x56d87f21c4dbd55227d9e619986555f150c7da5ddec5db663b201a9b9985ae20) |
| 领取拍卖代币 | 144,927,029 | **Claim allocation.** The launcher's `Claimed` event records 500,000 UNIFORM and a zero refund. The token's `Transfer` event shows the tokens moving from the launcher to the bidder. [Claim receipt](https://testnet.bscscan.com/tx/0x732353fc11a666984971d62c5b7a0016d76775145823938bf515ef776354f27f) |

**At settlement (block 144,926,064).** The pair's `Sync` event records initial reserves of 500,000 UNIFORM and 4.45 WBNB (wrapped testnet BNB). In that same transaction, the Vault Factory emitted `UniformVaultCreated(vault, token, launcher)`, linking all three addresses below. [Settlement events](https://testnet.bscscan.com/tx/0x56d87f21c4dbd55227d9e619986555f150c7da5ddec5db663b201a9b9985ae20#eventlog)

**Subsequent contract read (block 145,019,617).** Flap Portal's `getLaunchVault(token)` returned the Vault and Vault Factory listed below. The launcher reported `statusCode() = 1` (launched), and the bidder held 500,000 UNIFORM. 结算时的金库绑定由发射回执确认，后续区块读取用于复核。交易税到账及金库 owner 提款另有本地分叉记录。[Fork tax and withdrawal evidence](e2e-evidence.md)

| Contract · 合约 | BSC Testnet address |
| --- | --- |
| Flap Portal | [0x000042108465206185A077Edc3F3fd2b49060000](https://testnet.bscscan.com/address/0x000042108465206185A077Edc3F3fd2b49060000) |
| Uniform Launcher Factory | [0xE82642aC5c3B3B4b7D4cDeaf6a251Dc0BB7AcEfd](https://testnet.bscscan.com/address/0xE82642aC5c3B3B4b7D4cDeaf6a251Dc0BB7AcEfd) |
| Launcher | [0xEc6410ACea44ac8aaD7f048f68CE45D3c113c59e](https://testnet.bscscan.com/address/0xEc6410ACea44ac8aaD7f048f68CE45D3c113c59e) |
| UNIFORM token · 代币 | [0x1f2BECb4418D444bd7659CaD892463dAeAF07777](https://testnet.bscscan.com/address/0x1f2BECb4418D444bd7659CaD892463dAeAF07777) |
| PancakeSwap V2 pair · 池 | [0xb46442c9Ba4fb3e26d65fe6ee2171f7d8Ee642b3](https://testnet.bscscan.com/address/0xb46442c9Ba4fb3e26d65fe6ee2171f7d8Ee642b3) |
| Vault | [0x18942571eE5E5642837326C2Fe18510270fEEEce](https://testnet.bscscan.com/address/0x18942571eE5E5642837326C2Fe18510270fEEEce) |
| Uniform Vault Factory | [0x2EF7a93b2fE4FBF520D5210b3ea39a72E5133dc6](https://testnet.bscscan.com/address/0x2EF7a93b2fE4FBF520D5210b3ea39a72E5133dc6) |

## Verify with Foundry · 只读复核

With Foundry's `cast` and `jq` installed, decode the settlement and read the current Vault binding from a public BSC Testnet node. The decoded event lists the clearing price (8,900,000,000,000 wei per token), pool quote (4,450,000,000,000,000,000 wei), token and pair, in that order. Both BNB amounts use 18 decimals.

```sh
rpc='https://data-seed-prebsc-1-s1.bnbchain.org:8545'
settle_tx='0x56d87f21c4dbd55227d9e619986555f150c7da5ddec5db663b201a9b9985ae20'
sig='AuctionSettled(uint256,uint256,address,address)'
cast chain-id --rpc-url "$rpc"                    # 97
cast receipt "$settle_tx" status --rpc-url "$rpc"  # true
settled_data=$(cast receipt "$settle_tx" --json --rpc-url "$rpc" |
  jq -r --arg topic "$(cast keccak "$sig")" '.logs[] | select(.topics[0] == $topic) | .data')
cast decode-event --sig "$sig" "$settled_data"
cast call 0x000042108465206185A077Edc3F3fd2b49060000 \
  'getLaunchVault(address)(address,address)' 0x1f2BECb4418D444bd7659CaD892463dAeAF07777 --rpc-url "$rpc"
```
