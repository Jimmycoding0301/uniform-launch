// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IAgentIdentitySource} from "./IAgentIdentitySource.sol";

interface IErc8004Lookup {
    function agentIdOf(address account) external view returns (uint256);
    function ownerOf(uint256 agentId) external view returns (address);
    function getAgentWallet(uint256 agentId) external view returns (address);
}

/// @notice 核对地址是某个 ERC-8004 agent NFT 的 owner，或该 NFT 当前登记的 agentWallet。
///         注册表地址在构造时固定。
contract Erc8004Source is IAgentIdentitySource {
    bytes32 public constant SOURCE_ID = keccak256("erc-8004");

    IErc8004Lookup public immutable registry;

    error ZeroRegistry();

    constructor(address registry_) {
        if (registry_ == address(0)) revert ZeroRegistry();
        registry = IErc8004Lookup(registry_);
    }

    function isAgent(address account) external view returns (bool ok, bytes32 sourceId, uint256 agentId) {
        sourceId = SOURCE_ID;
        if (account == address(0)) return (false, sourceId, 0);
        agentId = registry.agentIdOf(account);
        if (agentId == 0) return (false, sourceId, 0);
        address owner = registry.ownerOf(agentId);
        address wallet = registry.getAgentWallet(agentId);
        ok = account == owner || (wallet != address(0) && account == wallet);
        if (!ok) agentId = 0;
    }
}
