开工：Wed Nov 25 07:26:05 PM UTC 2026

v1 盘点。现状：合约已在 `src/uniform/`，测试网地址在 `deployments/bsc-testnet.json`，Flap 未开工厂权限。页面在 `web/`，r14 视觉和检查脚本已在。分叉测试 `test/Uniform.fork.t.sol` 已有成功发射、失败退款、买卖税和 `withdrawAll`，但没有把三种身份、模拟器对照和提税差额串成一条。没有 Flap 组件包，没有代理 CLI/MCP，没有按评审维度写的 README。

本轮计划：v2 Flap 组件并通过检查器；v3 把 `UniformSettle` 移植成共享模拟器并对照链上 `preview()`；v4 CLI、MCP、`llms.txt`；v5 端到端分叉彩排和证据；v6 同价对照；v7 演示模式；v8 提交材料；v9 演示稿；v10 清理并开 PR。已部署合约不改。
Wed Nov 25 07:29:21 PM UTC 2026
v2 Flap 组件包。官方 launcher-check-source 对示例和我们的目录都返回 ok: true。自写 flap-ui/check.mjs 也通过。四张假数据截图在 qa/r15/flap-mock-*.png。没有声明 transactions。
Wed Nov 25 07:30:18 PM UTC 2026
v3 模拟器。shared/settle.mjs 按 UniformSettle 逐行移植。forge test --match-contract UniformSimulatorTest 通过，20 组向量和库一致。node agent/settle.test.mjs 通过。网页曲线只负责画，不算清算价，所以没有第二份算法。
