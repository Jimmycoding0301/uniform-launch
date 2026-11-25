// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IPortal} from "src/flap/IPortal.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {UniformLauncher, LaunchConfig} from "src/uniform/UniformLauncher.sol";
import {UniformLauncherFactory} from "src/uniform/UniformLauncherFactory.sol";
import {UniformVaultFactory} from "src/uniform/UniformVaultFactory.sol";
import {BinanceAgentIdSource, IBinanceAgentDirectory} from "src/uniform/BinanceAgentIdSource.sol";
import {Erc8004Registry} from "src/uniform/Erc8004Registry.sol";
import {Erc8004Source} from "src/uniform/Erc8004Source.sol";

interface IProxyAdminLike {
    function owner() external view returns (address);
}

contract ShotDirectory is IBinanceAgentDirectory {
    mapping(address => uint256) public ids;

    function set(address wallet, uint256 id) external {
        ids[wallet] = id;
    }

    function agentIdOf(address wallet) external view returns (uint256) {
        return ids[wallet];
    }
}

/// @notice 只在本机 anvil 上铺一场带两种身份的拍卖，用来截图。不读私钥。
contract IdentityShot is Script {
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
        ShotDirectory directory = new ShotDirectory();
        directory.set(alice, 42);
        BinanceAgentIdSource binance = new BinanceAgentIdSource(address(directory));
        Erc8004Registry registry = new Erc8004Registry();
        Erc8004Source erc8004 = new Erc8004Source(address(registry));
        vm.stopBroadcast();

        vm.startBroadcast(admin);
        portal.setLauncherFactoryMultiplier(address(launcherFactory), 10_000, true);
        portal.setVaultFactoryMultiplier(address(vaultFactory), 10_000, true);
        vm.stopBroadcast();

        uint256 fee = portal.SALT_LOCK_FEE();
        LaunchConfig memory c;
        c.name = unicode"同价发射";
        c.symbol = "ID";
        c.meta = "bafkreig4y5nwb4izyilbbmiydumvkld446d4k7j4ohg3x3q2lfel3fo4yq";
        c.salt = _mine(bytes32("identity-shot-1"), address(portal));
        c.floorPrice = 1e13;
        c.durationBlocks = 20_000;
        c.identitySources = new address[](2);
        c.identitySources[0] = address(binance);
        c.identitySources[1] = address(erc8004);

        vm.startBroadcast(creator);
        UniformLauncher launcher =
            UniformLauncher(payable(portal.newLauncher{value: fee}(address(launcherFactory), abi.encode(c))));
        vm.stopBroadcast();

        vm.startBroadcast(bob);
        registry.register();
        vm.stopBroadcast();

        vm.startBroadcast(alice);
        launcher.bid{value: 3 ether}(8e13);
        vm.stopBroadcast();
        vm.startBroadcast(bob);
        launcher.bid{value: 2 ether}(5e13);
        vm.stopBroadcast();
        console.log("LAUNCH_IDENTITY", address(launcher));
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
