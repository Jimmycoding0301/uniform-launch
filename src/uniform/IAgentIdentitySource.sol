// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice 一场拍卖用来核对「这个地址是不是链上代理」。
///         `sourceId` 区分来源，`agentId` 是该来源里的编号。普通钱包必须返回 ok = false。
interface IAgentIdentitySource {
    function isAgent(address account) external view returns (bool ok, bytes32 sourceId, uint256 agentId);
}
