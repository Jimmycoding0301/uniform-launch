// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {LibClone} from "solady/utils/LibClone.sol";
import {IPortal} from "src/flap/IPortal.sol";
import {UniformLauncher, LaunchConfig} from "src/uniform/UniformLauncher.sol";
import {UniformSettle} from "src/uniform/UniformSettle.sol";
import {BinanceAgentIdSource} from "src/uniform/BinanceAgentIdSource.sol";
import {IFlapNamePolicy} from "src/uniform/IFlapNamePolicy.sol";
import {PermissiveAgentDirectory} from "./PermissiveAgentDirectory.sol";

contract UniformPriceBoundsTest is Test {
    UniformLauncher internal launcher;
    address internal constant BIDDER = address(0xB1D);

    function setUp() public {
        vm.chainId(97);
        address portal = address(0x4000);
        address policy = 0x5CfbE713d070e87F67D1bc84312B7eB8Fe4F2B5E;
        // The fixture accepts the actual salt lock payment; only the fee getter needs return data.
        vm.etch(portal, hex"00");
        vm.mockCall(portal, abi.encodeWithSelector(IPortal.SALT_LOCK_FEE.selector), abi.encode(0.005 ether));

        LaunchConfig memory c;
        c.name = "Bounds";
        c.symbol = "BND";
        c.meta = "price-bounds";
        c.salt = bytes32(uint256(1));
        c.floorPrice = 1e13;
        c.durationBlocks = 200;
        c.identitySources = new address[](1);
        c.identitySources[0] = address(new BinanceAgentIdSource(address(new PermissiveAgentDirectory())));
        vm.mockCall(policy, abi.encodeCall(IFlapNamePolicy.isScamWord, (c.name, c.symbol)), abi.encode(false, false));
        launcher = UniformLauncher(payable(LibClone.clone(address(new UniformLauncher()))));
        launcher.initialize{value: 0.005 ether}(portal, address(this), address(0), c);
        vm.deal(BIDDER, 10 ether);
    }

    function test_priceBoundaryPreservesBudgetAndIdentityForValidRetry() public {
        uint256 maxPrice = launcher.MAX_PRICE();
        assertEq(maxPrice, UniformSettle.MAX_PRICE);
        vm.startPrank(BIDDER);
        vm.expectRevert(UniformLauncher.PriceTooHigh.selector);
        launcher.bid{value: 5 ether}(maxPrice + 1, 0, uint160(BIDDER));
        assertEq(BIDDER.balance, 10 ether);
        assertEq(launcher.bidCount(), 0);
        launcher.bid{value: 5 ether}(maxPrice, 0, uint160(BIDDER));
        vm.stopPrank();
        (bool ok, uint256 clearing, uint256 quote) = launcher.preview();
        assertTrue(ok);
        assertEq(clearing, 1e13);
        assertEq(quote, 5 ether);
    }

    function test_legacyLimitsParticipateAtTheSameAffordableClearingPrice() public pure {
        UniformSettle.Bid[] memory bids = new UniformSettle.Bid[](2);
        bids[0] = UniformSettle.Bid(0, 5 ether, UniformSettle.MAX_PRICE + 1);
        bids[1] = UniformSettle.Bid(1, 10 ether, 2e13);
        UniformSettle.Outcome memory result = UniformSettle.settle(500_000 ether, 1e13, bids);
        assertTrue(result.ok);
        assertEq(result.clearingPrice, 2e13);
        assertEq(result.poolQuote, 10 ether);
        assertEq(result.fills[0].tokens, 250_000 ether);
        assertEq(result.fills[0].refundQuote, 0);
        assertEq(result.fills[1].tokens, 250_000 ether);
        assertEq(result.fills[1].refundQuote, 5 ether);
    }

    function test_onlyLauncherCanRequestInternalSettlementQuote() public {
        vm.expectRevert(UniformLauncher.OnlySelf.selector);
        launcher.settlementQuote();
    }

    function testFuzz_arithmeticQuoteFailureAllowsFullRefund(bool divideByZero) public {
        _bidAndClose();
        vm.mockCallRevert(
            address(launcher),
            abi.encodeCall(launcher.settlementQuote, ()),
            abi.encodeWithSignature("Panic(uint256)", divideByZero ? 0x12 : 0x11)
        );
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Failed));
        vm.prank(BIDDER);
        launcher.refund();
        assertEq(BIDDER.balance, 10 ether);
        assertEq(address(launcher).balance, 0);
    }

    function test_unknownQuoteFailureLeavesAuctionOpen() public {
        _bidAndClose();
        bytes memory reason = abi.encodeWithSignature("FixtureUnavailable()");
        vm.mockCallRevert(address(launcher), abi.encodeCall(launcher.settlementQuote, ()), reason);
        vm.expectRevert(reason);
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Open));
        assertEq(address(launcher).balance, 5 ether);
    }

    function test_nonArithmeticPanicIsPropagated() public {
        _bidAndClose();
        bytes memory reason = abi.encodeWithSignature("Panic(uint256)", 0x01);
        vm.mockCallRevert(address(launcher), abi.encodeCall(launcher.settlementQuote, ()), reason);
        vm.expectRevert(reason);
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Open));
    }

    function _bidAndClose() private {
        vm.prank(BIDDER);
        launcher.bid{value: 5 ether}(1e13, 0, uint160(BIDDER));
        vm.roll(launcher.endBlock());
    }
}
