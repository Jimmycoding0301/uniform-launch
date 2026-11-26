// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FixtureNamePolicy, FixtureLauncherFactory} from "./FixtureNamePolicy.sol";
import {Test} from "forge-std/Test.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {UniformLauncher, LaunchConfig} from "src/uniform/UniformLauncher.sol";
import {UniformLauncherFactory} from "src/uniform/UniformLauncherFactory.sol";
import {UniformVaultFactory} from "src/uniform/UniformVaultFactory.sol";
import {AgentIdentityAddresses} from "src/uniform/AgentIdentityAddresses.sol";
import {BinanceAgentIdSource} from "src/uniform/BinanceAgentIdSource.sol";
import {Erc8004Source} from "src/uniform/Erc8004Source.sol";

contract ListedNft {
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public tokenId;

    function set(address wallet, uint256 id) external {
        balanceOf[wallet] = 1;
        tokenId[wallet] = id;
    }

    function tokenOfOwnerByIndex(address wallet, uint256) external view returns (uint256) {
        return tokenId[wallet];
    }
}

contract BalanceOnlyNft {
    mapping(address => uint256) public balanceOf;

    function set(address wallet) external {
        balanceOf[wallet] = 1;
    }
}

contract IdentityMock {
    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => address) public getAgentWallet;
    uint256 public nextId = 1;

    function register() external returns (uint256 id) {
        id = nextId++;
        ownerOf[id] = msg.sender;
        getAgentWallet[id] = msg.sender;
    }

    function transferFrom(address from, address to, uint256 id) external {
        require(ownerOf[id] == from && from == msg.sender, "owner");
        ownerOf[id] = to;
        getAgentWallet[id] = address(0);
    }

    function setAgentWallet(uint256 id, address wallet) external {
        require(ownerOf[id] == msg.sender, "owner");
        getAgentWallet[id] = wallet;
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
    ListedNft internal listed;
    BalanceOnlyNft internal balanceOnly;
    BinanceAgentIdSource internal listedSource;
    BinanceAgentIdSource internal balanceSource;
    IdentityMock internal registry;
    Erc8004Source internal erc8004;
    address internal creator = address(0xC0DE0001);
    uint256 internal saltNonce = 400;

    function setUp() public {
        vm.chainId(97);
        address portal = LaunchVaultAddresses.hub();
        vm.etch(portal, address(new FeePortal()).code);
        vm.deal(portal, 1 ether);
        bytes memory screening = address(new FixtureNamePolicy()).code;
        vm.etch(0x5CfbE713d070e87F67D1bc84312B7eB8Fe4F2B5E, screening);
        vm.etch(0xfFb69d59f62454f3B8322Bc1a9FCE6E171a5264f, screening);
        uint256 nonce = vm.getNonce(address(this));
        address predicted = vm.computeCreateAddress(address(this), nonce + 1);
        UniformVaultFactory vaultFactory = new UniformVaultFactory(predicted);
        launcherFactory = new FixtureLauncherFactory(address(vaultFactory));
        listed = new ListedNft();
        balanceOnly = new BalanceOnlyNft();
        listedSource = new BinanceAgentIdSource(address(listed));
        balanceSource = new BinanceAgentIdSource(address(balanceOnly));
        registry = new IdentityMock();
        erc8004 = new Erc8004Source(address(registry));
        vm.deal(address(this), 1 ether);
    }

    function _launcher(address[] memory sources) internal returns (UniformLauncher launcher) {
        LaunchConfig memory c;
        c.name = "Tongjia";
        c.symbol = "ID";
        c.meta = "bafy";
        c.salt = bytes32(++saltNonce);
        c.floorPrice = 1;
        c.durationBlocks = 200;
        c.identitySources = sources;
        address portal = LaunchVaultAddresses.hub();
        vm.prank(portal);
        launcher = UniformLauncher(payable(launcherFactory.newLauncher{value: 0.005 ether}(creator, abi.encode(c))));
    }

    function _only(address source) internal pure returns (address[] memory sources) {
        sources = new address[](1);
        sources[0] = source;
    }

    function _both() internal view returns (address[] memory sources) {
        sources = new address[](2);
        sources[0] = address(balanceSource);
        sources[1] = address(erc8004);
    }

    function test_mainnetUsesRealAgentTokenIdWithoutAddressFallback() public {
        vm.chainId(56);
        address nft = AgentIdentityAddresses.AGENT_ID_MAINNET;
        IdentityMock identity = new IdentityMock();
        address who = address(0xA11CE);
        vm.prank(who);
        uint256 id = identity.register();
        vm.etch(nft, address(identity).code);
        vm.mockCall(nft, abi.encodeWithSignature("ownerOf(uint256)", id), abi.encode(who));
        vm.mockCallRevert(nft, abi.encodeWithSignature("ownerOf(uint256)", uint160(who)), "missing");
        BinanceAgentIdSource adapter = new BinanceAgentIdSource(nft);
        (bool ok,) = adapter.verify(who, id);
        assertTrue(ok);
        (ok,) = adapter.verify(who, uint160(who));
        assertFalse(ok);
    }

    function test_onlyAgentIdPassesWithUint160WhenEnumerationMissing() public {
        address who = address(0xA11CE);
        balanceOnly.set(who);
        UniformLauncher launcher = _launcher(_only(address(balanceSource)));
        vm.deal(who, 1 ether);
        vm.prank(who);
        vm.expectRevert(UniformLauncher.NotAgent.selector);
        launcher.bid{value: 1 ether}(1e16, 0, 42);
        vm.prank(who);
        launcher.bid{value: 1 ether}(1e16, 0, uint160(who));
        (,,, bytes32[] memory sources, uint256[] memory ids) = launcher.getBids();
        assertEq(sources[0], keccak256("binance-agent-id"));
        assertEq(ids[0], uint160(who));
        assertTrue(balanceSource.standIn());
    }

    function test_enumerableAgentIdUsesTokenId() public {
        address who = address(0xA11CE);
        listed.set(who, 42);
        UniformLauncher launcher = _launcher(_only(address(listedSource)));
        vm.deal(who, 1 ether);
        vm.prank(who);
        vm.expectRevert(UniformLauncher.NotAgent.selector);
        launcher.bid{value: 1 ether}(1e16, 0, uint160(who));
        vm.prank(who);
        launcher.bid{value: 1 ether}(1e16, 0, 42);
        (,,,, uint256[] memory ids) = launcher.getBids();
        assertEq(ids[0], 42);
    }

    function test_onlyErc8004Passes() public {
        address who = address(0xB0B);
        vm.prank(who);
        uint256 id = registry.register();
        UniformLauncher launcher = _launcher(_only(address(erc8004)));
        vm.deal(who, 1 ether);
        vm.prank(who);
        launcher.bid{value: 1 ether}(1e16, 0, id);
        (,,, bytes32[] memory sources, uint256[] memory ids) = launcher.getBids();
        assertEq(sources[0], keccak256("erc-8004"));
        assertEq(ids[0], id);
    }

    function test_eitherSourcePassesWhenTheAgentPicksIt() public {
        address binanceOnly = address(0xA11CE);
        address ercOnly = address(0xB0B);
        address both = address(0xCAFE);
        balanceOnly.set(binanceOnly);
        balanceOnly.set(both);
        vm.prank(ercOnly);
        uint256 ercId = registry.register();
        vm.prank(both);
        uint256 bothId = registry.register();
        UniformLauncher launcher = _launcher(_both());
        vm.deal(binanceOnly, 1 ether);
        vm.deal(ercOnly, 1 ether);
        vm.deal(both, 1 ether);
        vm.prank(binanceOnly);
        launcher.bid{value: 1 ether}(1e16, 0, uint160(binanceOnly));
        vm.prank(ercOnly);
        launcher.bid{value: 1 ether}(1e16, 1, ercId);
        vm.prank(both);
        launcher.bid{value: 1 ether}(1e16, 1, bothId);
        assertEq(launcher.bidCount(), 3);
        (,,, bytes32[] memory sources,) = launcher.getBids();
        assertEq(sources[0], keccak256("binance-agent-id"));
        assertEq(sources[1], keccak256("erc-8004"));
        assertEq(sources[2], keccak256("erc-8004"));
    }

    function test_plainWalletRejected() public {
        UniformLauncher launcher = _launcher(_both());
        address who = address(0xBEEF);
        vm.deal(who, 1 ether);
        vm.prank(who);
        vm.expectRevert(UniformLauncher.NotAgent.selector);
        launcher.bid{value: 1 ether}(1e16, 0, uint160(who));
        vm.prank(who);
        vm.expectRevert(UniformLauncher.NotAgent.selector);
        launcher.bid{value: 1 ether}(1e16, 1, 1);
    }

    function test_transferredNftRejectsOldOwner() public {
        address oldOwner = address(0xA11CE);
        address next = address(0xB0B);
        vm.prank(oldOwner);
        uint256 id = registry.register();
        vm.prank(oldOwner);
        registry.transferFrom(oldOwner, next, id);
        UniformLauncher launcher = _launcher(_only(address(erc8004)));
        vm.deal(oldOwner, 1 ether);
        vm.prank(oldOwner);
        vm.expectRevert(UniformLauncher.NotAgent.selector);
        launcher.bid{value: 1 ether}(1e16, 0, id);
        vm.deal(next, 1 ether);
        vm.prank(next);
        launcher.bid{value: 1 ether}(1e16, 0, id);
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
        UniformLauncher launcher = _launcher(_only(address(erc8004)));
        vm.deal(owner, 1 ether);
        vm.deal(wallet, 1 ether);
        vm.prank(owner);
        launcher.bid{value: 1 ether}(1e16, 0, id);
        vm.prank(wallet);
        vm.expectRevert(UniformLauncher.AgentAlreadyBid.selector);
        launcher.bid{value: 1 ether}(1e16, 0, id);
        assertEq(launcher.bidCount(), 1);
    }

    function test_sharedEnumerableIdCannotBidTwice() public {
        address first = address(0xA11CE);
        address second = address(0xB0B);
        listed.set(first, 42);
        listed.set(second, 42);
        UniformLauncher launcher = _launcher(_only(address(listedSource)));
        vm.deal(first, 1 ether);
        vm.deal(second, 1 ether);
        vm.prank(first);
        launcher.bid{value: 1 ether}(1e16, 0, 42);
        vm.prank(second);
        vm.expectRevert(UniformLauncher.AgentAlreadyBid.selector);
        launcher.bid{value: 1 ether}(1e16, 0, 42);
    }

    function test_sourcesAreFixed() public {
        UniformLauncher launcher = _launcher(_only(address(erc8004)));
        assertEq(launcher.identitySourceCount(), 1);
        assertEq(launcher.identitySources(0), address(erc8004));
    }

    function test_mainnetAgentIdAddressIsTheContractWeRead() public pure {
        assertEq(AgentIdentityAddresses.AGENT_ID_MAINNET, 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F);
        assertEq(AgentIdentityAddresses.ERC8004_MAINNET, 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432);
        assertEq(AgentIdentityAddresses.ERC8004_TESTNET, 0x8004A818BFB912233c491871b3d84c89A494BD9e);
    }
}
