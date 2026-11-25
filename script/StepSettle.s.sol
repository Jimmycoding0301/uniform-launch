// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IPortal} from "src/flap/IPortal.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {UniformLauncher, LaunchConfig} from "src/uniform/UniformLauncher.sol";
import {UniformLauncherFactory} from "src/uniform/UniformLauncherFactory.sol";

contract StepSettleScript is Script {
    address internal constant TOKEN_IMPL = 0x7777c57ff7dc441c1715b2e36fa581c48B782222;
    address internal constant FACTORY = 0xCBDBf5Bee427286e235D465545F801c641ba8ff3;
    address internal creator = address(uint160(0xC0DE0001));
    address internal alice = address(uint160(0xC0DE0002));
    address internal bob = address(uint160(0xC0DE0003));

    function run() external {
        IPortal portal = IPortal(LaunchVaultAddresses.hub());
        uint256 fee = portal.SALT_LOCK_FEE();
        LaunchConfig memory c;
        c.name = "Tongjia";
        c.symbol = "STEP";
        c.meta = "bafkreig4y5nwb4izyilbbmiydumvkld446d4k7j4ohg3x3q2lfel3fo4yq";
        c.salt = _mine(bytes32("step8"), address(portal));
        c.floorPrice = 1e13;
        c.durationBlocks = 200;
        vm.startBroadcast(creator);
        UniformLauncher launcher = UniformLauncher(payable(portal.newLauncher{value: fee}(FACTORY, abi.encode(c))));
        vm.stopBroadcast();
        vm.startBroadcast(alice);
        launcher.bid{value: 20 ether}(8e13);
        vm.stopBroadcast();
        vm.startBroadcast(bob);
        launcher.bid{value: 20 ether}(4e13);
        vm.stopBroadcast();
        console.log("LAUNCH_STEP", address(launcher));
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
