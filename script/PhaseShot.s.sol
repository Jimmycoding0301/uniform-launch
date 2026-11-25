// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IPortal} from "src/flap/IPortal.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {UniformLauncher, LaunchConfig} from "src/uniform/UniformLauncher.sol";
import {UniformLauncherFactory} from "src/uniform/UniformLauncherFactory.sol";
import {UniformVaultFactory} from "src/uniform/UniformVaultFactory.sol";
import {BinanceAgentIdSource} from "src/uniform/BinanceAgentIdSource.sol";
import {PermissiveAgentDirectory} from "../test/PermissiveAgentDirectory.sol";

interface IProxyAdminLike {
    function owner() external view returns (address);
}

/// @notice 只在本机 anvil 分叉上广播。造出截单、待结算、已开始但零出价、以及 32 笔满额。
///         合约把开始区块写成部署时的区块，所以这里造不出「还没开始」。
contract PhaseShotScript is Script {
    address internal constant TOKEN_IMPL = 0x7777c57ff7dc441c1715b2e36fa581c48B782222;
    address internal constant PROXY_ADMIN = 0x0000Ed588dfc01749C20bA69b5f8c77d706E0000;
    address internal creator = address(uint160(0xC0DE0001));

    function run() external {
        IPortal portal = IPortal(LaunchVaultAddresses.hub());
        address admin = IProxyAdminLike(PROXY_ADMIN).owner();
        uint256 nonce = vm.getNonce(creator);
        address predicted = vm.computeCreateAddress(creator, nonce + 1);

        vm.startBroadcast(creator);
        UniformVaultFactory vaultFactory = new UniformVaultFactory(predicted);
        UniformLauncherFactory launcherFactory = new UniformLauncherFactory(address(vaultFactory));
        vm.stopBroadcast();

        vm.startBroadcast(admin);
        portal.setLauncherFactoryMultiplier(address(launcherFactory), 10_000, true);
        portal.setVaultFactoryMultiplier(address(vaultFactory), 10_000, true);
        vm.stopBroadcast();

        uint256 fee = portal.SALT_LOCK_FEE();
        UniformLauncher emptyL = _create(portal, launcherFactory, fee, 8_000, "EMPTY", bytes32("empty"));
        UniformLauncher fullL = _create(portal, launcherFactory, fee, 8_000, "FULL", bytes32("full"));
        UniformLauncher readyL = _create(portal, launcherFactory, fee, 200, "READY", bytes32("ready"));
        UniformLauncher closedL = _create(portal, launcherFactory, fee, 230, "CLOSED", bytes32("closed"));

        for (uint256 i = 1; i <= 32; ++i) {
            address who = address(uint160(0xC0DE1000) + uint160(i));
            uint256 price = 1e14 - (i - 1) * 2e12;
            if (price < 1e13) price = 1e13;
            vm.startBroadcast(who);
            fullL.bid{value: 0.05 ether}(price, 0, uint160(who));
            vm.stopBroadcast();
        }

        address bidder = address(uint160(0xC0DE2001));
        vm.startBroadcast(bidder);
        readyL.bid{value: 1 ether}(2e13, 0, uint160(bidder));
        closedL.bid{value: 1 ether}(3e13, 0, uint160(bidder));
        vm.stopBroadcast();
        address bidder2 = address(uint160(0xC0DE2002));
        vm.startBroadcast(bidder2);
        readyL.bid{value: 2 ether}(5e13, 0, uint160(bidder2));
        closedL.bid{value: 2 ether}(4e13, 0, uint160(bidder2));
        vm.stopBroadcast();

        console.log("PHASE_EMPTY", address(emptyL));
        console.log("PHASE_FULL", address(fullL));
        console.log("PHASE_READY", address(readyL));
        console.log("PHASE_READY_END", readyL.endBlock());
        console.log("PHASE_CLOSED", address(closedL));
        console.log("PHASE_CLOSED_END", closedL.endBlock());
    }

    function _create(
        IPortal portal,
        UniformLauncherFactory factory,
        uint256 fee,
        uint64 duration,
        string memory symbol,
        bytes32 seed
    ) internal returns (UniformLauncher launcher) {
        LaunchConfig memory c;
        c.name = "Tongjia";
        c.symbol = symbol;
        c.meta = "bafkreig4y5nwb4izyilbbmiydumvkld446d4k7j4ohg3x3q2lfel3fo4yq";
        c.salt = _mine(seed, address(portal));
        c.floorPrice = 1e13;
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
