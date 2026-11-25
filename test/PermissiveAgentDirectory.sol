// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @dev 本地测试用的 Agent ID 替身。任何地址 `balanceOf` 都是 1，没有 `tokenOfOwnerByIndex`，
///      所以规范编号是 `uint160(account)`。测试网部署用 `AgentIdStandIn`，主网用真合约。
contract PermissiveAgentDirectory {
    function balanceOf(address) external pure returns (uint256) {
        return 1;
    }
}
