// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {UniformSettle} from "src/uniform/UniformSettle.sol";

/// @notice 同一组向量，Solidity 库和 `shared/settle.mjs` 必须算出一样的清算价、入池额和每笔成交。
contract UniformSimulatorTest is Test {
    function test_twentyVectorsMatchJsSettle() public view {
        string memory json = vm.readFile("shared/vectors.json");
        for (uint256 i; i < 20; ++i) {
            string memory base = string.concat(".cases[", vm.toString(i), "]");
            uint256 floor = vm.parseJsonUint(json, string.concat(base, ".floor"));
            uint256 n = vm.parseJsonUint(json, string.concat(base, ".bidCount"));
            UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](n);
            for (uint256 j; j < n; ++j) {
                string memory row = string.concat(base, ".bids[", vm.toString(j), "]");
                bids[j] = UniformSettle.Bid({
                    index: vm.parseJsonUint(json, string.concat(row, ".index")),
                    budget: vm.parseJsonUint(json, string.concat(row, ".budget")),
                    maxPrice: vm.parseJsonUint(json, string.concat(row, ".maxPrice"))
                });
            }
            UniformSettle.Outcome memory o = UniformSettle.settle(500_000 ether, floor, bids);
            assertEq(o.ok, vm.parseJsonBool(json, string.concat(base, ".ok")));
            assertEq(o.clearingPrice, vm.parseJsonUint(json, string.concat(base, ".clearing")));
            assertEq(o.poolQuote, vm.parseJsonUint(json, string.concat(base, ".pool")));
            for (uint256 j; j < n; ++j) {
                string memory fill = string.concat(base, ".fills[", vm.toString(j), "]");
                assertEq(o.fills[j].tokens, vm.parseJsonUint(json, string.concat(fill, ".tokens")));
                assertEq(o.fills[j].spend, vm.parseJsonUint(json, string.concat(fill, ".spend")));
                assertEq(o.fills[j].refundQuote, vm.parseJsonUint(json, string.concat(fill, ".refund")));
            }
        }
    }

    function test_edgesMatchTheSameRules() public pure {
        uint256 sell = 500_000 ether;
        UniformSettle.Bid[] memory full = new UniformSettle.Bid[](32);
        for (uint256 i; i < 32; ++i) {
            full[i] = UniformSettle.Bid(i, 0.2 ether, 1e16);
        }
        UniformSettle.Outcome memory a = UniformSettle.settle(sell, 1e13, full);
        assertTrue(a.ok);
        assertEq(a.poolQuote, 6.4 ether);
        uint256 tokens;
        for (uint256 i; i < 32; ++i) {
            tokens += a.fills[i].tokens;
            assertEq(a.fills[i].spend + a.fills[i].refundQuote, 0.2 ether);
        }
        assertLe(tokens, sell);

        UniformSettle.Bid[] memory one = new UniformSettle.Bid[](1);
        one[0] = UniformSettle.Bid(0, 20 ether, 1e16);
        UniformSettle.Outcome memory b = UniformSettle.settle(sell, 1e13, one);
        assertEq(b.fills[0].tokens, sell);
        assertEq(b.poolQuote, 20 ether);

        UniformSettle.Bid[] memory exact = new UniformSettle.Bid[](1);
        exact[0] = UniformSettle.Bid(0, 4335714285714285715, 1 ether);
        UniformSettle.Outcome memory c = UniformSettle.settle(sell, 1, exact);
        assertTrue(c.ok);
        assertEq(c.poolQuote, 4335714285714285715);
        assertEq(c.fills[0].refundQuote, 0);
    }
}
