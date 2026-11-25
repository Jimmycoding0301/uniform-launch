// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPortalTypes} from "src/flap/IPortal.sol";
import {Distribution} from "src/flap/Distribution.sol";
import {IStrategy} from "src/flap/IStrategy.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {UniformLauncher, LaunchConfig} from "src/uniform/UniformLauncher.sol";
import {UniformLauncherFactory} from "src/uniform/UniformLauncherFactory.sol";
import {UniformVaultFactory} from "src/uniform/UniformVaultFactory.sol";

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
        return 0.01 ether;
    }

    function lockSalt(bytes32, uint8) external payable {}

    function launchTaxTokenV2(
        IPortalTypes.CreateTaxTokenParams calldata p,
        Distribution calldata distribution,
        IPortalTypes.CreatorBuyParams calldata
    ) external payable returns (address token, address pool) {
        if (p.poolQuote < 3 ether) revert("floor");
        if (msg.value != p.poolQuote) revert("value");
        FakeToken t = new FakeToken();
        t.mint(address(this), distribution.amount);
        t.approve(distribution.strategy, distribution.amount);
        IStrategy(distribution.strategy).initializeDistribution(address(t), distribution.amount, "", bytes32(0));
        return (address(t), address(0xBEEF));
    }
}

contract Handler is Test {
    UniformLauncher public launcher;
    uint256 public totalIn;
    uint256 public totalOut;
    uint256 public claimedTokens;
    uint8 public lastStatus;
    address[] public actors;

    constructor(UniformLauncher launcher_) {
        launcher = launcher_;
        for (uint256 i = 1; i <= 8; ++i) {
            actors.push(address(uint160(i + 50)));
        }
    }

    function bid(uint256 actorSeed, uint96 paySeed, uint256 priceSeed) external {
        if (uint8(launcher.status()) != 0) return;
        if (block.number < launcher.startBlock() || block.number >= launcher.endBlock() - launcher.CLOSE_BUFFER()) return;
        address who = actors[actorSeed % actors.length];
        if (launcher.bidOf(who) != 0) return;
        uint256 pay = bound(uint256(paySeed), 0.01 ether, 4 ether);
        uint256 price = bound(priceSeed, launcher.floorPrice(), launcher.floorPrice() * 30);
        vm.deal(who, who.balance + pay);
        vm.prank(who);
        launcher.bid{value: pay}(price);
        totalIn += pay;
        _statusForward();
    }

    function advance(uint256 blocks) external {
        uint256 n = bound(blocks, 1, 80);
        vm.roll(block.number + n);
    }

    function settle() external {
        if (uint8(launcher.status()) != 0) return;
        if (block.number < launcher.endBlock()) return;
        launcher.settle();
        _statusForward();
    }

    function pull(uint256 actorSeed) external {
        uint8 s = uint8(launcher.status());
        if (s == 0) return;
        address who = actors[actorSeed % actors.length];
        if (launcher.bidOf(who) == 0) return;
        uint256 ethBefore = who.balance;
        uint256 tokBefore = launcher.token() == address(0) ? 0 : FakeToken(launcher.token()).balanceOf(who);
        vm.prank(who);
        (bool ok,) = address(launcher).call(abi.encodeWithSignature(s == 2 ? "refund()" : "claim()"));
        if (!ok) return;
        totalOut += who.balance - ethBefore;
        if (launcher.token() != address(0)) claimedTokens += FakeToken(launcher.token()).balanceOf(who) - tokBefore;
        _statusForward();
    }

    function _statusForward() internal {
        uint8 s = uint8(launcher.status());
        require(s >= lastStatus, "status moved backward");
        lastStatus = s;
    }
}

contract UniformInvariantTest is Test {
    Handler internal handler;
    UniformLauncher internal launcher;

    function setUp() public {
        vm.chainId(97);
        address portal = LaunchVaultAddresses.hub();
        vm.etch(portal, address(new MockPortal()).code);
        vm.deal(portal, 5 ether);
        vm.deal(address(this), 5 ether);
        uint256 nonce = vm.getNonce(address(this));
        address predicted = vm.computeCreateAddress(address(this), nonce + 1);
        UniformVaultFactory vaultFactory = new UniformVaultFactory(predicted);
        UniformLauncherFactory launcherFactory = new UniformLauncherFactory(address(vaultFactory));
        LaunchConfig memory c;
        c.name = "Tongjia";
        c.symbol = "INV";
        c.meta = "bafy";
        c.salt = bytes32(uint256(9));
        c.floorPrice = 1e13;
        c.durationBlocks = 400;
        vm.prank(portal);
        launcher = UniformLauncher(payable(launcherFactory.newLauncher{value: 0.01 ether}(address(this), abi.encode(c))));
        handler = new Handler(launcher);
        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = Handler.bid.selector;
        selectors[1] = Handler.advance.selector;
        selectors[2] = Handler.settle.selector;
        selectors[3] = Handler.pull.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_bnbConserved() public view {
        uint8 s = uint8(launcher.status());
        if (s == 0) {
            assertEq(address(launcher).balance, handler.totalIn());
            return;
        }
        if (s == 2) {
            assertEq(address(launcher).balance + handler.totalOut(), handler.totalIn());
            assertEq(launcher.token(), address(0));
            assertEq(launcher.poolQuote(), 0);
            return;
        }
        assertEq(address(launcher).balance + handler.totalOut() + launcher.poolQuote(), handler.totalIn());
        assertTrue(launcher.token() != address(0));
        assertEq(FakeToken(launcher.token()).balanceOf(address(launcher)) + handler.claimedTokens(), launcher.SELL_AMOUNT());
    }

    function invariant_statusOnce() public view {
        uint8 s = uint8(launcher.status());
        assertLe(handler.lastStatus(), s);
        assertLe(s, 2);
    }
}
