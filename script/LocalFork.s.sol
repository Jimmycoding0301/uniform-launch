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

/// @notice 只在本机 anvil 分叉上广播。调用方必须是已解锁地址，不读取私钥。
contract LocalForkScript is Script {
    address internal constant TOKEN_IMPL = 0x7777c57ff7dc441c1715b2e36fa581c48B782222;
    address internal constant PROXY_ADMIN = 0x0000Ed588dfc01749C20bA69b5f8c77d706E0000;
    address internal creator = address(uint160(0xC0DE0001));
    address internal alice = address(uint160(0xC0DE0002));
    address internal bob = address(uint160(0xC0DE0003));

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

        console.log("FACTORY_L", address(launcherFactory));
        console.log("FACTORY_V", address(vaultFactory));
        console.log("LAUNCH_OPEN", address(openL));
        console.log("LAUNCH_SETTLE", address(settleL));
        console.log("LAUNCH_FAIL", address(failL));
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
