// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {LocalRpc} from "script/LocalRpc.sol";

contract LocalRpcTest is Test {
    function test_onlyLoopbackMayBroadcast() public pure {
        assertTrue(LocalRpc.isLocal("http://127.0.0.1:18545"));
        assertTrue(LocalRpc.isLocal("http://localhost:18545"));
        assertFalse(LocalRpc.isLocal("https://bsc-testnet-rpc.publicnode.com"));
        assertFalse(LocalRpc.isLocal("https://data-seed-prebsc-1-s1.binance.org:8545"));
        assertFalse(LocalRpc.isLocal(""));
    }
}
