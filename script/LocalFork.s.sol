// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IPortal} from "src/flap/IPortal.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {UniformLauncher, LaunchConfig} from "src/uniform/UniformLauncher.sol";
import {UniformLauncherFactory} from "src/uniform/UniformLauncherFactory.sol";
import {UniformVaultFactory} from "src/uniform/UniformVaultFactory.sol";
import {BinanceAgentIdSource} from "src/uniform/BinanceAgentIdSource.sol";
import {PancakeV2Testnet} from "src/uniform/PancakeV2Testnet.sol";
import {PermissiveAgentDirectory} from "../test/PermissiveAgentDirectory.sol";

interface IDemoRouter {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256, address[] calldata, address, uint256)
        external
        payable;
    function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256, uint256, address[] calldata, address, uint256)
        external;
}

interface IDemoTaxToken {
    function taxProcessor() external view returns (address);
}

interface IDemoTaxProcessor {
    function dispatch() external;
}

interface IProxyAdminLike {
    function owner() external view returns (address);
}

/// @notice 只在本机 anvil 分叉上广播。调用方必须是已解锁地址，不读取私钥。
contract LocalForkScript is Script {
    address internal constant TOKEN_IMPL = 0x7777c57ff7dc441c1715b2e36fa581c48B782222;
    address internal constant PROXY_ADMIN = 0x0000Ed588dfc01749C20bA69b5f8c77d706E0000;
    address internal creator = address(uint160(0xC0DE0001));
    address internal alice = address(uint160(0xC0DE0002));
    address internal bob = address(uint160(0xC0DE0003));

    function run() external {
        (IPortal portal, UniformLauncherFactory launcherFactory, uint256 fee) = _boot();
        UniformLauncher openL = _create(portal, launcherFactory, fee, 1e13, 20_000, "OPEN", bytes32("open"));
        UniformLauncher settleL = _create(portal, launcherFactory, fee, 1e13, 400, "SET", bytes32("settle"));
        UniformLauncher failL = _create(portal, launcherFactory, fee, 1 ether, 400, "FAIL", bytes32("fail"));

        vm.startBroadcast(alice);
        openL.bid{value: 4 ether}(1e16, 0, uint160(alice));
        settleL.bid{value: 20 ether}(1e16, 0, uint160(alice));
        failL.bid{value: 1 ether}(1 ether, 0, uint160(alice));
        vm.stopBroadcast();
        vm.startBroadcast(bob);
        openL.bid{value: 6 ether}(1e16, 0, uint160(bob));
        settleL.bid{value: 20 ether}(1e16, 0, uint160(bob));
        failL.bid{value: 1 ether}(1 ether, 0, uint160(bob));
        vm.stopBroadcast();

        console.log("LAUNCH_OPEN", address(openL));
        console.log("LAUNCH_SETTLE", address(settleL));
        console.log("LAUNCH_FAIL", address(failL));
    }

    /// @notice 造演示六幕要用的三场。结算由外壳脚本推进区块后完成。
    function runScenes() external {
        (IPortal portal, UniformLauncherFactory launcherFactory, uint256 fee) = _boot();
        bytes32 tag = bytes32(block.number);
        UniformLauncher openL = _create(portal, launcherFactory, fee, 1e13, 20_000, "OPEN9", keccak256(abi.encode("open9", tag)));
        uint256[9] memory budgets = [
            uint256(3 ether),
            2.5 ether,
            2.5 ether,
            2 ether,
            1 ether,
            1.5 ether,
            1.2 ether,
            1 ether,
            1 ether
        ];
        uint256[9] memory prices = [uint256(8e13), 5e13, 3e13, 2e13, 2e13, 16e12, 14e12, 12e12, 11e12];
        for (uint256 i; i < 9; ++i) {
            address who = address(uint160(0xC0DE0010 + i));
            vm.startBroadcast(who);
            openL.bid{value: budgets[i]}(prices[i], 0, uint160(who));
            vm.stopBroadcast();
        }
        UniformLauncher doneL = _create(portal, launcherFactory, fee, 1e13, 200, "DONE9", keccak256(abi.encode("done9", tag)));
        vm.startBroadcast(alice);
        // 40 BNB 单笔成交后清算价是 0.00008，入池 40。和演示稿里这一幕看到的数一样。
        doneL.bid{value: 40 ether}(1e16, 0, uint160(alice));
        vm.stopBroadcast();
        UniformLauncher failL = _create(portal, launcherFactory, fee, 4e12, 200, "FAIL3", keccak256(abi.encode("fail3", tag)));
        uint256[3] memory failBudgets = [uint256(1.2 ether), 1 ether, 0.8 ether];
        uint256[3] memory failLimits = [uint256(16e12), 10e12, 7e12];
        for (uint256 i; i < failBudgets.length; ++i) {
            address who = address(uint160(0xC0DE0010 + i));
            vm.startBroadcast(who);
            failL.bid{value: failBudgets[i]}(failLimits[i], 0, uint160(who));
            vm.stopBroadcast();
        }
        (bool matches, uint256 price, uint256 quote) = failL.preview();
        require(matches && price == 6e12 && quote == 3 ether && quote < failL.minPoolQuote(), "failed-scene-book");
        console.log("LAUNCH_OPEN", address(openL));
        console.log("LAUNCH_DONE", address(doneL));
        console.log("LAUNCH_FAIL", address(failL));
        console.log("DONE_END", uint256(doneL.endBlock()));
        console.log("FAIL_END", uint256(failL.endBlock()));
    }

    /// @notice 已发射场上买一次、卖一次，再把税分进金库。不提走。做法和 Tax.s.sol 相同，地址用已解锁的假账户。
    function seedVault(address launcher) external {
        address token = UniformLauncher(payable(launcher)).token();
        if (token == address(0)) revert("no-token");
        (address vault,) = IPortal(LaunchVaultAddresses.hub()).getLaunchVault(token);
        if (vault.balance > 0) {
            console.log("VAULT", vault);
            console.log("VAULT_ACCRUED", vault.balance);
            return;
        }
        address trader = address(uint160(0xC0DE0004));
        address[] memory buyPath = new address[](2);
        buyPath[0] = PancakeV2Testnet.WBNB;
        buyPath[1] = token;
        address[] memory sellPath = new address[](2);
        sellPath[0] = token;
        sellPath[1] = PancakeV2Testnet.WBNB;
        vm.startBroadcast(trader);
        IDemoRouter(PancakeV2Testnet.ROUTER).swapExactETHForTokensSupportingFeeOnTransferTokens{value: 1 ether}(
            0, buyPath, trader, block.timestamp + 600
        );
        uint256 sellAmt = IERC20(token).balanceOf(trader) / 2;
        IERC20(token).approve(PancakeV2Testnet.ROUTER, sellAmt);
        IDemoRouter(PancakeV2Testnet.ROUTER).swapExactTokensForETHSupportingFeeOnTransferTokens(
            sellAmt, 0, sellPath, trader, block.timestamp + 600
        );
        IDemoTaxProcessor(IDemoTaxToken(token).taxProcessor()).dispatch();
        vm.stopBroadcast();
        console.log("VAULT", vault);
        console.log("VAULT_ACCRUED", vault.balance);
        if (vault.balance == 0) revert("vault-still-zero");
    }

    function _boot() internal returns (IPortal portal, UniformLauncherFactory launcherFactory, uint256 fee) {
        portal = IPortal(LaunchVaultAddresses.hub());
        address admin = IProxyAdminLike(PROXY_ADMIN).owner();
        uint256 nonce = vm.getNonce(creator);
        address predicted = vm.computeCreateAddress(creator, nonce + 1);
        vm.startBroadcast(creator);
        UniformVaultFactory vaultFactory = new UniformVaultFactory(predicted);
        launcherFactory = new UniformLauncherFactory(address(vaultFactory));
        vm.stopBroadcast();
        vm.startBroadcast(admin);
        portal.setLauncherFactoryMultiplier(address(launcherFactory), 10_000, true);
        portal.setVaultFactoryMultiplier(address(vaultFactory), 10_000, true);
        vm.stopBroadcast();
        fee = portal.SALT_LOCK_FEE();
        console.log("FACTORY_L", address(launcherFactory));
        console.log("FACTORY_V", address(vaultFactory));
    }

    function _create(
        IPortal portal,
        UniformLauncherFactory factory,
        uint256 fee,
        uint256 floor,
        uint64 duration,
        string memory symbol,
        bytes32 seed
    ) internal returns (UniformLauncher launcher) {
        LaunchConfig memory c;
        c.name = "Tongjia";
        c.symbol = symbol;
        c.meta = "bafkreig4y5nwb4izyilbbmiydumvkld446d4k7j4ohg3x3q2lfel3fo4yq";
        c.salt = _mine(seed, address(portal));
        c.floorPrice = floor;
        c.durationBlocks = duration;
        vm.startBroadcast(creator);
        c.identitySources = new address[](1);
        c.identitySources[0] = address(new BinanceAgentIdSource(address(new PermissiveAgentDirectory())));
        launcher = UniformLauncher(payable(portal.newLauncher{value: fee}(address(factory), abi.encode(c))));
        vm.stopBroadcast();
    }

    function _mine(bytes32 seed, address portal) internal pure returns (bytes32 salt) {
        for (uint256 i = 1; i < 500_000; ++i) {
            assembly ("memory-safe") {
                mstore(0x00, seed)
                mstore(0x20, i)
                salt := keccak256(0x00, 0x40)
            }
            if (uint16(uint160(Clones.predictDeterministicAddress(TOKEN_IMPL, salt, portal))) == 0x7777) return salt;
        }
        revert("salt");
    }
}
