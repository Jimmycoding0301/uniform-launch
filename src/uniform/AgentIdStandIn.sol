// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice 测试网替身。BNB 主网 Agent ID 合约在 chain 97 上没有代码。
///         只提供 `balanceOf`。调用 `claim()` 的地址余额变为 1。没有管理员，不能改别人的余额。
///         主网配置必须指向真合约，不要部署这一份。
contract AgentIdStandIn {
    mapping(address => uint256) public balanceOf;

    function claim() external {
        balanceOf[msg.sender] = 1;
    }
}
