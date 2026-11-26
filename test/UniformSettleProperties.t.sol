// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {UniformSettle} from "src/uniform/UniformSettle.sol";

contract UniformSettlePropertiesTest is Test {
    uint256 internal constant WAD = 1e18;

    function settle(uint256 sell, uint256 floor, UniformSettle.Bid[] memory bids)
        external
        pure
        returns (UniformSettle.Outcome memory)
    {
        return UniformSettle.settle(sell, floor, bids);
    }

    function test_singleBidClears() public pure {
        UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](1);
        bids[0] = UniformSettle.Bid(0, 50 ether, 2 ether);
        UniformSettle.Outcome memory o = UniformSettle.settle(100 ether, 0.2 ether, bids);
        assertTrue(o.ok);
        assertEq(o.clearingPrice, 0.5 ether);
        assertEq(o.fills[0].tokens, 100 ether);
        assertEq(o.fills[0].spend, 50 ether);
        assertEq(o.fills[0].refundQuote, 0);
        assertEq(o.poolQuote, 50 ether);
    }

    function test_singleBidMissesReserve() public pure {
        UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](1);
        bids[0] = UniformSettle.Bid(0, 10 ether, 2 ether);
        UniformSettle.Outcome memory o = UniformSettle.settle(100 ether, 1 ether, bids);
        assertFalse(o.ok);
        assertEq(o.fills[0].tokens, 0);
        assertEq(o.fills[0].refundQuote, 10 ether);
        assertEq(o.poolQuote, 0);
    }

    function test_samePriceIsProRata() public pure {
        UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](3);
        bids[0] = UniformSettle.Bid(7, 1 ether, 1 ether);
        bids[1] = UniformSettle.Bid(1, 1 ether, 1 ether);
        bids[2] = UniformSettle.Bid(4, 1 ether, 1 ether);
        UniformSettle.Outcome memory o = UniformSettle.settle(100 ether, 0.01 ether, bids);
        assertTrue(o.ok);
        assertEq(o.clearingPrice, 0.03 ether);
        uint256 sum;
        for (uint256 i; i < 3; ++i) {
            sum += o.fills[i].tokens;
            assertEq(o.fills[i].spend + o.fills[i].refundQuote, 1 ether);
        }
        assertLe(sum, 100 ether);
        assertEq(o.fills[0].tokens, o.fills[1].tokens);
        assertEq(o.fills[1].tokens, o.fills[2].tokens);
    }

    function test_thirtyTwoBidsConserve() public pure {
        UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](32);
        for (uint256 i; i < 32; ++i) {
            bids[i] = UniformSettle.Bid(i, 1 ether, 1 ether);
        }
        UniformSettle.Outcome memory o = UniformSettle.settle(100 ether, 0.1 ether, bids);
        _check(o, bids, 100 ether, 0.1 ether);
    }

    function test_zeroBudgetIgnored() public pure {
        UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](2);
        bids[0] = UniformSettle.Bid(0, 0, 5 ether);
        bids[1] = UniformSettle.Bid(1, 40 ether, 2 ether);
        UniformSettle.Outcome memory o = UniformSettle.settle(100 ether, 0.2 ether, bids);
        assertTrue(o.ok);
        assertEq(o.fills[0].tokens, 0);
        assertEq(o.fills[1].tokens, 100 ether);
        assertEq(o.fills[1].spend, 40 ether);
    }

    function test_belowFloorIgnored() public pure {
        UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](2);
        bids[0] = UniformSettle.Bid(0, 100 ether, 0.1 ether);
        bids[1] = UniformSettle.Bid(1, 50 ether, 2 ether);
        UniformSettle.Outcome memory o = UniformSettle.settle(100 ether, 0.5 ether, bids);
        assertTrue(o.ok);
        assertEq(o.fills[0].tokens, 0);
        assertEq(o.fills[0].refundQuote, 100 ether);
        assertEq(o.fills[1].tokens, 100 ether);
    }

    function test_zeroFloorDoesNotClear() public pure {
        UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](1);
        bids[0] = UniformSettle.Bid(0, 10 ether, 1 ether);
        UniformSettle.Outcome memory o = UniformSettle.settle(100 ether, 0, bids);
        assertFalse(o.ok);
    }

    function test_overflowReverts() public {
        UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](1);
        bids[0] = UniformSettle.Bid(0, type(uint256).max, type(uint256).max);
        vm.expectRevert();
        this.settle(type(uint256).max / 2, 1, bids);
    }

    function test_zeroSupplyReverts() public {
        UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](0);
        vm.expectRevert(UniformSettle.ZeroSupply.selector);
        this.settle(0, 1, bids);
    }

    function testFuzz_conservation(uint256 seed) public pure {
        uint256 n = seed % 33;
        uint256 sell = 100 ether;
        uint256 floor = 1e12 + (uint256(keccak256(abi.encode(seed, "floor"))) % 1e15);
        UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](n);
        for (uint256 i; i < n; ++i) {
            uint256 h = uint256(keccak256(abi.encode(seed, i)));
            bids[i].index = h % 10_000;
            bids[i].budget = (h % 40) * 1 ether;
            bids[i].maxPrice = 1e12 + ((h >> 40) % 5e15);
        }
        UniformSettle.Outcome memory o = UniformSettle.settle(sell, floor, bids);
        _check(o, bids, sell, floor);
    }

    function _check(UniformSettle.Outcome memory o, UniformSettle.Bid[] memory bids, uint256 sell, uint256 floor)
        internal
        pure
    {
        uint256 budgetSum;
        uint256 spendSum;
        uint256 refundSum;
        uint256 tokenSum;
        for (uint256 i; i < bids.length; ++i) {
            budgetSum += bids[i].budget;
            spendSum += o.fills[i].spend;
            refundSum += o.fills[i].refundQuote;
            tokenSum += o.fills[i].tokens;
            assertEq(o.fills[i].spend + o.fills[i].refundQuote, bids[i].budget);
            if (!o.ok || bids[i].maxPrice < o.clearingPrice) {
                if (!o.ok) assertEq(o.fills[i].tokens, 0);
            }
            if (o.ok && bids[i].maxPrice < o.clearingPrice) assertEq(o.fills[i].tokens, 0);
            if (o.fills[i].tokens > 0 && o.fills[i].spend > 0) {
                assertLe(o.fills[i].spend * WAD / o.fills[i].tokens, bids[i].maxPrice);
            }
            if (o.ok && o.fills[i].tokens > 0) {
                assertLe(o.fills[i].tokens * o.clearingPrice, o.fills[i].spend * WAD);
            }
        }
        assertEq(spendSum + refundSum, budgetSum);
        assertLe(o.poolQuote + refundSum, budgetSum);
        if (!o.ok) {
            assertEq(o.clearingPrice, 0);
            assertEq(o.poolQuote, 0);
            assertEq(tokenSum, 0);
            return;
        }
        assertGe(o.clearingPrice, floor);
        assertLe(tokenSum, sell);
        assertEq(o.poolQuote, spendSum);
        assertGt(o.poolQuote, 0);
        if (tokenSum > 0) {
            assertGe(spendSum * WAD, o.clearingPrice * tokenSum);
        }
    }
}
