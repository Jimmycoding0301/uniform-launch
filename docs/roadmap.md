# Roadmap and business model · 路线图与商业模式

**Today.** A creator can run an auction through the Flap Launcher Factory. The public BSC testnet launch put 4.45 tBNB into its PancakeSwap V2 pool. Uniform charged no launch or settlement fee. The creator’s Vault receives 100% of the configured project tax allocation. [Five public receipts](public-testnet-evidence.md) · [Tax routing](../src/uniform/UniformLauncher.sol) · [Vault withdrawals](../src/uniform/UniformVault.sol)

| Next step | What we would verify |
| --- | --- |
| Complete the public evidence | Send the checker-tested UI package to Flap for review. Run a separate underfunded auction on public testnet and publish the settlement and refund receipts together. [UI package](../flap-ui/launcher-detail/) · [Existing fork evidence](e2e-evidence.md) |
| Prepare for mainnet | Complete the Flap audit and factory approval process. Verify the production identity sources, including the real Binance Agent ID registry. The factory creates a separate launcher per auction. Each auction currently accepts up to 32 bids. A full 32-bid settlement used 5,772,154 gas on a BSC testnet fork. Repeat that test on a mainnet fork and publish the cost before opening pilots. [Factory](../src/uniform/UniformLauncherFactory.sol) · [Bid cap and gas measurement](../src/uniform/UniformLauncher.sol) |
| Improve the bidding experience | Measure how often bidders set a limit below the clearing price. Test clearer reserve-price and bid-limit guidance in the interface before changing the auction rules. |

**Protocol fee plan.** On a successful launch, charge 10 basis points (0.1%) of filled quote. Route the remainder to the pool and check Flap’s funding minimum against that net amount. For 100 BNB of filled bids, the protocol receives 0.1 BNB and the pool receives 99.9 BNB. Unfilled budgets remain refundable. If the auction fails, all bid principal is refundable. The creator keeps the configured post-launch trading-tax allocation.

Before enabling the fee, show gross fills, fee and net liquidity in the preview, verify the balances and refunds on a fork, and publish the fee recipient and the first successful receipt. Track funded launches, filled quote and protocol fees actually collected.

### 中文速读

公开测试网已跑通成功发射。4.45 tBNB 用于建池，Uniform 当前的发射费和结算费均为零，项目配置的交易税全部流向创建者金库。[测试网回执](public-testnet-evidence.md)

- **近期**把通过检查器的界面包交给 Flap，再补一场公开测试网的未达标拍卖，让评委能同时核对失败结算和退款到账。
- **主网上线前**完成审计、工厂授权和真实身份源验证。每场有独立合约，当前每场最多 32 笔出价。满场结算在测试网分叉上用了约 577 万 gas，上线前还要在主网分叉重测成本。上线后用低于清算价的出价比例，判断是否要优化保留价和限价提示。
- **协议收费**成功发射时按实际成交额收取 0.1%。例如，成交 100 BNB，协议收 0.1 BNB，净入池 99.9 BNB。以扣费后的金额核对 Flap 入池门槛。失败场仍可退回全部出价本金。上线前在报价页展示这三笔金额，并用分叉验证资金与退款对账。上线后统计成功发射量、实际成交额和链上实收费用。
