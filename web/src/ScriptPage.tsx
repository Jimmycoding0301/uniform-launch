import { Zh } from "./motion";

type Desk = { open?: string; launched?: string; failed?: string } | null;

export function ScriptPage({ demo }: { demo: Desk }) {
  const open = href(demo?.open);
  const launched = href(demo?.launched);
  const failed = href(demo?.failed);
  return (
    <article className="script">
      <h1>三分钟演示</h1>
      <p className="lede">
        <Zh text="只在本机分叉上看。页面角标写着「本地分叉，不是测试网」。这一晚不向活网发交易，不导出、不粘贴私钥。复制出来的指令留给代理先预演，台上停在「已复制」，不执行。" />
      </p>
      <ol>
        <li>
          <div className="when">0:00</div>
          <h2>打开接单场</h2>
          <p>{open ? <a href={open}>打开这场</a> : "地址还在读。"}</p>
          <p>
            <Zh text="屏幕上是台阶曲线，顶部写「当前清算价 BNB/枚」。有名字的代理是浅色，没有名字的地址是灰色，例如 0x0000…000c。横轴右端标着累计 BNB。风险句「最后区块的加价会抬高清算价。」只在接单时出现。" />
          </p>
        </li>
        <li>
          <div className="when">0:45</div>
          <h2>复制出价指令</h2>
          <p>
            <Zh text="预算填 1，最高价填 0.00009。点「复制出价指令」。按钮变成「已复制」。" />
          </p>
          <p>
            <Zh text="剪贴板第一句写明这是 BNB Chain 测试网，链编号 97。接着要求先确认测试网，再确认币安 Agent ID 或 ERC-8004 官方登记。然后只有一笔出价：这场合约、预算、最高价、身份来源。口头说明代理要先预演，确认后再执行。台上不发。" />
          </p>
        </li>
        <li>
          <div className="when">1:20</div>
          <h2>新出价入场</h2>
          <p>
            <Zh text="本机分叉再进一笔时，列表里新的一行铺上金色底，1.2 秒淡掉。地址仍然是灰色，有名字的仍然是浅色。不要为了这一下改节点地址，也不要碰私钥。" />
          </p>
        </li>
        <li>
          <div className="when">1:40</div>
          <h2>打开已发射</h2>
          <p>{launched ? <a href={launched}>打开这场</a> : "地址还在读。"}</p>
          <p>
            <Zh text="顶部标签改成「开盘价 BNB/枚」。结算前的台阶还在，淡到能看见哪些单子成交，上面留着清算价线。左栏是带金色左边条的结果卡：开盘价、入池 BNB、代币和池子。地址可以复制，也可以打开 BscScan。结果卡下面的分组标题是「本场参数」，里面那一行叫「入池代币」，是 500,000 枚，和「入池 BNB」不是同一件事。" />
          </p>
          <p>
            <Zh text="点「复制领取指令」。剪贴板里是领取，金额为 0。不执行。" />
          </p>
        </li>
        <li>
          <div className="when">2:20</div>
          <h2>打开失败场</h2>
          <p>{failed ? <a href={failed}>打开这场</a> : "地址还在读。"}</p>
          <p>
            <Zh text="顶部标签是「结果」，大字是「没有成交」，曲线是灰的。列表里是待退款或已退回。点「复制退款指令」。剪贴板里是退款，金额为 0。不执行。" />
          </p>
        </li>
        <li>
          <div className="when">2:45</div>
          <h2>收在复制，不发</h2>
          <p>
            <Zh text="回到接单场，再指一次角标。三份指令都停在剪贴板：出价、领取、退款。没有一笔发到链上。" />
          </p>
        </li>
      </ol>
    </article>
  );
}

function href(address?: string) {
  if (!address) return "";
  return `${window.location.origin}/?launcher=${address}`;
}
