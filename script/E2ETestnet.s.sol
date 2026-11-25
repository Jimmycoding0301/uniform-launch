// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {LibString} from "solady/utils/LibString.sol";
import {IPortal} from "src/flap/IPortal.sol";
import {UniformLauncher, LaunchConfig} from "src/uniform/UniformLauncher.sol";
import {UniformVault} from "src/uniform/UniformVault.sol";
import {PancakeV2Testnet} from "src/uniform/PancakeV2Testnet.sol";
import {LocalRpc} from "./LocalRpc.sol";

interface IStandIn {
    function claim() external;
}

interface IRegistry {
    function register() external returns (uint256);
}

interface ITaxToken {
    function taxProcessor() external view returns (address);
}

interface ITaxProcessor {
    function dispatch() external;
}

interface IRouter {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable;

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}

/// @notice 分阶段跑测试网发射。默认只模拟。只有 RPC 是本机时才允许 --broadcast。
///         私钥不在这个脚本里读取，也不打印。本机分叉用已解锁地址。
contract E2ETestnet is Script {
    address internal constant PORTAL = 0x000042108465206185A077Edc3F3fd2b49060000;
    address internal constant FACTORY = 0xE82642aC5c3B3B4b7D4cDeaf6a251Dc0BB7AcEfd;
    address internal constant AGENT_SOURCE = 0xe4f7B9aBA67FEDAbF9B9a151C604466D448DAb09;
    address internal constant ERC_SOURCE = 0x0526f00B99e952cE55F1B7BDaf9E6Ae42b42cf22;
    address internal constant STAND_IN = 0x89c60E8E5aF13508900152e5FEE149bf5708d8a0;
    address internal constant REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
    address internal constant TOKEN_IMPL = 0x7777c57ff7dc441c1715b2e36fa581c48B782222;
    address internal constant CREATOR = address(uint160(0xC0DE0001));
    address internal constant ALICE = address(uint160(0xC0DE0002));
    address internal constant BOB = address(uint160(0xC0DE0003));
    address internal constant TRADER = address(uint160(0xC0DE0004));
    address internal constant CAROL = address(uint160(0xC0DE0005));
    string internal constant PATH = "deployments/bsc-testnet-e2e.json";

    function create() external {
        _refuseRemote();
        IPortal portal = IPortal(PORTAL);
        (bool enabled,) = portal.launcherFactoryMultiplier(FACTORY);
        if (!enabled) {
            console2.log(unicode"Flap 还没开这个工厂的权限");
            console2.log(FACTORY);
            revert("flap-not-enabled");
        }
        uint256 fee = portal.SALT_LOCK_FEE();
        uint256 gasReserve = 0.02 ether;
        uint256 minPool = 4335714285714285715;
        if (CREATOR.balance < fee + gasReserve) {
            console2.log(unicode"余额不够");
            console2.log(unicode"差额");
            console2.log(fee + gasReserve - CREATOR.balance);
            revert("short-creator");
        }
        if (ALICE.balance + BOB.balance + CAROL.balance < minPool) {
            console2.log(unicode"余额不够");
            console2.log(unicode"差额");
            console2.log(minPool - (ALICE.balance + BOB.balance + CAROL.balance));
            revert("short-pool");
        }
        console2.log(unicode"预计花费");
        console2.log(fee + gasReserve);

        LaunchConfig memory c;
        c.name = "Tongjia";
        c.symbol = "E2E";
        c.meta = "bafkreig4y5nwb4izyilbbmiydumvkld446d4k7j4ohg3x3q2lfel3fo4yq";
        c.salt = _mine(keccak256(abi.encode(bytes32("e2e-script"), block.number)));
        c.floorPrice = 1e13;
        c.durationBlocks = 200;
        c.identitySources = new address[](2);
        c.identitySources[0] = AGENT_SOURCE;
        c.identitySources[1] = ERC_SOURCE;

        vm.startBroadcast(CREATOR);
        address launcher = portal.newLauncher{value: fee}(FACTORY, abi.encode(c));
        vm.stopBroadcast();
        console2.log(unicode"Launcher");
        console2.log(launcher);
        _put("launcher", LibString.toHexStringChecksummed(launcher));
        _put("createFee", vm.toString(fee));
    }

    function bid() external {
        _refuseRemote();
        UniformLauncher launcher = UniformLauncher(payable(_need("launcher")));
        if (uint8(launcher.status()) != 0) {
            console2.log(unicode"窗口已关");
            revert("closed");
        }
        uint256 n = launcher.bidCount();
        if (n == 0) _bidAgent(launcher, ALICE, 20 ether, 1e16);
        else if (n == 1) _bid8004(launcher);
        else if (n == 2) _bidAgent(launcher, CAROL, 1 ether, 2e13);
        else {
            console2.log(unicode"出价已经齐了");
            revert("bids-full");
        }
        _put("bidCount", vm.toString(launcher.bidCount()));
    }

    function settle() external {
        _refuseRemote();
        UniformLauncher launcher = UniformLauncher(payable(_need("launcher")));
        if (block.number < launcher.endBlock()) {
            console2.log(unicode"还没到结算");
            revert("early");
        }
        if (uint8(launcher.status()) != 0) {
            console2.log(unicode"窗口已关");
            revert("closed");
        }
        vm.startBroadcast(CREATOR);
        (bool ok,) = address(launcher).call{gas: 8_000_000}(abi.encodeWithSignature("settle()"));
        vm.stopBroadcast();
        if (!ok) {
            console2.log(unicode"结算回滚");
            revert("settle-reverted");
        }
        console2.log(unicode"清算价");
        console2.log(launcher.clearingPrice());
        console2.log(unicode"入池");
        console2.log(launcher.poolQuote());
        _put("clearingPrice", vm.toString(launcher.clearingPrice()));
        _put("poolQuote", vm.toString(launcher.poolQuote()));
        _put("token", LibString.toHexStringChecksummed(launcher.token()));
        _put("pool", LibString.toHexStringChecksummed(launcher.pool()));
        _put("status", vm.toString(uint8(launcher.status())));
    }

    function claim() external {
        _refuseRemote();
        UniformLauncher launcher = UniformLauncher(payable(_need("launcher")));
        if (uint8(launcher.status()) != 1) {
            console2.log(unicode"现在不能领取");
            revert("not-live");
        }
        _claimOne(launcher, ALICE, "aliceTokens");
        _claimOne(launcher, BOB, "bobTokens");
        _claimOne(launcher, CAROL, "carolTokens");
    }

    function trade() external {
        _refuseRemote();
        UniformLauncher launcher = UniformLauncher(payable(_need("launcher")));
        address token = launcher.token();
        if (token == address(0)) {
            console2.log(unicode"还没有代币");
            revert("no-token");
        }
        (address vault,) = IPortal(PORTAL).getLaunchVault(token);
        uint256 before = address(vault).balance;
        address[] memory buyPath = new address[](2);
        buyPath[0] = PancakeV2Testnet.WBNB;
        buyPath[1] = token;
        address[] memory sellPath = new address[](2);
        sellPath[0] = token;
        sellPath[1] = PancakeV2Testnet.WBNB;
        vm.startBroadcast(TRADER);
        IRouter(PancakeV2Testnet.ROUTER).swapExactETHForTokensSupportingFeeOnTransferTokens{value: 1 ether}(
            0, buyPath, TRADER, block.timestamp + 600
        );
        uint256 sellAmt = IERC20(token).balanceOf(TRADER) / 2;
        IERC20(token).approve(PancakeV2Testnet.ROUTER, sellAmt);
        IRouter(PancakeV2Testnet.ROUTER).swapExactTokensForETHSupportingFeeOnTransferTokens(
            sellAmt, 0, sellPath, TRADER, block.timestamp + 600
        );
        ITaxProcessor(ITaxToken(token).taxProcessor()).dispatch();
        vm.stopBroadcast();
        uint256 afterBal = address(vault).balance;
        console2.log(unicode"金库余额");
        console2.log(before);
        console2.log(afterBal);
        _put("vault", LibString.toHexStringChecksummed(vault));
        _put("vaultBefore", vm.toString(before));
        _put("vaultAfter", vm.toString(afterBal));
    }

    function withdraw() external {
        _refuseRemote();
        address vault = _need("vault");
        uint256 accrued = UniformVault(payable(vault)).accrued();
        uint256 before = CREATOR.balance;
        vm.startBroadcast(CREATOR);
        UniformVault(payable(vault)).withdrawAll();
        vm.stopBroadcast();
        uint256 got = CREATOR.balance - before;
        console2.log(unicode"金库原余额");
        console2.log(accrued);
        console2.log(unicode"创建者余额增加");
        console2.log(got);
        _put("withdrawn", vm.toString(accrued));
        _put("ownerDelta", vm.toString(got));
    }

    function show() external view {
        address launcher = _need("launcher");
        UniformLauncher l = UniformLauncher(payable(launcher));
        console2.log(unicode"阶段");
        console2.log(uint8(l.status()));
        console2.log(unicode"出价笔数");
        console2.log(l.bidCount());
        console2.log(unicode"清算价");
        console2.log(l.clearingPrice());
        console2.log(unicode"入池");
        console2.log(l.poolQuote());
        console2.log(l.token());
        console2.log(l.pool());
    }

    function _bidAgent(UniformLauncher launcher, address who, uint256 budget, uint256 maxPrice) internal {
        vm.startBroadcast(who);
        IStandIn(STAND_IN).claim();
        launcher.bid{value: budget}(maxPrice, 0, uint160(who));
        vm.stopBroadcast();
        console2.log(unicode"出价");
        console2.log(who);
    }

    function _bid8004(UniformLauncher launcher) internal {
        vm.startBroadcast(BOB);
        uint256 id = IRegistry(REGISTRY).register();
        launcher.bid{value: 20 ether}(1e16, 1, id);
        vm.stopBroadcast();
        console2.log(unicode"ERC-8004 编号");
        console2.log(id);
        _put("bobAgentId", vm.toString(id));
    }

    function _claimOne(UniformLauncher launcher, address who, string memory key) internal {
        uint256 before = IERC20(launcher.token()).balanceOf(who);
        vm.startBroadcast(who);
        launcher.claim();
        vm.stopBroadcast();
        uint256 got = IERC20(launcher.token()).balanceOf(who) - before;
        console2.log(who);
        console2.log(got);
        _put(key, vm.toString(got));
    }

    function _refuseRemote() internal view {
        if (vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) {
            string memory rpc = vm.envOr("UNIFORM_RPC_URL", string(""));
            if (!LocalRpc.isLocal(rpc)) {
                console2.log(unicode"拒绝广播：RPC 不是本机");
                revert("remote-broadcast");
            }
        }
    }

    function _need(string memory key) internal view returns (address) {
        string memory raw = vm.readFile(PATH);
        return vm.parseJsonAddress(raw, string.concat(".", key));
    }

    function _put(string memory key, string memory value) internal {
        try vm.readFile(PATH) returns (string memory) {
            vm.writeJson(string.concat('"', value, '"'), PATH, string.concat(".", key));
        } catch {
            vm.writeJson(vm.serializeString("e2e", key, value), PATH);
        }
    }

    function _mine(bytes32 seed) internal pure returns (bytes32 salt) {
        for (uint256 i = 1; i < 500_000; ++i) {
            assembly ("memory-safe") {
                mstore(0x00, seed)
                mstore(0x20, i)
                salt := keccak256(0x00, 0x40)
            }
            if (uint16(uint160(Clones.predictDeterministicAddress(TOKEN_IMPL, salt, PORTAL))) == 0x7777) return salt;
        }
        revert("salt");
    }
}
