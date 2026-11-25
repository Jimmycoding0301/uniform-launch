// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice 一场拍卖用来核对「这个地址是不是它申报的那个链上代理」。
///         调用方传入 agentId。适配器只回答这一对是否成立，不从地址反查编号。
interface IAgentIdentitySource {
    function verify(address account, uint256 agentId) external view returns (bool ok, bytes32 sourceId);
}
