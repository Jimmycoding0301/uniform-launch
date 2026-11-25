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
import {PancakeV2Testnet} from "src/uniform/PancakeV2Testnet.sol";
import {AgentIdentityAddresses} from "src/uniform/AgentIdentityAddresses.sol";
import {BinanceAgentIdSource} from "src/uniform/BinanceAgentIdSource.sol";
import {Erc8004Source} from "src/uniform/Erc8004Source.sol";
import {PermissiveAgentDirectory} from "./PermissiveAgentDirectory.sol";

interface IOfficial8004 {
    function register() external returns (uint256 agentId);
    function ownerOf(uint256 agentId) external view returns (address);
    function getAgentWallet(uint256 agentId) external view returns (address);
    function transferFrom(address from, address to, uint256 agentId) external;
    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external;
}

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

interface IPoolLike {
    function factory() external view returns (address);
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
    uint256 internal constant PORTAL_FEE_FALLBACK = 0.005 ether;

    IPortal internal portal;
    address internal admin;
    UniformVaultFactory internal vaultFactory;
    UniformLauncherFactory internal launcherFactory;
    address internal creator = address(uint160(0xC0DE0001));
    address internal alice = address(uint160(0xC0DE0002));
    address internal bob = address(uint160(0xC0DE0003));
    address internal trader = address(uint160(0xC0DE0004));

    address internal constant TOKEN_IMPL = 0x7777c57ff7dc441c1715b2e36fa581c48B782222;
    address internal constant WBNB = PancakeV2Testnet.WBNB;
    address internal constant ROUTER = PancakeV2Testnet.ROUTER;
    address internal constant FACTORY = PancakeV2Testnet.FACTORY;

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
        launcher.bid{value: 20 ether}(1e16, 0, uint160(alice));
        vm.prank(bob);
        launcher.bid{value: 20 ether}(1e16, 0, uint160(bob));
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
        launcher.bid{value: 1 ether}(1 ether, 0, uint160(alice));
        vm.prank(bob);
        launcher.bid{value: 1 ether}(1 ether, 0, uint160(bob));
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
        launcher.bid{value: 0.01 ether}(1 ether, 0, uint160(alice));
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
            launcher.bid{value: 0.2 ether}(1e16, 0, uint160(who));
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

    function test_oneBnbBelowLaunchFloorRefunds() public {
        UniformLauncher launcher = _create(1e12, 200, "LOW", bytes32(uint256(88011)));
        vm.prank(alice);
        launcher.bid{value: 1 ether}(1e16, 0, uint160(alice));
        vm.roll(launcher.endBlock());
        IPortal.GraduationFloorResultV2 memory floor = _floor(launcher, 1 ether);
        assertFalse(floor.meetsCreateFloor);
        assertLt(1 ether, launcher.minPoolQuote());
        uint256 before = alice.balance;
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Failed));
        assertEq(launcher.token(), address(0));
        vm.prank(alice);
        launcher.refund();
        assertEq(alice.balance - before, 1 ether);
        assertEq(address(launcher).balance, 0);
    }

    function test_graduationQuoteLaunches() public {
        UniformLauncher probe = _create(1e13, 200, "PRB", bytes32(uint256(88012)));
        uint256 quote = probe.minPoolQuote();
        UniformLauncher launcher = _create(1e12, 200, "OK", bytes32(uint256(88013)));
        assertGe(quote, 4.285714285714285715 ether);
        vm.deal(alice, quote);
        vm.prank(alice);
        launcher.bid{value: quote}(1e16, 0, uint160(alice));
        vm.roll(launcher.endBlock());
        IPortal.GraduationFloorResultV2 memory floor = _floor(launcher, quote);
        assertTrue(floor.meetsCreateFloor);
        assertTrue(floor.meetsFloor);
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Succeeded));
        assertTrue(launcher.token() != address(0));
        assertTrue(launcher.pool() != address(0));
        assertEq(IPoolLike(launcher.pool()).factory(), FACTORY);
        assertGe(launcher.poolQuote(), quote - 1);
        vm.prank(alice);
        launcher.claim();
        assertEq(address(launcher).balance, 0);
    }

    function test_officialErc8004RegisterThenBid() public {
        IOfficial8004 reg = IOfficial8004(AgentIdentityAddresses.ERC8004_TESTNET);
        vm.prank(alice);
        uint256 id = reg.register();
        assertEq(reg.ownerOf(id), alice);
        assertEq(reg.getAgentWallet(id), alice);

        UniformLauncher launcher = _create8004(bytes32("official-8004-owner"));
        vm.prank(alice);
        launcher.bid{value: 1 ether}(1e16, 0, id);
        vm.prank(bob);
        vm.expectRevert(UniformLauncher.NotAgent.selector);
        launcher.bid{value: 1 ether}(1e16, 0, id);
        (,,, bytes32[] memory sources, uint256[] memory ids) = launcher.getBids();
        assertEq(sources[0], keccak256("erc-8004"));
        assertEq(ids[0], id);

        uint256 walletKey = 0xA11CE;
        address wallet = vm.addr(walletKey);
        vm.prank(bob);
        uint256 id2 = reg.register();
        uint256 deadline = block.timestamp + 4 minutes;
        bytes32 digest = _agentWalletDigest(address(reg), id2, wallet, bob, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(walletKey, digest);
        vm.prank(bob);
        reg.setAgentWallet(id2, wallet, deadline, abi.encodePacked(r, s, v));
        assertEq(reg.getAgentWallet(id2), wallet);

        UniformLauncher walletLauncher = _create8004(bytes32("official-8004-wallet"));
        vm.deal(wallet, 2 ether);
        vm.prank(wallet);
        walletLauncher.bid{value: 1 ether}(1e16, 0, id2);
        vm.prank(bob);
        vm.expectRevert(UniformLauncher.AgentAlreadyBid.selector);
        walletLauncher.bid{value: 1 ether}(1e16, 0, id2);

        address next = address(0xB0B);
        vm.prank(alice);
        reg.transferFrom(alice, next, id);
        assertEq(reg.ownerOf(id), next);
        assertEq(reg.getAgentWallet(id), address(0));
        UniformLauncher moved = _create8004(bytes32("official-8004-transfer"));
        vm.prank(alice);
        vm.expectRevert(UniformLauncher.NotAgent.selector);
        moved.bid{value: 1 ether}(1e16, 0, id);
        vm.deal(next, 1 ether);
        vm.prank(next);
        moved.bid{value: 1 ether}(1e16, 0, id);
    }

    function test_mainnetAgentIdUsesBalanceAndUint160() public {
        string memory rpc = vm.envOr("BSC_MAINNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) vm.skip(true);
        vm.createSelectFork(rpc);
        address holder = 0x140405955366853d230b65058EF7dD36b68375c2;
        address nft = AgentIdentityAddresses.AGENT_ID_MAINNET;
        BinanceAgentIdSource src = new BinanceAgentIdSource(nft);
        assertFalse(src.standIn());
        (bool enumerated,) =
            nft.staticcall(abi.encodeWithSignature("tokenOfOwnerByIndex(address,uint256)", holder, uint256(0)));
        assertFalse(enumerated);
        (bool ok, bytes32 sourceId) = src.verify(holder, uint160(holder));
        assertTrue(ok);
        assertEq(sourceId, keccak256("binance-agent-id"));
        (bool wrong,) = src.verify(holder, 1);
        assertFalse(wrong);
        (bool stranger,) = src.verify(address(0xBEEF), uint160(address(0xBEEF)));
        assertFalse(stranger);
    }

    function test_disabledFactoryFlag() public {
        UniformLauncher launcher = _create(1e13, 200, "OFF", bytes32(uint256(33)));
        vm.prank(admin);
        portal.setLauncherFactoryMultiplier(address(launcherFactory), 10_000, false);
        (bool enabled,) = portal.launcherFactoryMultiplier(address(launcherFactory));
        assertFalse(enabled);
        vm.prank(alice);
        launcher.bid{value: 20 ether}(1e16, 0, uint160(alice));
        vm.prank(bob);
        launcher.bid{value: 20 ether}(1e16, 0, uint160(bob));
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

    function _floor(UniformLauncher launcher, uint256 quoteIn)
        internal
        view
        returns (IPortal.GraduationFloorResultV2 memory)
    {
        (bool enabled, uint256 price) = portal.launchQuoteConfig(0, address(0));
        require(enabled && price != 0, "quote config");
        return portal.graduationFloorV2ForLauncher(
            IPortal.GraduationFloorParams({
                quoteToken: address(0),
                quotePriceUsd: price,
                poolQuote: quoteIn,
                poolToken: launcher.POOL_AMOUNT(),
                totalSupply: launcher.TOTAL_SUPPLY(),
                vaultFactory: launcher.vaultFactory()
            }),
            address(launcher)
        );
    }

    function _create8004(bytes32 seed) internal returns (UniformLauncher launcher) {
        Erc8004Source source = new Erc8004Source(AgentIdentityAddresses.ERC8004_TESTNET);
        LaunchConfig memory c;
        c.name = "Tongjia";
        c.symbol = "E8";
        c.meta = "bafkreig4y5nwb4izyilbbmiydumvkld446d4k7j4ohg3x3q2lfel3fo4yq";
        c.salt = _mineSalt(seed);
        c.floorPrice = 1e13;
        c.durationBlocks = 200;
        c.identitySources = new address[](1);
        c.identitySources[0] = address(source);
        uint256 fee = portal.SALT_LOCK_FEE();
        if (fee == 0) fee = PORTAL_FEE_FALLBACK;
        vm.prank(creator);
        launcher = UniformLauncher(payable(portal.newLauncher{value: fee}(address(launcherFactory), abi.encode(c))));
    }

    function _agentWalletDigest(address registry, uint256 agentId, address wallet, address owner, uint256 deadline)
        internal
        view
        returns (bytes32)
    {
        bytes32 typehash = keccak256("AgentWalletSet(uint256 agentId,address newWallet,address owner,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(typehash, agentId, wallet, owner, deadline));
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("ERC8004IdentityRegistry"),
                keccak256("1"),
                block.chainid,
                registry
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domain, structHash));
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
        c.identitySources = new address[](1);
        c.identitySources[0] = address(new BinanceAgentIdSource(address(new PermissiveAgentDirectory())));
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
