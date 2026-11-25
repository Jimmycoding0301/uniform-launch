// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IPortal} from "src/flap/IPortal.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {UniformLauncher, LaunchConfig} from "src/uniform/UniformLauncher.sol";
import {UniformLauncherFactory} from "src/uniform/UniformLauncherFactory.sol";
import {UniformVaultFactory} from "src/uniform/UniformVaultFactory.sol";

interface IProxyAdminLike {
    function owner() external view returns (address);
}

/// @notice 只在本机 anvil 上铺三场演示：接单中、失败、待录屏。不读私钥。
contract DeskScript is Script {
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
        string memory kind = vm.envOr("DESK_KIND", string("fail"));
        if (keccak256(bytes(kind)) == keccak256("fail")) {
            UniformLauncher failL = _create(portal, launcherFactory, fee, 1e14, 200, "FAIL", bytes32("desk-fail-4"));
            _ladder(failL, true);
            console.log("LAUNCH_FAIL", address(failL));
            console.log("FAIL_END", failL.endBlock());
            console.log("FAIL_CAP", failL.softCap());
            return;
        }

        if (keccak256(bytes(kind)) == keccak256("clip")) {
            UniformLauncher clipL = _create(portal, launcherFactory, fee, 1e13, 400, "CLIP", bytes32("desk-clip-6"));
            _clip(clipL);
            (bool ok, uint256 price, uint256 quote) = clipL.preview();
            console.log("CLIP_OK", ok);
            console.log("CLIP_PRICE", price);
            console.log("CLIP_QUOTE", quote);
            console.log("LAUNCH_CLIP", address(clipL));
            console.log("CLIP_END", clipL.endBlock());
            return;
        }

        UniformLauncher openL = _create(portal, launcherFactory, fee, 1e13, 20_000, "OPEN", bytes32("desk-open-4"));
        _ladder(openL, false);
        UniformLauncher liveL = _create(portal, launcherFactory, fee, 1e13, 500, "LIVE", bytes32("desk-live-4"));
        _ladder(liveL, false);
        (bool ok, uint256 price, uint256 quote) = openL.preview();
        console.log("OPEN_OK", ok);
        console.log("OPEN_PRICE", price);
        console.log("OPEN_QUOTE", quote);
        console.log("LAUNCH_OPEN", address(openL));
        console.log("LAUNCH_LIVE", address(liveL));
        console.log("LIVE_END", liveL.endBlock());
    }

    function _clip(UniformLauncher launcher) internal {
        _bid(launcher, address(uint160(0xC0DE000A)), 20 ether, 1.2e14);
        _bid(launcher, address(uint160(0xC0DE000B)), 17 ether, 1.2e14);
        _bid(launcher, address(uint160(0xC0DE0002)), 3 ether, 8e13);
        _bid(launcher, address(uint160(0xC0DE0003)), 2.5 ether, 5e13);
        _bid(launcher, address(uint160(0xC0DE0004)), 2.5 ether, 3e13);
        _bid(launcher, address(uint160(0xC0DE0005)), 2 ether, 2e13);
        _bid(launcher, address(uint160(0xC0DE0007)), 1.5 ether, 1.6e13);
        _bid(launcher, address(uint160(0xC0DE0008)), 1 ether, 1.2e13);
    }

    function _ladder(UniformLauncher launcher, bool failedShape) internal {
        if (failedShape) {
            _bid(launcher, address(uint160(0xC0DE0002)), 0.8 ether, 8e14);
            _bid(launcher, address(uint160(0xC0DE0003)), 0.7 ether, 5e14);
            _bid(launcher, address(uint160(0xC0DE0004)), 0.5 ether, 3e14);
            _bid(launcher, address(uint160(0xC0DE0005)), 0.4 ether, 2e14);
            _bid(launcher, address(uint160(0xC0DE0007)), 0.3 ether, 1.5e14);
            _bid(launcher, address(uint160(0xC0DE0008)), 0.3 ether, 1.2e14);
            return;
        }
        _bid(launcher, address(uint160(0xC0DE0002)), 3 ether, 8e13);
        _bid(launcher, address(uint160(0xC0DE0003)), 2.5 ether, 5e13);
        _bid(launcher, address(uint160(0xC0DE0004)), 2.5 ether, 3e13);
        _bid(launcher, address(uint160(0xC0DE0005)), 2 ether, 2e13);
        _bid(launcher, address(uint160(0xC0DE0006)), 1 ether, 2e13);
        _bid(launcher, address(uint160(0xC0DE0007)), 1.5 ether, 1.6e13);
        _bid(launcher, address(uint160(0xC0DE0008)), 1.2 ether, 1.4e13);
        _bid(launcher, address(uint160(0xC0DE0009)), 1 ether, 1.2e13);
    }

    function _bid(UniformLauncher launcher, address who, uint256 value, uint256 price) internal {
        vm.startBroadcast(who);
        launcher.bid{value: value}(price);
        vm.stopBroadcast();
    }

    function _refund(UniformLauncher launcher, address who) internal {
        vm.startBroadcast(who);
        launcher.refund();
        vm.stopBroadcast();
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
        c.name = unicode"同价发射";
        c.symbol = symbol;
        c.meta = "bafkreig4y5nwb4izyilbbmiydumvkld446d4k7j4ohg3x3q2lfel3fo4yq";
        c.salt = _mine(seed, address(portal));
        c.floorPrice = floor;
        c.durationBlocks = duration;
        vm.startBroadcast(creator);
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
