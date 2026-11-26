// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FixtureNamePolicy, FixtureLauncherFactory} from "./FixtureNamePolicy.sol";
import {Test} from "forge-std/Test.sol";
import {LibClone} from "solady/utils/LibClone.sol";
import {UpgradeableBeacon} from "solady/utils/UpgradeableBeacon.sol";
import {IPortal, IPortalTypes} from "src/flap/IPortal.sol";
import {LauncherDataSchema} from "src/flap/IVaultSchemas.sol";
import {Distribution} from "src/flap/Distribution.sol";
import {IStrategy} from "src/flap/IStrategy.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {UniformLauncher, LaunchConfig} from "src/uniform/UniformLauncher.sol";
import {UniformLauncherFactory} from "src/uniform/UniformLauncherFactory.sol";
import {UniformVault} from "src/uniform/UniformVault.sol";
import {UniformVaultFactory} from "src/uniform/UniformVaultFactory.sol";
import {BinanceAgentIdSource} from "src/uniform/BinanceAgentIdSource.sol";
import {PermissiveAgentDirectory} from "./PermissiveAgentDirectory.sol";

contract FakeToken {
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

contract MockPortal {
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
        if (keccak256(bytes(p.symbol)) == keccak256("REV")) {
            revert("launch reverted");
        }
        if (msg.value != p.poolQuote) revert("value");
        FakeToken t = new FakeToken();
        t.mint(address(this), distribution.amount);
        t.approve(distribution.strategy, distribution.amount);
        IStrategy(distribution.strategy).initializeDistribution(address(t), distribution.amount, "", bytes32(0));
        return (address(t), address(0xBEEF));
    }
}

contract UniformLauncherTest is Test {
    address internal portal;
    UniformVaultFactory internal vaultFactory;
    UniformLauncherFactory internal launcherFactory;
    address internal creator = address(0xC0DE0001);
    address internal alice = address(0xC0DE0002);
    address internal bob = address(0xC0DE0003);
    address[] internal sources;

    function setUp() public {
        vm.chainId(97);
        portal = LaunchVaultAddresses.hub();
        vm.etch(portal, address(new MockPortal()).code);
        vm.deal(portal, 10 ether);
        bytes memory screening = address(new FixtureNamePolicy()).code;
        vm.etch(0x5CfbE713d070e87F67D1bc84312B7eB8Fe4F2B5E, screening);
        vm.etch(0xfFb69d59f62454f3B8322Bc1a9FCE6E171a5264f, screening);
        uint256 nonce = vm.getNonce(address(this));
        address predicted = vm.computeCreateAddress(address(this), nonce + 1);
        vaultFactory = new UniformVaultFactory(predicted);
        launcherFactory = new FixtureLauncherFactory(address(vaultFactory));
        vm.deal(address(this), 10 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(creator, 1 ether);
        sources = new address[](1);
        sources[0] = address(new BinanceAgentIdSource(address(new PermissiveAgentDirectory())));
    }

    function _config(string memory symbol, uint256 floor) internal view returns (LaunchConfig memory c) {
        c.name = "Tongjia";
        c.symbol = symbol;
        c.meta = "bafytest";
        c.salt = bytes32(uint256(1));
        c.floorPrice = floor;
        c.durationBlocks = 200;
        c.identitySources = sources;
    }

    function _new(string memory symbol, uint256 floor) internal returns (UniformLauncher launcher) {
        vm.prank(portal);
        launcher = UniformLauncher(
            payable(launcherFactory.newLauncher{value: 0.005 ether}(creator, abi.encode(_config(symbol, floor))))
        );
    }

    function test_nameAndSymbolScreenedBeforeSaltIsLocked() public {
        LaunchConfig memory c = _config("TJ", 1e13);
        c.name = "BLOCKED";
        vm.prank(portal);
        vm.expectRevert(UniformLauncher.ScamNameOrSymbol.selector);
        launcherFactory.newLauncher{value: 0.005 ether}(creator, abi.encode(c));

        c.name = "Tongjia";
        c.symbol = "BLOCKED";
        vm.prank(portal);
        vm.expectRevert(UniformLauncher.ScamNameOrSymbol.selector);
        launcherFactory.newLauncher{value: 0.005 ether}(creator, abi.encode(c));

        c.symbol = "TJ";
        FixtureNamePolicy(0x5CfbE713d070e87F67D1bc84312B7eB8Fe4F2B5E).setUnavailable(true);
        vm.prank(portal);
        vm.expectRevert(UniformLauncher.NameScreenUnavailable.selector);
        launcherFactory.newLauncher{value: 0.005 ether}(creator, abi.encode(c));
        FixtureNamePolicy(0x5CfbE713d070e87F67D1bc84312B7eB8Fe4F2B5E).setUnavailable(false);
        assertTrue(address(_new("TJ", 1e13)) != address(0));
    }

    function test_protectedAuctionReservesSeatsForAdmittedWallets() public {
        LaunchConfig memory c = _config("TJ", 1e13);
        c.admittedWallets = new address[](1);
        c.admittedWallets[0] = alice;
        vm.prank(portal);
        UniformLauncher launcher =
            UniformLauncher(payable(launcherFactory.newLauncher{value: 0.005 ether}(creator, abi.encode(c))));

        vm.prank(bob);
        vm.expectRevert(UniformLauncher.NotAdmitted.selector);
        launcher.bid{value: 0.01 ether}(1e16, 0, uint160(bob));

        vm.prank(alice);
        launcher.bid{value: 0.01 ether}(1e16, 0, uint160(alice));
        assertEq(launcher.admittedWalletCount(), 1);
        assertEq(launcher.bidCount(), 1);

        vm.roll(launcher.endBlock());
        launcher.settle();
        uint256 before = alice.balance;
        vm.prank(alice);
        launcher.refund();
        assertEq(alice.balance - before, 0.01 ether);
    }

    function test_reviewExampleSuccessAndFullRefundPaths() public {
        address carol = address(0xCA401);
        address dan = address(0xDA4);
        vm.deal(carol, 4 ether);
        vm.deal(dan, 2 ether);
        UniformLauncher launched = _new("TJ", 1e13);
        vm.prank(alice);
        launched.bid{value: 4 ether}(3e13, 0, uint160(alice));
        vm.prank(bob);
        launched.bid{value: 3 ether}(2e13, 0, uint160(bob));
        vm.prank(carol);
        launched.bid{value: 2 ether}(12e12, 0, uint160(carol));
        vm.prank(dan);
        launched.bid{value: 1 ether}(1e13, 0, uint160(dan));
        assertEq(address(launched).balance, 10 ether);
        vm.roll(launched.endBlock());
        launched.settle();
        assertEq(launched.clearingPrice(), 14e12);
        assertEq(launched.poolQuote(), 7 ether);
        (uint256[] memory tokens, uint256[] memory refunds,) = launched.getFills();
        assertEq(tokens[0], 285_714_285714285714285714);
        assertEq(tokens[1], 214_285_714285714285714285);
        assertEq(tokens[2] + tokens[3], 0);
        assertEq(refunds[0] + refunds[1], 0);
        assertEq(refunds[2], 2 ether);
        assertEq(refunds[3], 1 ether);
        assertEq(launched.unallocatedTokens(), 1);
        vm.prank(carol);
        vm.expectRevert(UniformLauncher.RefundUnavailable.selector);
        launched.refund();
        vm.prank(carol);
        launched.claim();
        vm.prank(dan);
        launched.claim();
        assertEq(carol.balance, 4 ether);
        assertEq(dan.balance, 2 ether);

        LaunchConfig memory failedConfig = _config("TJ", 1e13);
        failedConfig.salt = bytes32(uint256(2));
        vm.prank(portal);
        UniformLauncher failed = UniformLauncher(
            payable(launcherFactory.newLauncher{value: 0.005 ether}(creator, abi.encode(failedConfig)))
        );
        vm.prank(carol);
        failed.bid{value: 2 ether}(12e12, 0, uint160(carol));
        vm.prank(dan);
        failed.bid{value: 1 ether}(1e13, 0, uint160(dan));
        vm.roll(failed.endBlock());
        failed.settle();
        assertEq(failed.statusCode(), uint8(UniformLauncher.Status.Failed));
        assertEq(failed.token(), address(0));
        vm.prank(carol);
        failed.refund();
        vm.prank(dan);
        failed.refund();
        assertEq(carol.balance, 4 ether);
        assertEq(dan.balance, 2 ether);
        assertEq(address(failed).balance, 0);
    }

    function test_mainnetRequiresAdmissionRoster() public {
        vm.chainId(56);
        LaunchConfig memory c = _config("TJ", 1e13);
        vm.prank(portal);
        vm.expectRevert(UniformLauncher.InvalidConfig.selector);
        launcherFactory.newLauncher{value: 0.005 ether}(creator, abi.encode(c));
    }

    function test_liveQuoteAndExplicitPriceUnavailable() public {
        UniformLauncher launcher = _new("TJ", 1e13);
        bytes memory input = abi.encodeWithSelector(IPortal.launchQuoteConfig.selector, uint8(0), address(0));
        vm.mockCall(portal, input, abi.encode(true, 600 ether));
        assertEq(launcher.minPoolQuote(), 5.05 ether);
        vm.prank(alice);
        launcher.bid{value: 5.05 ether}(1e16, 0, uint160(alice));
        vm.roll(launcher.endBlock());

        vm.mockCall(portal, input, abi.encode(false, 0));
        vm.expectRevert(UniformLauncher.PortalQuoteUnavailable.selector);
        launcher.settle();
        assertEq(launcher.statusCode(), uint8(UniformLauncher.Status.Open));

        vm.mockCall(portal, input, abi.encode(true, 600 ether));
        launcher.settle();
        assertEq(launcher.statusCode(), uint8(UniformLauncher.Status.Succeeded));
    }

    function test_burnOnlyUnallocatedTokensAndKeepClaims() public {
        UniformLauncher launcher = _new("TJ", 1e13);
        vm.prank(alice);
        launcher.bid{value: 2 ether}(1e16, 0, uint160(alice));
        vm.prank(bob);
        launcher.bid{value: 3 ether + 1}(1e16, 0, uint160(bob));
        vm.roll(launcher.endBlock());
        launcher.settle();

        FakeToken issued = FakeToken(launcher.token());
        (uint256[] memory owed,,) = launcher.getFills();
        assertGt(launcher.unallocatedTokens(), 0);
        assertEq(launcher.unallocatedTokens() + owed[0] + owed[1], launcher.SELL_AMOUNT());
        uint256 residue = launcher.unallocatedTokens();
        launcher.burnUnallocatedTokens();
        assertEq(issued.balanceOf(address(0xdEaD)), residue);
        assertEq(issued.balanceOf(address(launcher)), owed[0] + owed[1]);
        vm.expectRevert(UniformLauncher.NoUnallocatedTokens.selector);
        launcher.burnUnallocatedTokens();
        vm.prank(alice);
        launcher.claim();
        vm.prank(bob);
        launcher.claim();
        assertEq(issued.balanceOf(alice), owed[0]);
        assertEq(issued.balanceOf(bob), owed[1]);
        assertEq(issued.balanceOf(address(launcher)), 0);
    }

    function test_factoryRejectsUnapprovedIdentityAdapter() public {
        UniformLauncherFactory strictFactory = new UniformLauncherFactory(address(0));
        LaunchConfig memory c = _config("TJ", 1e13);
        vm.prank(portal);
        vm.expectRevert(abi.encodeWithSelector(UniformLauncherFactory.InvalidIdentitySource.selector, sources[0]));
        strictFactory.newLauncher{value: 0.005 ether}(creator, abi.encode(c));

        c.identitySources[0] = strictFactory.agentIdSource();
        vm.prank(portal);
        address launcher = strictFactory.newLauncher{value: 0.005 ether}(creator, abi.encode(c));
        assertEq(UniformLauncher(payable(launcher)).identitySources(0), strictFactory.agentIdSource());
        string memory description = UniformLauncher(payable(launcher)).description();
        assertTrue(_contains(description, "bidding requires Binance Agent ID and a wallet on the auction allowlist"));
        assertTrue(_contains(description, "3% buy and 3% sell tax goes directly to the creator for 30 days"));
        assertTrue(_contains(description, unicode"买卖各收 3% 交易税，直接支付给创建者"));
    }

    function test_versionsAndDescription() public {
        assertEq(launcherFactory.factorySpecVersion(), "lf-v1");
        assertEq(vaultFactory.factorySpecVersion(), "pl-v1");
        LauncherDataSchema memory schema = launcherFactory.launcherDataSchema();
        assertFalse(schema.isArray);
        assertEq(schema.fields.length, 8);
        string[8] memory names =
            ["name", "symbol", "meta", "salt", "floorPrice", "durationBlocks", "identitySources", "admittedWallets"];
        string[8] memory types_ =
            ["string", "string", "string", "bytes32", "uint256", "uint64", "address[]", "address[]"];
        for (uint256 i; i < names.length; ++i) {
            assertEq(schema.fields[i].name, names[i]);
            assertEq(schema.fields[i].fieldType, types_[i]);
            assertEq(schema.fields[i].decimals, i == 4 ? 18 : 0);
        }
        UniformLauncher launcher = _new("TJ", 1e13);
        string memory description = launcher.description();
        assertLt(bytes(description).length, 4096);
        assertTrue(_contains(description, "Uniform-price auction"));
        assertTrue(_contains(description, "3% buy and 3% sell tax goes to the launch vault for 30 days"));
    }

    function test_bidWindowAndLimits() public {
        UniformLauncher launcher = _new("TJ", 1e13);
        vm.prank(alice);
        vm.expectRevert(UniformLauncher.BelowFloor.selector);
        launcher.bid{value: 1 ether}(1, 0, uint160(alice));

        vm.prank(alice);
        launcher.bid{value: 1 ether}(1e16, 0, uint160(alice));
        vm.prank(alice);
        vm.expectRevert(UniformLauncher.AlreadyBid.selector);
        launcher.bid{value: 1 ether}(1e16, 0, uint160(alice));

        vm.prank(bob);
        vm.expectRevert(UniformLauncher.BadBudget.selector);
        launcher.bid{value: 0.001 ether}(1e16, 0, uint160(bob));

        vm.roll(launcher.endBlock() - launcher.CLOSE_BUFFER());
        vm.prank(bob);
        vm.expectRevert(UniformLauncher.Closed.selector);
        launcher.bid{value: 1 ether}(1e16, 0, uint160(bob));

        vm.roll(launcher.endBlock() - 1);
        vm.expectRevert(UniformLauncher.Early.selector);
        launcher.settle();
    }

    function test_bidBeyondCapacityReverts() public {
        UniformLauncher launcher = _new("TJ", 1);
        for (uint256 i; i < launcher.MAX_BIDS(); ++i) {
            address who = address(uint160(1000 + i));
            vm.deal(who, 1 ether);
            vm.prank(who);
            launcher.bid{value: 0.01 ether}(1e16, 0, uint160(who));
        }
        assertEq(launcher.bidCount(), 128);
        address extra = address(uint160(2000));
        vm.deal(extra, 1 ether);
        vm.prank(extra);
        vm.expectRevert(UniformLauncher.Full.selector);
        launcher.bid{value: 0.01 ether}(1e16, 0, uint160(extra));
    }

    function test_failedAuctionRefundsAll() public {
        UniformLauncher launcher = _new("TJ", 1 ether);
        vm.prank(alice);
        launcher.bid{value: 1 ether}(1 ether, 0, uint160(alice));
        vm.prank(bob);
        launcher.bid{value: 2 ether}(1 ether, 0, uint160(bob));
        vm.roll(launcher.endBlock());
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Failed));
        uint256 before = alice.balance;
        vm.prank(alice);
        launcher.refund();
        assertEq(alice.balance - before, 1 ether);
        vm.prank(alice);
        vm.expectRevert(UniformLauncher.NothingToRefund.selector);
        launcher.refund();
        before = bob.balance;
        vm.prank(bob);
        launcher.refund();
        assertEq(bob.balance - before, 2 ether);
        assertEq(address(launcher).balance, 0);
        vm.prank(alice);
        vm.expectRevert(UniformLauncher.NothingToClaim.selector);
        launcher.claim();
    }

    function test_shortGasLeavesAuctionOpen() public {
        UniformLauncher launcher = _new("TJ", 1e13);
        vm.prank(alice);
        launcher.bid{value: 10 ether}(1e16, 0, uint160(alice));
        vm.roll(launcher.endBlock());
        uint256 bal = address(launcher).balance;
        vm.expectRevert(UniformLauncher.InsufficientGas.selector);
        launcher.settle{gas: 3_000_000}();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Open));
        assertEq(launcher.token(), address(0));
        assertEq(address(launcher).balance, bal);

        launcher.settle{gas: launcher.MIN_SETTLE_GAS() + 1_000_000}();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Succeeded));
        assertEq(launcher.bidCount(), 1);
    }

    function test_successClaimMatchesQuote() public {
        UniformLauncher launcher = _new("TJ", 1e13);
        vm.prank(alice);
        launcher.bid{value: 4 ether}(1e16, 0, uint160(alice));
        vm.prank(bob);
        launcher.bid{value: 6 ether}(1e16, 0, uint160(bob));
        vm.roll(launcher.endBlock());
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Succeeded));
        assertEq(launcher.poolQuote(), 10 ether);
        assertEq(launcher.clearingPrice(), 10 ether * 1e18 / launcher.SELL_AMOUNT());
        assertEq(launcher.pool(), address(0xBEEF));
        vm.prank(alice);
        launcher.claim();
        assertEq(FakeToken(launcher.token()).balanceOf(alice), 200_000 ether);
        vm.prank(bob);
        launcher.claim();
        assertEq(FakeToken(launcher.token()).balanceOf(bob), 300_000 ether);
        assertEq(address(launcher).balance, 0);
        vm.expectRevert(UniformLauncher.Closed.selector);
        launcher.settle();
    }

    function test_launchRevertRefunds() public {
        UniformLauncher launcher = _new("REV", 1e13);
        vm.prank(alice);
        launcher.bid{value: 4 ether}(1e16, 0, uint160(alice));
        vm.prank(bob);
        launcher.bid{value: 6 ether}(1e16, 0, uint160(bob));
        vm.roll(launcher.endBlock());
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Failed));
        assertEq(launcher.token(), address(0));
        vm.prank(alice);
        launcher.refund();
        vm.prank(bob);
        launcher.refund();
        assertEq(address(launcher).balance, 0);
    }

    function test_guardianFailDoesNotTakeFunds() public {
        UniformLauncher launcher = _new("TJ", 1e13);
        vm.prank(alice);
        launcher.bid{value: 1 ether}(1e16, 0, uint160(alice));
        uint256 guardianBal = LaunchVaultAddresses.guardian().balance;
        vm.prank(LaunchVaultAddresses.guardian());
        launcher.guardianFail();
        assertEq(LaunchVaultAddresses.guardian().balance, guardianBal);
        vm.prank(alice);
        launcher.refund();
        assertEq(address(launcher).balance, 0);
    }

    function test_vaultWithdrawOnlyOwner() public {
        UniformVault impl = new UniformVault();
        address beacon = address(new UpgradeableBeacon(address(this), address(impl)));
        UniformVault vault = UniformVault(payable(LibClone.deployERC1967BeaconProxy(beacon)));
        vault.initialize(address(0xB0B), address(0xB0B), creator);
        vm.deal(address(vault), 1 ether);
        vm.prank(alice);
        vm.expectRevert(UniformVault.NotOwner.selector);
        vault.withdraw(alice, 1 ether);
        uint256 bobBefore = bob.balance;
        uint256 creatorBefore = creator.balance;
        vm.prank(creator);
        vault.withdraw(bob, 0.25 ether);
        assertEq(bob.balance - bobBefore, 0.25 ether);
        vm.prank(LaunchVaultAddresses.guardian());
        vault.withdrawAll();
        assertEq(creator.balance - creatorBefore, 0.75 ether);
        assertEq(address(vault).balance, 0);
    }

    function _contains(string memory hay, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(hay);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return false;
        for (uint256 i; i + n.length <= h.length; ++i) {
            bool ok = true;
            for (uint256 j; j < n.length; ++j) {
                if (h[i + j] != n[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return true;
        }
        return false;
    }
}
