// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {UniformLauncher, LaunchConfig} from "src/uniform/UniformLauncher.sol";
import {UniformLauncherFactory} from "src/uniform/UniformLauncherFactory.sol";
import {UniformVaultFactory} from "src/uniform/UniformVaultFactory.sol";
import {BinanceAgentIdSource, IBinanceAgentDirectory} from "src/uniform/BinanceAgentIdSource.sol";
import {Erc8004Registry} from "src/uniform/Erc8004Registry.sol";
import {Erc8004Source} from "src/uniform/Erc8004Source.sol";

contract ListedDirectory is IBinanceAgentDirectory {
    mapping(address => uint256) public ids;

    function set(address wallet, uint256 id) external {
        ids[wallet] = id;
    }

    function agentIdOf(address wallet) external view returns (uint256) {
        return ids[wallet];
    }
}

contract FeePortal {
    function SALT_LOCK_FEE() external pure returns (uint256) {
        return 0.005 ether;
    }

    function lockSalt(bytes32, uint8) external payable {}
}

contract UniformIdentityTest is Test {
    UniformLauncherFactory internal launcherFactory;
    ListedDirectory internal binanceDir;
    BinanceAgentIdSource internal binance;
    Erc8004Registry internal registry;
    Erc8004Source internal erc8004;
    address internal creator = address(0xC0DE0001);
    uint256 internal saltNonce = 400;

    function setUp() public {
        vm.chainId(97);
        address portal = LaunchVaultAddresses.hub();
        vm.etch(portal, address(new FeePortal()).code);
        vm.deal(portal, 1 ether);
        vm.deal(address(this), 10 ether);
        uint256 nonce = vm.getNonce(address(this));
        address predicted = vm.computeCreateAddress(address(this), nonce + 1);
        UniformVaultFactory vaultFactory = new UniformVaultFactory(predicted);
        launcherFactory = new UniformLauncherFactory(address(vaultFactory));
        binanceDir = new ListedDirectory();
        binance = new BinanceAgentIdSource(address(binanceDir));
        registry = new Erc8004Registry();
        erc8004 = new Erc8004Source(address(registry));
    }

    function _launcher(address[] memory sources) internal returns (UniformLauncher launcher) {
        LaunchConfig memory c;
        c.name = "Tongjia";
        c.symbol = "ID";
        c.meta = "bafytest";
        c.salt = bytes32(++saltNonce);
        c.floorPrice = 1e13;
        c.durationBlocks = 200;
        c.identitySources = sources;
        vm.prank(LaunchVaultAddresses.hub());
        launcher = UniformLauncher(payable(launcherFactory.newLauncher{value: 0.005 ether}(creator, abi.encode(c))));
    }

    function _both() internal view returns (address[] memory sources) {
        sources = new address[](2);
        sources[0] = address(binance);
        sources[1] = address(erc8004);
    }

    function _onlyBinance() internal view returns (address[] memory sources) {
        sources = new address[](1);
        sources[0] = address(binance);
    }

    function _only8004() internal view returns (address[] memory sources) {
        sources = new address[](1);
        sources[0] = address(erc8004);
    }

    function test_onlyBinanceAgentCanBid() public {
        address who = address(0xA11CE);
        binanceDir.set(who, 42);
        UniformLauncher launcher = _launcher(_onlyBinance());
        vm.deal(who, 1 ether);
        vm.prank(who);
        launcher.bid{value: 1 ether}(1e16);
        (,,, bytes32[] memory sources, uint256[] memory ids) = launcher.getBids();
        assertEq(sources[0], keccak256("binance-agent-id"));
        assertEq(ids[0], 42);
    }

    function test_onlyErc8004CanBid() public {
        address who = address(0xB0B);
        vm.prank(who);
        uint256 id = registry.register();
        UniformLauncher launcher = _launcher(_only8004());
        vm.deal(who, 1 ether);
        vm.prank(who);
        launcher.bid{value: 1 ether}(1e16);
        (,,, bytes32[] memory sources, uint256[] memory ids) = launcher.getBids();
        assertEq(sources[0], keccak256("erc-8004"));
        assertEq(ids[0], id);
    }

    function test_eitherSourcePasses() public {
        address binanceOnly = address(0xA11CE);
        address ercOnly = address(0xB0B);
        address both = address(0xCAFE);
        binanceDir.set(binanceOnly, 7);
        binanceDir.set(both, 8);
        vm.prank(ercOnly);
        registry.register();
        vm.prank(both);
        registry.register();
        UniformLauncher launcher = _launcher(_both());
        vm.deal(binanceOnly, 1 ether);
        vm.deal(ercOnly, 1 ether);
        vm.deal(both, 1 ether);
        vm.prank(binanceOnly);
        launcher.bid{value: 1 ether}(1e16);
        vm.prank(ercOnly);
        launcher.bid{value: 1 ether}(1e16);
        vm.prank(both);
        launcher.bid{value: 1 ether}(1e16);
        assertEq(launcher.bidCount(), 3);
        (,,, bytes32[] memory sources,) = launcher.getBids();
        assertEq(sources[0], keccak256("binance-agent-id"));
        assertEq(sources[1], keccak256("erc-8004"));
        assertEq(sources[2], keccak256("binance-agent-id"));
    }

    function test_plainWalletRejected() public {
        UniformLauncher launcher = _launcher(_both());
        address who = address(0xBEEF);
        vm.deal(who, 1 ether);
        vm.prank(who);
        vm.expectRevert(UniformLauncher.NotAgent.selector);
        launcher.bid{value: 1 ether}(1e16);
    }

    function test_transferredNftRejectsOldOwner() public {
        address oldOwner = address(0xA11CE);
        address next = address(0xB0B);
        vm.prank(oldOwner);
        uint256 id = registry.register();
        vm.prank(oldOwner);
        registry.transfer(next, id);
        UniformLauncher launcher = _launcher(_only8004());
        vm.deal(oldOwner, 1 ether);
        vm.prank(oldOwner);
        vm.expectRevert(UniformLauncher.NotAgent.selector);
        launcher.bid{value: 1 ether}(1e16);
        vm.deal(next, 1 ether);
        vm.prank(next);
        launcher.bid{value: 1 ether}(1e16);
        (,,,, uint256[] memory ids) = launcher.getBids();
        assertEq(ids[0], id);
    }

    function test_sameAgentIdCannotBidFromOwnerAndWallet() public {
        address owner = address(0xA11CE);
        address wallet = address(0xB0B);
        vm.prank(owner);
        uint256 id = registry.register();
        vm.prank(owner);
        registry.setAgentWallet(id, wallet);
        UniformLauncher launcher = _launcher(_only8004());
        vm.deal(owner, 1 ether);
        vm.deal(wallet, 1 ether);
        vm.prank(owner);
        launcher.bid{value: 1 ether}(1e16);
        vm.prank(wallet);
        vm.expectRevert(UniformLauncher.AgentAlreadyBid.selector);
        launcher.bid{value: 1 ether}(1e16);
        assertEq(launcher.bidCount(), 1);
    }

    function test_sourcesAreFixed() public {
        UniformLauncher launcher = _launcher(_only8004());
        assertEq(launcher.identitySources(0), address(erc8004));
    }
}
