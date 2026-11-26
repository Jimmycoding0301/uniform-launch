# Uniform Launch · One-Price Auctions（同价发射）

A buyer chooses a budget and a maximum price. When bidding closes, everyone who fills pays the same price. If the auction meets its funding conditions, Flap issues the token and seeds a PancakeSwap V2 pool in the settlement transaction. Otherwise, every bidder can claim their full bid back.

**Launched on public BSC Testnet, chain 97.** One bid cleared at **0.0000089 tBNB per UNIFORM**. The pool opened with **500,000 UNIFORM and 4.45 WBNB**. The bidder claimed the other **500,000 UNIFORM**. [Settlement & pool creation](https://testnet.bscscan.com/tx/0x56d87f21c4dbd55227d9e619986555f150c7da5ddec5db663b201a9b9985ae20) · [Bidder’s claim](https://testnet.bscscan.com/tx/0x732353fc11a666984971d62c5b7a0016d76775145823938bf515ef776354f27f)

## 问题与机制 · Why auction the opening price?

On a rising bonding curve, buying earlier can get you more tokens for the same budget. In a fixed-price presale, the organizer chooses the unit price up front. Here, buyers’ limits and budgets determine one clearing price subject to the reserve. Bidding earlier cannot buy a cheaper winning unit in the same auction. At an exact marginal-price tie, order can still affect allocation. [Three-way worked example](docs/why-uniform.md)

买家填预算与最高价，成交者同价。达到发射条件后，任何人都能调用结算，由 Flap 发币并建池。整场失败时，每人可领回全部出价本金。

### Verify the Flap entry

| 要求 · Deliverable | Open this |
| --- | --- |
| Launcher Factory and complete testnet launch | [Verified Factory source](https://testnet.bscscan.com/address/0xE82642aC5c3B3B4b7D4cDeaf6a251Dc0BB7AcEfd#code) · [All five public receipts and contract addresses](docs/public-testnet-evidence.md) |
| Our custom Flap interface | [Flap runtime component and manifest](flap-ui/launcher-detail/) · [Rendered component with sample data](qa/r15/flap-mock-1.png) · [Official source checker result](docs/flap-integration.md) |
| Open code and mechanism | [Auction contracts](src/uniform/) · [Agent CLI and MCP tools](agent/) · [Short submission brief](docs/hackquest-submission.md) |

[English–Chinese pitch deck](qa/submission/Uniform-Launch-BNB-Bangkok.pptx) · [60-second walkthrough](docs/judge-demo.md) · [Six demo screens](qa/submission/README.md) · [Pitch script and judge Q&A](docs/pitch-runbook.md)

## Follow the five public transactions

| BSC Testnet · 26 Nov 2026 | What the receipt shows |
| --- | --- |
| [1 · Register test identity](https://testnet.bscscan.com/tx/0x4df7fbf222c358de87017d42267aabf006c525abdc505634369b1c6cfc78b2d0) | The bidder received the test Agent ID used by this auction. |
| [2 · Create the auction](https://testnet.bscscan.com/tx/0x5be4952fc75b9d2aec691ae0288eed53ee922e53552fce9812da24c1410ab93c) | Flap Portal called our Factory. The Factory emitted `UniformLauncherCreated`. The creation transaction carried the 0.005 tBNB salt-lock fee. |
| [3 · Bid](https://testnet.bscscan.com/tx/0xac2f7be859199de2d0fc11c57fcdf59308b5f856b5928afa75aaecde40dafa01) | One buyer committed 4.45 tBNB with a maximum price of 0.000009 tBNB per token. |
| [4 · Settle, issue and add liquidity](https://testnet.bscscan.com/tx/0x56d87f21c4dbd55227d9e619986555f150c7da5ddec5db663b201a9b9985ae20#eventlog) | At block 144,926,064 the Launcher cleared the auction. The pair recorded its opening reserves and the Vault Factory created the project Vault. |
| [5 · Claim](https://testnet.bscscan.com/tx/0x732353fc11a666984971d62c5b7a0016d76775145823938bf515ef776354f27f#eventlog) | The Launcher emitted `Claimed` and the token transferred 500,000 UNIFORM to the bidder. |

**Which results came from the fork?** The nine-bid pricing example, the three-bid refund scenario and the buy/sell tax withdrawal were separate local rehearsals. In the refund scene, 3 BNB falls short of the roughly 4.34 BNB pool minimum and all three bidders can reclaim their budgets. In the Vault rehearsal, trades generated 0.027516256919450703 tBNB and the owner withdrew that amount. [Local fork evidence](docs/e2e-evidence.md)

## Try the bidding desk

![Our bilingual bidding desk showing the local order book and indicative clearing price](qa/submission/scene-1.png)

Install Foundry (forge, cast and anvil), Node.js 22.6 or later, npm, Python 3, curl and Git. On Windows use WSL2. The demo reads a public BSC Testnet RPC and runs its transactions on a local Anvil fork. [Foundry installation](https://getfoundry.sh/introduction/installation/)

```sh
git clone --recurse-submodules https://github.com/Jimmycoding0301/uniform-launch.git
cd uniform-launch
bash script/demo.sh
```

Open the local demo URL printed by the script. Append `&lang=en` for English. In scene 3, keep the budget at **1 BNB** and switch the limit from **0.00003** to **0.000015**. The first preview fills 50,000 tokens. The second fills zero and returns the 1 BNB budget. A later bid can change either preview. The agent reads the book, compares the outcomes and prepares an unsigned transaction. The buyer reviews and authorizes it. [Recorded MCP responses](qa/submission/agent-preview.json) · [Agent commands](agent/README.md)

To inspect the actual launch in the desk, use `/?network=testnet&launcher=0xEc6410ACea44ac8aaD7f048f68CE45D3c113c59e&lang=en` on the same local web origin. The [saved public-launch screen](qa/submission/public-launch.png) and [six-scene walkthrough](qa/submission/README.md) also open without an RPC connection.

After the demo script returns, leave its local services running. From the repository root:

```sh
npm --prefix web test
npm --prefix web run build
forge test
npm --prefix agent ci
bash script/check.sh
```

The browser tests use installed Google Chrome or Playwright Chromium. For the latter, run `(cd web && npx playwright install chromium)` before the web tests. Forge runs the unit suite without an RPC. To include the BSC Testnet fork suite, set `BSC_TESTNET_RPC_URL` to a public testnet RPC. [Foundry configuration](foundry.toml) · [Tests](test/) · [Flap review responses and four-bid walkthrough](docs/preaudit-response.md)

中文操作顺序：先初始化子模块并运行 `bash script/demo.sh`，打开终端打印的演示地址。按左右键切换六幕，再运行网页和合约测试。网页可复制出价指令，代理预览，买家确认签名，页面核对回执。

## How the project meets the judging criteria

| Criterion | What to inspect |
| --- | --- |
| Design and usability | The bilingual desk lets the buyer compare a fill and a refund before copying the instruction to their agent. The Flap component shows a bid, claim or refund instruction according to the launch state. [Desk screens](qa/submission/README.md) · [Custom Flap component](flap-ui/launcher-detail/Component.tsx) |
| Scalability | A shared Factory creates a separate Launcher per auction. This implementation supports 128 bids per auction. A full 128-bid launch used 8,673,707 gas in the BSC testnet fork test. The public Launcher in the receipts above supports 32 bids. [Factory](src/uniform/UniformLauncherFactory.sol) · [Gas measurement and limits](docs/security.md) |
| Innovation | Two local buyers each budgeted 2.5 BNB. The simulated curve allocated about 181,000 and 153,000 tokens. The batch allocated 125,000 each at a price discovered from bids. The first-to-last unit-price ratio was 1.7789 on the simulated curve and 1 on the batch. A fixed presale at the eventual clearing price gave the same fills and required choosing the price beforehand. [Assumptions and calculations](docs/why-uniform.md) |
| Open source | MIT-licensed contracts, Flap component, web desk, agent tools and a one-command local demo. [License](LICENSE) · [Demo script](script/demo.sh) · [Flap integration](docs/flap-integration.md) |
| Use of BNB Chain | The public testnet launch used Flap Portal and our Factory, created a PancakeSwap V2 pair, registered the Vault and delivered the bidder’s allocation. [Token, pool, Vault and receipts](docs/public-testnet-evidence.md) |

Each auction can use one to four identity sources. A wallet and a given identifier within its source can each bid once. The public launch used a Binance Agent ID stand-in. Protection against one person obtaining several identities depends on issuer policy. [Binance Agent ID and ERC-8004 adapters](src/) · [Deployment addresses](deployments/bsc-testnet.json)

## Roadmap and business model · 路线图与收入

Uniform currently charges no protocol fee. The roadmap proposes a **0.1% protocol fee on successful auction proceeds**. For example, on 100 BNB of filled bids, 0.1 BNB would go to the protocol and 99.9 BNB would seed the pool. The amount added to liquidity must still meet Flap’s minimum. Failed auctions would keep full refunds of bid principal. The creator’s configured post-launch trading tax continues to go to their Vault. [Roadmap and accounting](docs/roadmap.md)

收入计划是成功发射时，按实际成交额收取 **0.1% 协议费**。未成交的预算不计费，失败场仍可领回全部出价本金。公开测试网这次发射的 4.45 tBNB 全部入池。

## Dependencies and license

The contracts use forge-std, OpenZeppelin, Solady and Flap interfaces. The desk and agent use React, Vite and viem. Geist is licensed under the SIL Open Font License. [Flap reference implementation](https://github.com/flap-sh/FlapPoolLaunchVaultExample) · [Uniform Launch MIT license](LICENSE)
