// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IAgentIdentitySource} from "./IAgentIdentitySource.sol";
import {AgentIdentityAddresses} from "./AgentIdentityAddresses.sol";

/// @notice SPACE ID Agent ID（symbol AI）上实际能用的余额视图。
///         主网 `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` 实现了 `balanceOf`。
///         `supportsInterface(0x780e9d63)` 为 false，`tokenOfOwnerByIndex` 会 revert。
interface IAgentIdNft {
    function balanceOf(address owner) external view returns (uint256);
}

/// @notice 余额大于 0 才是代理。能枚举时 agentId 取 `tokenOfOwnerByIndex(account, 0)`，
///         否则取 `uint160(account)`。申报的 agentId 必须等于这个值。
///         NFT 地址在构造时固定。不是主网真合约时 `standIn()` 为 true。
contract BinanceAgentIdSource is IAgentIdentitySource {
    bytes32 public constant SOURCE_ID = keccak256("binance-agent-id");

    IAgentIdNft public immutable nft;
    bool public immutable standIn;

    error ZeroNft();

    constructor(address nft_) {
        if (nft_ == address(0)) revert ZeroNft();
        nft = IAgentIdNft(nft_);
        standIn = nft_ != AgentIdentityAddresses.AGENT_ID_MAINNET;
    }

    function verify(address account, uint256 agentId) external view returns (bool ok, bytes32 sourceId) {
        sourceId = SOURCE_ID;
        if (account == address(0)) return (false, sourceId);
        try nft.balanceOf(account) returns (uint256 balance) {
            if (balance == 0) return (false, sourceId);
        } catch {
            return (false, sourceId);
        }
        ok = agentId == _canonicalId(account);
    }

    function _canonicalId(address account) internal view returns (uint256) {
        (bool success, bytes memory data) = address(nft)
            .staticcall(abi.encodeWithSignature("tokenOfOwnerByIndex(address,uint256)", account, uint256(0)));
        if (success && data.length >= 32) return abi.decode(data, (uint256));
        return uint160(account);
    }
}
