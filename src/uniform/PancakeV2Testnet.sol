// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice PancakeSwap V2 on BNB Smart Chain testnet. Flap 确认 `dexId = 0` 用这一套。
library PancakeV2Testnet {
    address internal constant ROUTER = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1;
    address internal constant FACTORY = 0x6725F303b657a9451d8BA641348b6761A6CC7a17;
    address internal constant WBNB = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;
}
