// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
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
        uint256 usd = p.poolQuote * 700 ether * p.poolToken / p.totalSupply / 1 ether;
        r.quoteUsdWad = usd;
        r.createFloorUsdWad = 750 ether;
        r.floorUsdWad = 1500 ether;
        r.multiplierBps = 10_000;
        r.meetsCreateFloor = usd >= 750 ether;
        r.meetsFloor = usd >= 1500 ether;
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
        uint256 nonce = vm.getNonce(address(this));
        address predicted = vm.computeCreateAddress(address(this), nonce + 1);
        vaultFactory = new UniformVaultFactory(predicted);
        launcherFactory = new UniformLauncherFactory(address(vaultFactory));
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

    function test_versionsAndDescription() public {
        assertEq(launcherFactory.factorySpecVersion(), "lf-v1");
        assertEq(vaultFactory.factorySpecVersion(), "pl-v1");
        UniformLauncher launcher = _new("TJ", 1e13);
        assertTrue(bytes(launcher.description()).length > 0);
        assertTrue(_contains(launcher.description(), "Uniform-price auction"));
    }

    function test_bidWindowAndLimits() public {
        UniformLauncher launcher = _new("TJ", 1e13);
        vm.prank(alice);
        vm.expectRevert(UniformLauncher.BelowFloor.selector);
        launcher.bid{value: 1 ether}(1);

        vm.prank(alice);
        launcher.bid{value: 1 ether}(1e16);
        vm.prank(alice);
        vm.expectRevert(UniformLauncher.AlreadyBid.selector);
        launcher.bid{value: 1 ether}(1e16);

        vm.prank(bob);
        vm.expectRevert(UniformLauncher.BadBudget.selector);
        launcher.bid{value: 0.001 ether}(1e16);

        vm.roll(launcher.endBlock() - launcher.CLOSE_BUFFER());
        vm.prank(bob);
        vm.expectRevert(UniformLauncher.Closed.selector);
        launcher.bid{value: 1 ether}(1e16);

        vm.roll(launcher.endBlock() - 1);
        vm.expectRevert(UniformLauncher.Early.selector);
        launcher.settle();
    }

    function test_thirtyThirdBidReverts() public {
        UniformLauncher launcher = _new("TJ", 1);
        for (uint256 i; i < 32; ++i) {
            address who = address(uint160(1000 + i));
            vm.deal(who, 1 ether);
            vm.prank(who);
            launcher.bid{value: 0.01 ether}(1e16);
        }
        address extra = address(uint160(2000));
        vm.deal(extra, 1 ether);
        vm.prank(extra);
        vm.expectRevert(UniformLauncher.Full.selector);
        launcher.bid{value: 0.01 ether}(1e16);
    }

    function test_failedAuctionRefundsAll() public {
        UniformLauncher launcher = _new("TJ", 1 ether);
        vm.prank(alice);
        launcher.bid{value: 1 ether}(1 ether);
        vm.prank(bob);
        launcher.bid{value: 2 ether}(1 ether);
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
        launcher.bid{value: 10 ether}(1e16);
        vm.roll(launcher.endBlock());
        uint256 bal = address(launcher).balance;
        vm.expectRevert(UniformLauncher.InsufficientGas.selector);
        launcher.settle{gas: 3_000_000}();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Open));
        assertEq(launcher.token(), address(0));
        assertEq(address(launcher).balance, bal);

        launcher.settle{gas: 8_000_000}();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Succeeded));
        assertEq(launcher.MIN_SETTLE_GAS(), 7_000_000);
    }

    function test_successClaimMatchesQuote() public {
        UniformLauncher launcher = _new("TJ", 1e13);
        vm.prank(alice);
        launcher.bid{value: 4 ether}(1e16);
        vm.prank(bob);
        launcher.bid{value: 6 ether}(1e16);
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
        launcher.bid{value: 4 ether}(1e16);
        vm.prank(bob);
        launcher.bid{value: 6 ether}(1e16);
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
        launcher.bid{value: 1 ether}(1e16);
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
