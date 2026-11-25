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
Wed Nov 25 07:48:38 PM UTC 2026
v8 提交材料。README 按评审维度重写，架构三张图，路线图，MIT，env 示例，docker-compose。本环境没有 docker，demo.sh 不依赖它，已打印页面和演示地址。
Wed Nov 25 07:49:56 PM UTC 2026
第二次从零跑 e2e-fork.sh。清算价 0.00008，入池 40 BNB，金库和 owner 都是 27516256919450703 wei。证据改成这次的哈希。出价指令和网页同一口径：先确认测试网和身份，baw 预览后再执行。
Wed Nov 25 07:50:40 PM UTC 2026
把分叉测试的公共准备抽到 ForkBase。UniformForkTest 和端到端测试各跑各的，不再把同一批分叉测试跑两遍。端到端成功和失败退款仍通过。
Wed Nov 25 07:52:16 PM UTC 2026
切幕时先清掉上一场的读数，避免演示里短暂看到错的清算价。命令行不带 --json 时打中文短句。演示六幕检查加进 npm test，通过。
Wed Nov 25 07:52:36 PM UTC 2026
命令行默认打中文短句。docker-compose 改成显式入口，避免镜像把 anvil 当成参数。还没在本机跑过 docker。
Wed Nov 25 07:53:02 PM UTC 2026
方向键在输入框里不再切幕。对照脚本在没有清算价时停下来，不算出一个没意义的比值。
Wed Nov 25 07:54:04 PM UTC 2026
修正 README 里写错的身份编号，改成 3235774466。MCP 遇到坏行和通知不再断开，未知方法返回错误码。演示场命令口径有回归测试。
Wed Nov 25 07:55:23 PM UTC 2026
已发射回执加上金库余额。本机分叉的已发射池做了一笔买卖并分税，页面读到 0.0135 BNB。完整提走数额仍以端到端证据为准。
