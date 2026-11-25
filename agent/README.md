# 代理接口

命令在仓库根目录跑。默认读 `.env` 的 `BSC_TESTNET_RPC_URL`，没有就用公共测试网。下面的输出是本机分叉 `http://127.0.0.1:18545` 上的真实结果。工具不签名，不广播。

## 不带 --json

```text
接单。清算价 0.00002 BNB/枚。出价 9 笔，还差 23 笔。剩余 19745 个区块。保留价 0.00001。
```

这是 `status` 对着演示场的原文。带 `--json` 的字段在下面。演示场的 `preview()` 和模拟器一致：清算价 `20000000000000`，入池 `10000000000000000000`。

## status

```sh
node agent/cli.mjs status --launcher 0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1 --rpc http://127.0.0.1:18545 --json
```

```json
{
  "ok": true,
  "phase": "接单",
  "block": "144799285",
  "remainingBlocks": "19745",
  "floorPrice": "0.00001",
  "clearingPrice": "0.00002",
  "bidCount": 9,
  "seatsLeft": 23,
  "minPoolQuote": "4.335714"
}
```

## simulate

```sh
node agent/cli.mjs simulate --launcher 0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1 --rpc http://127.0.0.1:18545 --budget 1 --max-price 0.00003 --json
```

```json
{
  "ok": true,
  "clearingPrice": "0.00002",
  "tokens": "50000",
  "spend": "1",
  "refund": "0",
  "meetsMinPool": true,
  "poolQuote": "10"
}
```

## identity

```sh
node agent/cli.mjs identity --launcher 0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1 --rpc http://127.0.0.1:18545 --address 0x00000000000000000000000000000000c0de0002 --agent-id 3235643394 --json
```

```json
{
  "ok": true,
  "results": [
    { "index": 0, "ok": true, "name": "Agent ID" },
    { "index": 1, "ok": false, "name": "ERC-8004" }
  ]
}
```

## bid-tx

```json
{
  "ok": true,
  "to": "0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1",
  "value": "1000000000000000000",
  "valueBnb": "1",
  "gas": "8000000",
  "chainId": 97,
  "instruction": "在 BNB Smart Chain 测试网操作。链编号 97。\n先确认这是测试网，再确认身份。币安 Agent ID 或 ERC-8004 有一个即可。两个都没有就停。\n不要改金额，不要多发一笔。先用 baw 预览，确认后再执行。\n预算 1 BNB，最高价 0.00003 BNB/枚。\n动作：出价。"
}
```

`data` 是 `bid(uint256,uint8,uint256)` 的编码，这里不重复整段。

## settle-tx

接单场会拒绝。待结算场 `0xdA237694120AFC09f2005b0F00dAfA70974ABe82`：

```json
{
  "ok": true,
  "to": "0xdA237694120AFC09f2005b0F00dAfA70974ABe82",
  "value": "0",
  "data": "0x11da60b4",
  "gas": "8000000",
  "chainId": 97
}
```

## claim-tx

已发射场 `0xE20f0043F32E2E38d3F3d76Ec48Cfcdb0FdC4806` 返回 `data` `0x4e71d92d`，金额 0。接单场返回「现在不能领取」。

## refund-tx

失败场 `0x6f10Eb8eD5c3B033a9EAB172544A4a86420eb128` 返回 `data` `0x590e1ae3`，金额 0。接单场返回「现在不能退款」。

## MCP

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"check","version":"0"}}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"simulate_bid","arguments":{"launcher":"0xdE5F5e380689d23E3fcC3E8c2Af3bf066931b2a1","rpc":"http://127.0.0.1:18545","budget":"1","maxPrice":"0.00003"}}}
```

返回：

```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"serverInfo":{"name":"uniform-agent","version":"0.1.0"}}}
{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"{\"ok\":true,\"clearingPrice\":\"0.00002\",\"tokens\":\"50000\",\"spend\":\"1\",\"refund\":\"0\",\"meetsMinPool\":true,\"poolQuote\":\"10\"}"}]}}
```

配置片段：

```json
{
  "mcpServers": {
    "uniform": {
      "command": "node",
      "args": ["agent/mcp.mjs"]
    }
  }
}
```
