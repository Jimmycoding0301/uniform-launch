// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IAgentIdentitySource} from "./IAgentIdentitySource.sol";

/// @notice 官方 ERC-8004 Identity Registry 上实际存在的两个视图。
///         2026-11-25 在测试网 `0x8004A818BFB912233c491871b3d84c89A494BD9e` 读过：
///         `ownerOf(uint256)` 与 `getAgentWallet(uint256)` 都返回 address。
interface IErc8004IdentityRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
    function getAgentWallet(uint256 agentId) external view returns (address);
}

/// @notice 核对申报的 agentId。地址是该 NFT 的 owner，或官方登记的 agentWallet，即通过。
///         注册表地址在构造时固定，必须是官方 Identity Registry，而不是自建注册表。
contract Erc8004Source is IAgentIdentitySource {
    bytes32 public constant SOURCE_ID = keccak256("erc-8004");

    IErc8004IdentityRegistry public immutable registry;

    error ZeroRegistry();

    constructor(address registry_) {
        if (registry_ == address(0)) revert ZeroRegistry();
        registry = IErc8004IdentityRegistry(registry_);
    }

    function verify(address account, uint256 agentId) external view returns (bool ok, bytes32 sourceId) {
        sourceId = SOURCE_ID;
        if (account == address(0)) return (false, sourceId);
        try registry.ownerOf(agentId) returns (address owner) {
            if (owner == account) return (true, sourceId);
        } catch {
            return (false, sourceId);
        }
        try registry.getAgentWallet(agentId) returns (address wallet) {
            if (wallet != address(0) && wallet == account) return (true, sourceId);
        } catch {}
        return (false, sourceId);
    }
}
