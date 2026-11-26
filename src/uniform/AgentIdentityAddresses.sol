// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice 2026-11-25 只读核对过的官方地址。部署脚本按 chainId 选用，不在运行时改。
library AgentIdentityAddresses {
    /// @dev SPACE ID Agent ID，symbol AI。BNB 主网。`tokenOfOwnerByIndex` 会 revert。
    address internal constant AGENT_ID_MAINNET = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;
    address internal constant AGENT_ID_TESTNET_STAND_IN = 0x89c60E8E5aF13508900152e5FEE149bf5708d8a0;
    /// @dev ERC-8004 Identity Registry。BNB 主网。
    address internal constant ERC8004_MAINNET = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;
    /// @dev ERC-8004 Identity Registry。BNB 测试网。`getVersion()` 为 2.0.0。
    address internal constant ERC8004_TESTNET = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
}
