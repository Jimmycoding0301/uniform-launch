// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IAgentIdentitySource} from "./IAgentIdentitySource.sol";
import {AgentIdentityAddresses} from "./AgentIdentityAddresses.sol";

interface IAgentIdNft {
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
}

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

    /// @notice Production bids identify the NFT by its ERC-721 token ID.
    function verify(address account, uint256 agentId) external view returns (bool ok, bytes32 sourceId) {
        sourceId = SOURCE_ID;
        if (account == address(0)) return (false, sourceId);
        try nft.ownerOf(agentId) returns (address owner) {
            return (owner == account, sourceId);
        } catch {}
        if (!standIn || block.chainid != 97) return (false, sourceId);

        // Historical testnet stand-ins may expose only balanceOf (or optional enumeration).
        try nft.balanceOf(account) returns (uint256 balance) {
            if (balance == 0) return (false, sourceId);
        } catch {
            return (false, sourceId);
        }
        (bool enumerates, bytes memory result) = address(nft)
            .staticcall(abi.encodeWithSignature("tokenOfOwnerByIndex(address,uint256)", account, uint256(0)));
        if (enumerates && result.length == 32) return (abi.decode(result, (uint256)) == agentId, sourceId);
        return (uint160(account) == agentId, sourceId);
    }
}
