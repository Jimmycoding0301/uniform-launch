// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IPortal} from "src/flap/IPortal.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {UniformLauncher, LaunchConfig} from "src/uniform/UniformLauncher.sol";
import {UniformLauncherFactory} from "src/uniform/UniformLauncherFactory.sol";
import {UniformVault} from "src/uniform/UniformVault.sol";
import {UniformVaultFactory} from "src/uniform/UniformVaultFactory.sol";

interface IProxyAdminLike {
    function owner() external view returns (address);
}

interface ITaxTokenLike {
    function taxProcessor() external view returns (address);
}

interface ITaxProcessorLike {
    function dispatch() external;
    function feeQuoteBalance() external view returns (uint256);
    function marketQuoteBalance() external view returns (uint256);
    function pendingDividendQuoteTokenBalance() external view returns (uint256);
    function lpQuoteBalance() external view returns (uint256);
}

interface IRouterSell {
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}

interface IRouterLike {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable;
}

/// @notice 对 BSC 测试网 Portal 的只读分叉。没有 BSC_TESTNET_RPC_URL 就跳过。不向活网发交易。
contract UniformForkTest is Test {
    uint256 internal constant PORTAL_FEE_FALLBACK = 0.01 ether;

    IPortal internal portal;
    address internal admin;
    UniformVaultFactory internal vaultFactory;
    UniformLauncherFactory internal launcherFactory;
    address internal creator = address(uint160(0xC0DE0001));
    address internal alice = address(uint160(0xC0DE0002));
    address internal bob = address(uint160(0xC0DE0003));
    address internal trader = address(uint160(0xC0DE0004));

    address internal constant TOKEN_IMPL = 0x7777c57ff7dc441c1715b2e36fa581c48B782222;
    address internal constant WBNB = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;
    address internal constant ROUTER = 0xc9D63ddCB9549578057EAB6A83a543DdFEE2b8c3;

    uint256 internal saltNonce;

    function setUp() public {
        string memory rpc = vm.envOr("BSC_TESTNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        require(block.chainid == 97, "rpc is not chain 97");
        portal = IPortal(LaunchVaultAddresses.hub());
        admin = IProxyAdminLike(0x0000Ed588dfc01749C20bA69b5f8c77d706E0000).owner();
        vm.deal(creator, 50 ether);
        vm.deal(alice, 80 ether);
        vm.deal(bob, 80 ether);
        vm.deal(trader, 80 ether);

        uint256 nonce = vm.getNonce(address(this));
        address predicted = vm.computeCreateAddress(address(this), nonce + 1);
        vaultFactory = new UniformVaultFactory(predicted);
        launcherFactory = new UniformLauncherFactory(address(vaultFactory));

        vm.startPrank(admin);
        portal.setCreationPaused(true);
        portal.setLauncherFactoryMultiplier(address(launcherFactory), 10_000, true);
        portal.setVaultFactoryMultiplier(address(vaultFactory), 10_000, true);
        vm.stopPrank();
    }

    function test_successLaunchClaimBuyAndWithdrawTax() public {
        UniformLauncher launcher = _create(1e13, 200, "TJ", bytes32(uint256(11)));
        assertEq(portal.getLauncher(address(launcher)).launcherFactory, address(launcherFactory));
        assertTrue(_contains(launcher.description(), unicode"统一价拍卖"));

        vm.prank(alice);
        launcher.bid{value: 20 ether}(1e16);
        vm.prank(bob);
        launcher.bid{value: 20 ether}(1e16);
        assertEq(launcher.bidCount(), 2);

        vm.roll(launcher.endBlock());
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Succeeded));
        assertEq(uint16(uint160(launcher.token())), 0x7777);
        assertEq(launcher.poolQuote(), 40 ether);
        assertTrue(launcher.pool() != address(0));
        (address vault,) = portal.getLaunchVault(launcher.token());
        assertTrue(vault != address(0));
        assertEq(UniformVault(payable(vault)).owner(), creator);

        vm.prank(alice);
        launcher.claim();
        vm.prank(bob);
        launcher.claim();

        _generateTaxAndDispatch(launcher.token());
        uint256 accrued = UniformVault(payable(vault)).accrued();
        assertGt(accrued, 0);
        uint256 before = creator.balance;
        vm.prank(creator);
        UniformVault(payable(vault)).withdrawAll();
        assertEq(creator.balance - before, accrued);
        assertEq(address(vault).balance, 0);
    }

    function test_failedAuctionRefundsWithoutToken() public {
        UniformLauncher launcher = _create(1 ether, 200, "FAIL", bytes32(uint256(22)));
        vm.prank(alice);
        launcher.bid{value: 1 ether}(1 ether);
        vm.prank(bob);
        launcher.bid{value: 1 ether}(1 ether);
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

    function test_lowQuoteLaunchRevertsAndRefunds() public {
        UniformLauncher launcher = _create(1, 200, "LOW", bytes32(uint256(44)));
        vm.prank(alice);
        launcher.bid{value: 0.01 ether}(1 ether);
        vm.roll(launcher.endBlock());
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Failed));
        assertEq(launcher.token(), address(0));
        uint256 before = alice.balance;
        vm.prank(alice);
        launcher.refund();
        assertEq(alice.balance - before, 0.01 ether);
        assertEq(address(launcher).balance, 0);
    }

    function test_maxBidsSettleGas() public {
        UniformLauncher launcher = _create(1e13, 200, "GAS", bytes32(uint256(88001)));
        for (uint256 i; i < 32; ++i) {
            address who = address(uint160(0x2000 + i));
            vm.deal(who, 1 ether);
            vm.prank(who);
            launcher.bid{value: 0.2 ether}(1e16);
        }
        vm.roll(launcher.endBlock());
        uint256 before = gasleft();
        launcher.settle();
        uint256 used = before - gasleft();
        console2.log("FORK_MAX_BIDS_SETTLE_GAS", used);
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Succeeded));
        assertLt(used, 8_000_000, "8_000_000 gas limit cannot cover settle");
        assertLt(used, launcher.MIN_SETTLE_GAS(), "MIN_SETTLE_GAS is below the measured settle");
    }

    function test_disabledFactoryFlag() public {
        UniformLauncher launcher = _create(1e13, 200, "OFF", bytes32(uint256(33)));
        vm.prank(admin);
        portal.setLauncherFactoryMultiplier(address(launcherFactory), 10_000, false);
        (bool enabled,) = portal.launcherFactoryMultiplier(address(launcherFactory));
        assertFalse(enabled);
        vm.prank(alice);
        launcher.bid{value: 20 ether}(1e16);
        vm.prank(bob);
        launcher.bid{value: 20 ether}(1e16);
        vm.roll(launcher.endBlock());
        launcher.settle();
        // 当前测试网 Portal 在工厂被关闭后仍完成发射，不回滚。
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Succeeded));
    }

    function _taxLiquidated(address proc) internal view returns (bool) {
        ITaxProcessorLike t = ITaxProcessorLike(proc);
        return t.feeQuoteBalance() > 0 || t.marketQuoteBalance() > 0 || t.pendingDividendQuoteTokenBalance() > 0
            || t.lpQuoteBalance() > 0;
    }

    function _generateTaxAndDispatch(address token) internal {
        vm.warp(block.timestamp + 2 days);
        address proc = ITaxTokenLike(token).taxProcessor();
        address[] memory buyPath = new address[](2);
        buyPath[0] = WBNB;
        buyPath[1] = token;
        address[] memory sellPath = new address[](2);
        sellPath[0] = token;
        sellPath[1] = WBNB;
        vm.startPrank(trader);
        IRouterLike(ROUTER).swapExactETHForTokensSupportingFeeOnTransferTokens{value: 8 ether}(
            0, buyPath, trader, block.timestamp + 600
        );
        for (uint256 i; i < 12; ++i) {
            if (_taxLiquidated(proc)) break;
            uint256 sellAmt = IERC20(token).balanceOf(trader) * 30 / 100;
            if (sellAmt == 0) break;
            IERC20(token).approve(ROUTER, sellAmt);
            uint256 beforeBal = trader.balance;
            IRouterSell(ROUTER)
                .swapExactTokensForETHSupportingFeeOnTransferTokens(sellAmt, 0, sellPath, trader, block.timestamp + 600);
            uint256 proceeds = trader.balance - beforeBal;
            if (proceeds > 0) {
                IRouterLike(ROUTER).swapExactETHForTokensSupportingFeeOnTransferTokens{value: proceeds * 90 / 100}(
                    0, buyPath, trader, block.timestamp + 600
                );
            }
        }
        vm.stopPrank();
        ITaxProcessorLike(proc).dispatch();
    }

    function _create(uint256 floor, uint64 duration, string memory symbol, bytes32 seed)
        internal
        returns (UniformLauncher launcher)
    {
        LaunchConfig memory c;
        c.name = "Tongjia";
        c.symbol = symbol;
        c.meta = "bafkreig4y5nwb4izyilbbmiydumvkld446d4k7j4ohg3x3q2lfel3fo4yq";
        c.salt = _mineSalt(seed);
        c.floorPrice = floor;
        c.durationBlocks = duration;
        uint256 fee = portal.SALT_LOCK_FEE();
        if (fee == 0) fee = PORTAL_FEE_FALLBACK;
        vm.prank(creator);
        launcher = UniformLauncher(payable(portal.newLauncher{value: fee}(address(launcherFactory), abi.encode(c))));
    }

    function _mineSalt(bytes32 seed) internal returns (bytes32 salt) {
        uint256 start = ++saltNonce << 128;
        for (uint256 i = start;; ++i) {
            assembly ("memory-safe") {
                mstore(0x00, seed)
                mstore(0x20, i)
                salt := keccak256(0x00, 0x40)
            }
            if (uint16(uint160(Clones.predictDeterministicAddress(TOKEN_IMPL, salt, address(portal)))) == 0x7777) {
                return salt;
            }
        }
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
