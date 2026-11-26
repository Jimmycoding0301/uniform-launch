# Uniform Launch on Flap

The four files in `uniform-launch/` provide a Flap standalone Mini App v2 for BSC Testnet, chain 97. The checked-in template lets visitors review an auction draft before a candidate factory is deployed. The creator enters an IPFS CID, a reserve, an auction duration and an optional wallet list. Each signed action uses the wallet already connected to Flap and requires a separate confirmation after simulation.

## Prepare a deployment-specific build

Verify the new factory on chain 97, review its source and compute the Keccak-256 hash of its deployed runtime bytecode. Prepare a fresh output directory under an existing parent. The historical factory is excluded because it lacks this version’s certified adapter and launcher resolver functions.

```sh
node flap-ui/mini-app/prepare.mjs /path/to/staging/uniform-launch "$REVIEWED_FACTORY" "$REVIEWED_FACTORY_CODE_HASH"
```

In a checkout of the [Flap template](https://github.com/flap-sh/flap-vault-component-template), run the commands below. Scaffolding registers the slug. If it is already registered in that checkout, copy the four files directly to its existing directory.

```sh
yarn install --frozen-lockfile
yarn app:scaffold uniform-launch
cp /path/to/staging/uniform-launch/* src/vaults/uniform-launch/
yarn app:check uniform-launch
yarn app:e2e uniform-launch
yarn app:package uniform-launch
yarn app:verify-package dist/uniform-launch.zip
```

The host routes are `/apps/uniform-launch/create` and `/apps/uniform-launch/launcher/<address>`. The builder binds the reviewed factory in the source and manifest. Wallet permissions apply to the fixed chain-97 Portal and to auction addresses returned by the factory’s `resolveLauncher(address)` after checking the Portal registry. The testnet creation payment is capped at 0.005 tBNB and per-bid value at 100 tBNB. The component queries the current Portal fee, verifies the signing account again before submission, and preserves a submitted hash for receipt reconciliation.

Creation encodes the Solidity `LaunchConfig` as one tuple. It reads the factory’s two certified adapters in Binance Agent ID / ERC-8004 order and mines a salt for an ERC-1167 token address ending in `7777`, using Portal `0x000042108465206185A077Edc3F3fd2b49060000` and token implementation `0x7777c57ff7dc441c1715b2e36fa581c48B782222`. Existing auctions expose their own adapter order on the detail page. The Binance identity on testnet uses the stand-in. Status, price, bid cutoff and settlement availability come from the launcher and chain head.

部署前可在创建页核对本地草稿。公开测试网上的钱包流程需要绑定已核验的新工厂，打包并由 Flap 宿主启用。创建、出价、结算、领取和退款均先模拟，再由用户在 Flap 钱包中确认。出价按该场真实的身份适配器顺序编码。
