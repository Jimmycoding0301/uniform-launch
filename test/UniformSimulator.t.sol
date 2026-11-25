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
}
