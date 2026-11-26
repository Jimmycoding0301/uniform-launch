// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {UniformSettle} from "src/uniform/UniformSettle.sol";

contract UniformSettleTest is Test {
    uint256 internal constant WAD = 1e18;

    function _bid(uint256 index, uint256 budget, uint256 maxPrice) internal pure returns (UniformSettle.Bid memory) {
        return UniformSettle.Bid({index: index, budget: budget, maxPrice: maxPrice});
    }

    function _etherBid(uint256 index, uint256 budgetEth, uint256 priceEth)
        internal
        pure
        returns (UniformSettle.Bid memory)
    {
        return _bid(index, budgetEth * WAD, priceEth * WAD);
    }

    function test_fullPrefix_exact() public pure {
        UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](2);
        bids[0] = _etherBid(0, 40, 5);
        bids[1] = _etherBid(1, 60, 2);
        UniformSettle.Outcome memory o = UniformSettle.settle(100 * WAD, 1 * WAD, bids);
        assertTrue(o.ok);
        assertEq(o.clearingPrice, 1 * WAD);
        assertEq(o.poolQuote, 100 * WAD);
        assertEq(o.poolQuote * WAD / (100 * WAD), o.clearingPrice);
        assertEq(o.fills[0].tokens, 40 * WAD);
        assertEq(o.fills[0].spend, 40 * WAD);
        assertEq(o.fills[0].refundQuote, 0);
        assertEq(o.fills[1].tokens, 60 * WAD);
        assertEq(o.fills[1].spend, 60 * WAD);
        assertEq(o.fills[0].tokens + o.fills[1].tokens, 100 * WAD);
    }

    function test_marginalPin() public pure {
        UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](2);
        bids[0] = _etherBid(0, 40, 4);
        bids[1] = _etherBid(1, 100, 1);
        UniformSettle.Outcome memory o = UniformSettle.settle(100 * WAD, 1 * WAD, bids);
        assertTrue(o.ok);
        assertEq(o.clearingPrice, 1 * WAD);
        assertEq(o.fills[0].tokens, 40 * WAD);
        assertEq(o.fills[0].spend, 40 * WAD);
        assertEq(o.fills[1].tokens, 60 * WAD);
        assertEq(o.fills[1].spend, 60 * WAD);
        assertEq(o.fills[1].refundQuote, 40 * WAD);
        assertLe(o.poolQuote * WAD / (100 * WAD), o.clearingPrice);
        assertLe(o.fills[0].spend * WAD / o.fills[0].tokens, 4 * WAD);
        assertLe(o.fills[1].spend * WAD / o.fills[1].tokens, 1 * WAD);
        assertEq(o.fills[0].spend + o.fills[1].spend + o.fills[0].refundQuote + o.fills[1].refundQuote, 140 * WAD);
    }

    function test_belowReserve_fails() public pure {
        UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](1);
        bids[0] = _etherBid(0, 100, 3);
        UniformSettle.Outcome memory o = UniformSettle.settle(100 * WAD, 2 * WAD, bids);
        assertFalse(o.ok);
        assertEq(o.clearingPrice, 0);
        assertEq(o.fills[0].tokens, 0);
        assertEq(o.fills[0].refundQuote, 100 * WAD);
    }

    function test_roundingDustStaysUnallocated() public pure {
        UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](3);
        bids[0] = _bid(2, 1 * WAD, 1 * WAD);
        bids[1] = _bid(0, 1 * WAD, 1 * WAD);
        bids[2] = _bid(1, 1 * WAD, 1 * WAD);
        UniformSettle.Outcome memory o = UniformSettle.settle(100 * WAD, WAD / 100, bids);
        assertTrue(o.ok);
        assertEq(o.clearingPrice, 3 * WAD * WAD / (100 * WAD));
        uint256 sum;
        for (uint256 i; i < 3; ++i) {
            sum += o.fills[i].tokens;
            assertEq(o.fills[i].spend, 1 * WAD);
            assertEq(o.fills[i].refundQuote, 0);
            assertLe(o.fills[i].tokens * o.clearingPrice, o.fills[i].spend * WAD);
        }
        assertEq(o.fills[0].tokens, o.fills[1].tokens);
        assertEq(o.fills[1].tokens, o.fills[2].tokens);
        // 100e18 不能被 3 整除，余下的 1 wei 代币不分配。
        assertEq(sum, 100 * WAD - 1);
        assertEq(o.poolQuote + 0, 3 * WAD);
    }

    function test_emptyFails() public pure {
        UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](0);
        UniformSettle.Outcome memory o = UniformSettle.settle(100 * WAD, 1 * WAD, bids);
        assertFalse(o.ok);
    }
}
