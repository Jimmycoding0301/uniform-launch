开工：Wed Nov 25 07:26:05 PM UTC 2026

v1 盘点。现状：合约已在 `src/uniform/`，测试网地址在 `deployments/bsc-testnet.json`，Flap 未开工厂权限。页面在 `web/`，r14 视觉和检查脚本已在。分叉测试 `test/Uniform.fork.t.sol` 已有成功发射、失败退款、买卖税和 `withdrawAll`，但没有把三种身份、模拟器对照和提税差额串成一条。没有 Flap 组件包，没有代理 CLI/MCP，没有按评审维度写的 README。

本轮计划：v2 Flap 组件并通过检查器；v3 把 `UniformSettle` 移植成共享模拟器并对照链上 `preview()`；v4 CLI、MCP、`llms.txt`；v5 端到端分叉彩排和证据；v6 同价对照；v7 演示模式；v8 提交材料；v9 演示稿；v10 清理并开 PR。已部署合约不改。
Wed Nov 25 07:29:21 PM UTC 2026
v2 Flap 组件包。官方 launcher-check-source 对示例和我们的目录都返回 ok: true。自写 flap-ui/check.mjs 也通过。四张假数据截图在 qa/r15/flap-mock-*.png。没有声明 transactions。
Wed Nov 25 07:30:18 PM UTC 2026
v3 模拟器。shared/settle.mjs 按 UniformSettle 逐行移植。forge test --match-contract UniformSimulatorTest 通过，20 组向量和库一致。node agent/settle.test.mjs 通过。网页曲线只负责画，不算清算价，所以没有第二份算法。
Wed Nov 25 07:34:23 PM UTC 2026
v4 代理接口。status、simulate、identity、bid-tx、settle-tx、claim-tx、refund-tx 都对着本机分叉跑出真实结果。MCP initialize、tools/list、tools/call simulate_bid 通过。扫描没有签名或广播。
Wed Nov 25 07:40:19 PM UTC 2026
v5 端到端。UniformE2EForkTest 两条新测试通过。e2e-fork.sh 从零跑完七个阶段，金库增加 27516256919450703 wei，owner 增加相同数额。公共测试网不广播时停在未开权限；带广播时脚本拒绝。
Wed Nov 25 07:43:46 PM UTC 2026
v6 对照。同一组出价，同价单价比是 1，常数乘积曲线在总募资相同的口径下是 2.8284。数字写进 docs/why-uniform.md，并标明是模拟。
Wed Nov 25 07:43:46 PM UTC 2026
v7 演示模式。/?demo=1 底部六幕场记条，左右键和 Esc。1440 按钮上沿 796、下沿 844，演示条从 844 起，不重叠。390 按钮 692 到 744，演示条从 788 起。截图在 qa/r15/demo-*.png。
Wed Nov 25 07:48:36 PM UTC 2026
修正对照数字。compare.mjs 改读演示场的 9 笔真实出价，同价单价比 1，曲线 1.7789。模拟器和链上 preview 一致：清算价 20000000000000，入池 10000000000000000000。手机演示条高度改成 64px，按钮下沿 744，条上沿 780，不重叠。
