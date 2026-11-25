// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IBinanceAgentDirectory} from "src/uniform/BinanceAgentIdSource.sol";

/// @dev 只给本地演示和旧路径测试用。任何非零地址都有一个由地址本身决定的 Agent ID。
///      测试网部署不要用它。
contract PermissiveAgentDirectory is IBinanceAgentDirectory {
    function agentIdOf(address wallet) external pure returns (uint256) {
        return uint256(uint160(wallet));
    }
}
