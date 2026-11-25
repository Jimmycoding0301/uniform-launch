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
Wed Nov 25 07:56:46 PM UTC 2026
手机上的回执不再被拉成一整块。已发射幕在按钮上方另给一行金库余额，390 宽上沿 620、按钮上沿 716，不重叠。
Wed Nov 25 07:57:16 PM UTC 2026
失败文案不再写成未达保留价。入池不够和保留价不够都是没有成交、出价全额退回。代理的低于保留价说法和页面一致。
Wed Nov 25 07:58:45 PM UTC 2026
窄屏演示条改成一行。320 和 390 上两个按钮都在屏幕内，下沿 833，不压住主按钮。小写地址也能模拟。金额写错时直接说要用十进制。
Wed Nov 25 08:00:01 PM UTC 2026
证据文档里的 16 个哈希和记录对得上，提走数额一致。金额解析有单测。刷新了已发射和对照幕的截图。
Wed Nov 25 08:00:50 PM UTC 2026
模拟器可以指定出售量。用合约单测里的边际卡价例子对过：清算价 1，第一笔 40 枚实付 40，第二笔 60 枚实付 60、退 40。演示场 preview 仍然一致。
Wed Nov 25 08:01:26 PM UTC 2026
排序改成和合约一样：用数组位置回写成交，用 index 字段只打破同价先后。合约单测里的前缀、低于保留价、除不尽的 1 wei、空场，模拟器结果一致。
Wed Nov 25 08:01:48 PM UTC 2026
demo.sh 在演示场没有代码时停下来说明，不再打印一个打不开的地址。演示检查会看金库余额和全额退回。Flap 卡片在状态 0 时显示接单中，因为 8 个读数里没有当前区块。
Wed Nov 25 08:02:17 PM UTC 2026
删掉演示脚本页留下的样式。未签名出价交易能解回最高价、来源和身份编号。
Wed Nov 25 08:02:39 PM UTC 2026
身份编号不是整数时直接说明，不再报没有完成。README 里的曲线单价比和 why.json 对得上。
Wed Nov 25 08:03:27 PM UTC 2026
320 宽的图上，成交额标注和保留价叠在一起。只在图宽不超过 300 时把成交额往下挪 16 像素。390 的图仍是 260 高、刻度 12、viewBox 358。
Wed Nov 25 08:04:07 PM UTC 2026
未签名出价能解回参数。身份编号和过低预算有中文原因。salt 尾号是脚本挖的，合约负责 lockSalt。
Wed Nov 25 08:04:26 PM UTC 2026
README 写上了检查命令。链接和单价比仍然对得上。
Wed Nov 25 08:04:43 PM UTC 2026
余额不够时打印差额，不再打英文字段 short。
