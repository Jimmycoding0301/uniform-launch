# 架构

## 系统组件

```mermaid
flowchart LR
  operator[代理操作者] --> agent[代理]
  agent --> baw[baw]
  baw --> binance[币安 App]
  page[页面] --> cli[命令行和 MCP]
  cli --> launcher[UniformLauncher]
  launcher --> sources[身份来源]
  launcher --> portal[Flap Portal]
  portal --> pancake[PancakeSwap V2]
  portal --> vault[UniformVault]
  creator[创建者] --> vault
```

操作者把指令交给代理。代理只生成未签名交易。用户在币安 App 里确认。Launcher 核对身份，窗口结束后一次清算。Portal 建池并把税送进 Vault。创建者是 Vault 的 owner。

## 结算时序

```mermaid
sequenceDiagram
  participant anyone as 任何人
  participant launcher as Launcher
  participant portal as Portal
  anyone->>launcher: settle
  launcher->>launcher: 模拟清算
  alt 入池不够或预检不过
    launcher->>launcher: 失败，之后可全额退款
  else 通过
    launcher->>portal: launchTaxTokenV2
    portal->>launcher: initializeDistribution
    launcher->>launcher: 记下成交和应退金额
  end
```

模拟先算出清算价和每人的成交。新版读取 Portal 的报价、创建线和毕业线，取较高门槛，向上折算为 BNB，再加 0.05 BNB 流动性余量。入池低于门槛或未通过 Portal 的布尔预检时，可以全额退款。报价不可用时，结算回滚，保持拍卖状态等待重试。建池、分发和记账在一次调用内。剩余 gas 低于该场的 `MIN_SETTLE_GAS()` 时，结算在修改状态前回滚。

## 用户路径

```mermaid
flowchart TB
  subgraph creatorLane [创建者]
    c1[准备 RPC 和测试币] --> c2[模拟 create]
    c2 --> c3[确认后创建 Launcher]
    c3 --> c4[发射成功后从 Vault 提税]
  end
  subgraph agentLane [代理操作者]
    a1[status] --> a2[simulate 和身份检查]
    a2 --> a3[拿到未签名出价]
    a3 --> a4[币安 App 确认]
    a4 --> a5[结算后领取或退款]
  end
  subgraph judgeLane [评委]
    j1[README 评审表] --> j2[演示模式六幕]
    j2 --> j3[Flap 组件和分叉证据]
  end
```

三条路径互不代替。评委不用持有测试币。代理操作者不创建拍卖。创建者不替代理签名。
