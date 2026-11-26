// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FixtureNamePolicy, FixtureLauncherFactory} from "./FixtureNamePolicy.sol";
import {Test, console2} from "forge-std/Test.sol";
import {LibClone} from "solady/utils/LibClone.sol";
import {UpgradeableBeacon} from "solady/utils/UpgradeableBeacon.sol";
import {IPortal, IPortalTypes} from "src/flap/IPortal.sol";
import {Distribution} from "src/flap/Distribution.sol";
import {IStrategy} from "src/flap/IStrategy.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {UniformLauncher, LaunchConfig} from "src/uniform/UniformLauncher.sol";
import {UniformLauncherFactory} from "src/uniform/UniformLauncherFactory.sol";
import {UniformVault} from "src/uniform/UniformVault.sol";
import {UniformVaultFactory} from "src/uniform/UniformVaultFactory.sol";
import {BinanceAgentIdSource} from "src/uniform/BinanceAgentIdSource.sol";
import {PermissiveAgentDirectory} from "./PermissiveAgentDirectory.sol";

contract AuditToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract ReenterPortal {
    bool public bidLanded;

    function SALT_LOCK_FEE() external pure returns (uint256) {
        return 0.005 ether;
    }

    function lockSalt(bytes32, uint8) external payable {}

    function launchQuoteConfig(uint8, address) external pure returns (bool, uint256) {
        return (true, 700 ether);
    }

    function graduationFloorV2ForLauncher(IPortal.GraduationFloorParams calldata p, address)
        external
        pure
        returns (IPortal.GraduationFloorResultV2 memory r)
    {
        uint256 usd = p.poolQuote * p.quotePriceUsd / 1 ether;
        r.quoteUsdWad = usd;
        r.createFloorUsdWad = 1500 ether;
        r.floorUsdWad = 3000 ether;
        r.multiplierBps = 10_000;
        r.meetsCreateFloor = usd >= 1500 ether;
        r.meetsFloor = usd >= 3000 ether;
    }

    function launchTaxTokenV2(
        IPortalTypes.CreateTaxTokenParams calldata p,
        Distribution calldata distribution,
        IPortalTypes.CreatorBuyParams calldata
    ) external payable returns (address token, address pool) {
        try UniformLauncher(payable(msg.sender)).bid{value: 0.01 ether}(p.poolToken, 0, uint160(address(this))) {
            bidLanded = true;
        } catch {}
        if (msg.value != p.poolQuote) revert("value");
        AuditToken t = new AuditToken();
        t.mint(address(this), distribution.amount);
        t.approve(distribution.strategy, distribution.amount);
        IStrategy(distribution.strategy).initializeDistribution(address(t), distribution.amount, "", bytes32(0));
        return (address(t), address(0xBEEF));
    }
}

contract HostileBidder {
    UniformLauncher public launcher;
    uint256 public price;
    bool public claimLanded;
    bool public refundLanded;
    bool public secondBidLanded;

    constructor(UniformLauncher launcher_, uint256 price_) {
        launcher = launcher_;
        price = price_;
    }

    function place() external payable {
        launcher.bid{value: msg.value}(price, 0, uint160(address(this)));
    }

    function claim() external {
        launcher.claim();
    }

    receive() external payable {
        try launcher.claim() {
            claimLanded = true;
        } catch {}
        try launcher.refund() {
            refundLanded = true;
        } catch {}
        try launcher.bid{value: 0.01 ether}(price, 0, uint160(address(this))) {
            secondBidLanded = true;
        } catch {}
    }
}

contract HostileOwner {
    UniformVault public vault;
    bool public reentered;

    function arm(UniformVault vault_) external {
        vault = vault_;
    }

    function sweep() external {
        vault.withdrawAll();
    }

    receive() external payable {
        (bool ok,) = address(vault).call(abi.encodeWithSelector(UniformVault.withdrawAll.selector));
        reentered = ok;
    }
}

contract UniformAuditTest is Test {
    address internal portal;
    UniformVaultFactory internal vaultFactory;
    UniformLauncherFactory internal launcherFactory;
    address internal creator = address(0xC0DE0001);
    uint256 internal saltNonce = 100;

    function setUp() public {
        vm.chainId(97);
        portal = LaunchVaultAddresses.hub();
        vm.etch(portal, address(new ReenterPortal()).code);
        vm.deal(portal, 100 ether);
        bytes memory screening = address(new FixtureNamePolicy()).code;
        vm.etch(0x5CfbE713d070e87F67D1bc84312B7eB8Fe4F2B5E, screening);
        vm.etch(0xfFb69d59f62454f3B8322Bc1a9FCE6E171a5264f, screening);
        uint256 nonce = vm.getNonce(address(this));
        address predicted = vm.computeCreateAddress(address(this), nonce + 1);
        vaultFactory = new UniformVaultFactory(predicted);
        launcherFactory = new FixtureLauncherFactory(address(vaultFactory));
        vm.deal(address(this), 10 ether);
        vm.deal(creator, 1 ether);
    }

    function _launcher(uint256 floor) internal returns (UniformLauncher launcher) {
        LaunchConfig memory c;
        c.name = "Tongjia";
        c.symbol = "AUD";
        c.meta = "bafytest";
        c.salt = bytes32(++saltNonce);
        c.floorPrice = floor;
        c.durationBlocks = 200;
        c.identitySources = new address[](1);
        c.identitySources[0] = address(new BinanceAgentIdSource(address(new PermissiveAgentDirectory())));
        vm.prank(portal);
        launcher = UniformLauncher(payable(launcherFactory.newLauncher{value: 0.005 ether}(creator, abi.encode(c))));
    }

    function _bid(UniformLauncher launcher, address who, uint256 pay, uint256 price) internal {
        vm.deal(who, who.balance + pay);
        vm.prank(who);
        launcher.bid{value: pay}(price, 0, uint160(who));
    }

    function _claimAll(UniformLauncher launcher) internal returns (uint256 paid) {
        (address[] memory agents,,,,) = launcher.getBids();
        for (uint256 i; i < agents.length; ++i) {
            uint256 before = agents[i].balance;
            vm.prank(agents[i]);
            try launcher.claim() {
                paid += agents[i].balance - before;
            } catch {}
        }
    }

    function test_minPoolQuoteClearsGraduation() public {
        UniformLauncher launcher = _launcher(1e13);
        uint256 quote = launcher.minPoolQuote();
        console2.log("MIN_POOL_QUOTE", quote);
        uint256 usd = quote * 700 ether * launcher.POOL_AMOUNT() / launcher.TOTAL_SUPPLY() / 1 ether;
        assertGe(usd, 1500 ether);
        assertGt(quote, 4.285714285714285714 ether);
        assertLt(quote, 4.5 ether);
    }

    function test_oneBnbQuoteRefunds() public {
        UniformLauncher launcher = _launcher(1e12);
        address who = address(0xA11CE);
        _bid(launcher, who, 1 ether, 1e16);
        vm.roll(launcher.endBlock());
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Failed));
        assertEq(launcher.token(), address(0));
        uint256 before = who.balance;
        vm.prank(who);
        launcher.refund();
        assertEq(who.balance - before, 1 ether);
        assertEq(address(launcher).balance, 0);
    }

    function test_exactHalfClearsWithNothingLeft() public {
        UniformLauncher launcher = _launcher(1e13);
        uint256 soft = launcher.softCap();
        _bid(launcher, address(0xA11CE), soft, 1e13);
        vm.roll(launcher.endBlock());
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Succeeded));
        assertEq(launcher.poolQuote(), soft);
        uint256 paid = _claimAll(launcher);
        assertEq(paid, 0);
        assertEq(address(launcher).balance, 0);
        assertEq(AuditToken(launcher.token()).balanceOf(address(launcher)), 0);
    }

    function test_oneWeiShortFailsAndRefunds() public {
        UniformLauncher launcher = _launcher(1e13);
        uint256 soft = launcher.softCap();
        address who = address(0xA11CE);
        _bid(launcher, who, soft - 1, 1e13);
        vm.roll(launcher.endBlock());
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Failed));
        uint256 before = who.balance;
        vm.prank(who);
        launcher.refund();
        assertEq(who.balance - before, soft - 1);
        assertEq(address(launcher).balance, 0);
    }

    function test_singleBidderClaimsAndLeavesBalance() public {
        UniformLauncher launcher = _launcher(1e13);
        address who = address(0xA11CE);
        _bid(launcher, who, 6 ether, 1e16);
        vm.roll(launcher.endBlock());
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Succeeded));
        uint256 before = who.balance;
        vm.prank(who);
        launcher.claim();
        uint256 ethBack = who.balance - before;
        assertLe(ethBack + launcher.poolQuote(), 6 ether);
        assertGe(address(launcher).balance, 0);
        assertLe(AuditToken(launcher.token()).balanceOf(who), launcher.SELL_AMOUNT());
    }

    function test_sameAgentCannotBidTwice() public {
        UniformLauncher launcher = _launcher(1e13);
        address who = address(0xA11CE);
        _bid(launcher, who, 1 ether, 1e16);
        vm.deal(who, who.balance + 1 ether);
        vm.prank(who);
        vm.expectRevert(UniformLauncher.AlreadyBid.selector);
        launcher.bid{value: 1 ether}(1e16, 0, uint160(who));
        assertEq(launcher.bidCount(), 1);
    }

    function test_lastOpenBlockAcceptsAndNextRejects() public {
        UniformLauncher launcher = _launcher(1e13);
        uint256 last = launcher.endBlock() - launcher.CLOSE_BUFFER() - 1;
        vm.roll(last);
        _bid(launcher, address(0xA11CE), 1 ether, 1e16);
        vm.roll(last + 1);
        address late = address(0xB0B);
        vm.deal(late, 1 ether);
        vm.prank(late);
        vm.expectRevert(UniformLauncher.Closed.selector);
        launcher.bid{value: 1 ether}(1e16, 0, uint160(late));
    }

    function test_marginalPartialFillThenSolvent() public {
        UniformLauncher launcher = _launcher(1e13);
        address high = address(0xA11CE);
        address edge = address(0xB0B);
        _bid(launcher, high, 4 ether, 4e13);
        _bid(launcher, edge, 10 ether, 1e13);
        vm.roll(launcher.endBlock());
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Succeeded));
        (uint256[] memory tokens, uint256[] memory quotes,) = launcher.getFills();
        assertGt(tokens[0], 0);
        assertGt(tokens[1], 0);
        assertLt(tokens[1], launcher.SELL_AMOUNT());
        assertGt(quotes[1], 0);
        assertLe(tokens[0] + tokens[1], launcher.SELL_AMOUNT());
        uint256 owed = quotes[0] + quotes[1];
        assertGe(address(launcher).balance, owed);
        _claimAll(launcher);
        assertGe(address(launcher).balance, 0);
        assertLe(
            AuditToken(launcher.token()).balanceOf(high) + AuditToken(launcher.token()).balanceOf(edge),
            launcher.SELL_AMOUNT()
        );
    }

    function test_repeatSettleByDifferentCallersReverts() public {
        UniformLauncher launcher = _launcher(1e13);
        _bid(launcher, address(0xA11CE), 6 ether, 1e16);
        vm.roll(launcher.endBlock());
        launcher.settle();
        vm.prank(address(0xB0B));
        vm.expectRevert(UniformLauncher.Closed.selector);
        launcher.settle();
        vm.prank(creator);
        vm.expectRevert(UniformLauncher.Closed.selector);
        launcher.settle();

        UniformLauncher failed = _launcher(1 ether);
        _bid(failed, address(0xA11CE), 1 ether, 1 ether);
        vm.roll(failed.endBlock());
        vm.prank(address(0xB0B));
        failed.settle();
        vm.prank(address(0xCA11));
        vm.expectRevert(UniformLauncher.Closed.selector);
        failed.settle();
    }

    function test_hostileClaimCannotReenter() public {
        UniformLauncher launcher = _launcher(1e13);
        HostileBidder bidder = new HostileBidder(launcher, 1e16);
        vm.deal(address(bidder), 6 ether);
        bidder.place{value: 6 ether}();
        vm.roll(launcher.endBlock());
        launcher.settle();
        uint256 before = address(bidder).balance;
        bidder.claim();
        assertFalse(bidder.claimLanded());
        assertFalse(bidder.refundLanded());
        assertFalse(bidder.secondBidLanded());
        assertEq(launcher.bidCount(), 1);
        vm.expectRevert(UniformLauncher.NothingToClaim.selector);
        bidder.claim();
        assertLe(address(bidder).balance - before + launcher.poolQuote(), 6 ether);
    }

    function test_portalCannotBidDuringSettle() public {
        UniformLauncher launcher = _launcher(1e13);
        _bid(launcher, address(0xA11CE), 6 ether, 1e16);
        vm.roll(launcher.endBlock());
        launcher.settle();
        assertFalse(ReenterPortal(payable(portal)).bidLanded());
        assertEq(launcher.bidCount(), 1);
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Succeeded));
    }

    function test_withdrawAllReenterDoesNotDoublePay() public {
        UniformVault impl = new UniformVault();
        address beacon = address(new UpgradeableBeacon(address(this), address(impl)));
        UniformVault vault = UniformVault(payable(LibClone.deployERC1967BeaconProxy(beacon)));
        HostileOwner owner = new HostileOwner();
        vault.initialize(address(0xB0B), address(0xB0B), address(owner));
        owner.arm(vault);
        vm.deal(address(vault), 1 ether);
        owner.sweep();
        assertFalse(owner.reentered());
        assertEq(address(vault).balance, 0);
        assertEq(address(owner).balance, 1 ether);
    }

    function test_fullBookMarginalFillsAndRefundsConserveQuote() public {
        UniformLauncher launcher = _launcher(1e13);
        uint256 cap = launcher.MAX_BIDS();
        uint256 marginalLimit = 4.01e13;
        for (uint256 i; i < cap; ++i) {
            uint256 limit = i < cap / 2 ? marginalLimit : 1e16 + i;
            _bid(launcher, address(uint160(0x1000 + i)), 0.2 ether, limit);
        }
        (bool ok, uint256 price, uint256 quote) = launcher.preview();
        assertTrue(ok);
        assertEq(price, marginalLimit);
        assertApproxEqAbs(quote, 20.05 ether, cap);
        vm.roll(launcher.endBlock());
        launcher.settle{gas: launcher.MIN_SETTLE_GAS() + 1_000_000}();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Succeeded));
        assertEq(launcher.clearingPrice(), price);
        assertEq(launcher.poolQuote(), quote);
        (uint256[] memory tokensOwed, uint256[] memory quoteOwed,) = launcher.getFills();
        for (uint256 i; i < cap; ++i) {
            assertGt(tokensOwed[i], 0);
            assertApproxEqAbs(quoteOwed[i], i < cap / 2 ? 0.08671875 ether : 0, 1);
        }
        assertEq(_claimAll(launcher) + quote, cap * 0.2 ether);
        assertEq(address(launcher).balance, 0);
    }

    function test_maxBidsSettleGas() public {
        UniformLauncher launcher = _launcher(1e13);
        for (uint256 i; i < launcher.MAX_BIDS(); ++i) {
            _bid(launcher, address(uint160(0x1000 + i)), 0.2 ether, 1e16);
        }
        assertEq(launcher.bidCount(), launcher.MAX_BIDS());
        vm.roll(launcher.endBlock());
        uint256 before = gasleft();
        launcher.settle();
        uint256 used = before - gasleft();
        console2.log("MAX_BIDS_SETTLE_GAS", used);
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Succeeded));
        assertLt(used, launcher.MIN_SETTLE_GAS() + 1_000_000);
        assertLt(used, launcher.MIN_SETTLE_GAS());
        uint256 paid = _claimAll(launcher);
        assertLe(paid + launcher.poolQuote(), launcher.MAX_BIDS() * 0.2 ether);
        assertGe(address(launcher).balance, 0);
    }
}
