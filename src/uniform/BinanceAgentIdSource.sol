// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IAgentIdentitySource} from "./IAgentIdentitySource.sol";

/// @notice 币安 Agent ID 目录。链上没有公开的官方注册表时，这个接口由调用方在创建适配器时固定。
///         返回 0 表示该地址没有 Agent ID。
interface IBinanceAgentDirectory {
    function agentIdOf(address wallet) external view returns (uint256);
}

/// @notice 只读适配器。目录地址在构造时固定，没有管理员可以改。
contract BinanceAgentIdSource is IAgentIdentitySource {
    bytes32 public constant SOURCE_ID = keccak256("binance-agent-id");

    IBinanceAgentDirectory public immutable directory;

    error ZeroDirectory();

    constructor(address directory_) {
        if (directory_ == address(0)) revert ZeroDirectory();
        directory = IBinanceAgentDirectory(directory_);
    }

    function isAgent(address account) external view returns (bool ok, bytes32 sourceId, uint256 agentId) {
        sourceId = SOURCE_ID;
        if (account == address(0)) return (false, sourceId, 0);
        agentId = directory.agentIdOf(account);
        ok = agentId != 0;
    }
}
