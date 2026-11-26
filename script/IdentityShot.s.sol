// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FixtureNamePolicy} from "../test/FixtureNamePolicy.sol";
import {Script, console} from "forge-std/Script.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IPortal} from "src/flap/IPortal.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {UniformLauncher, LaunchConfig} from "src/uniform/UniformLauncher.sol";
import {UniformLauncherFactory} from "src/uniform/UniformLauncherFactory.sol";
import {UniformVaultFactory} from "src/uniform/UniformVaultFactory.sol";
import {AgentIdStandIn} from "src/uniform/AgentIdStandIn.sol";
import {AgentIdentityAddresses} from "src/uniform/AgentIdentityAddresses.sol";
import {BinanceAgentIdSource} from "src/uniform/BinanceAgentIdSource.sol";
import {Erc8004Source} from "src/uniform/Erc8004Source.sol";

interface IProxyAdminLike {
    function owner() external view returns (address);
}

interface IOfficial8004 {
    function register() external returns (uint256 agentId);
}

/// @notice 只在本机 anvil 上铺一场 9 笔混合身份，和一场 2 笔少量态。不读私钥。
contract IdentityShot is Script {
    address internal constant TOKEN_IMPL = 0x7777c57ff7dc441c1715b2e36fa581c48B782222;
    address internal constant PROXY_ADMIN = 0x0000Ed588dfc01749C20bA69b5f8c77d706E0000;
    address internal creator = address(uint160(0xC0DE0001));

    function run() external {
        IPortal portal = IPortal(LaunchVaultAddresses.hub());
        address admin = IProxyAdminLike(PROXY_ADMIN).owner();
        vm.startBroadcast(creator);
        address namePolicy = address(new FixtureNamePolicy());
        uint256 nonce = vm.getNonce(creator);
        address predicted = vm.computeCreateAddress(creator, nonce + 1);

        UniformVaultFactory vaultFactory = new UniformVaultFactory(predicted);
        UniformLauncherFactory launcherFactory = new UniformLauncherFactory(address(vaultFactory), namePolicy);
        AgentIdStandIn standIn = new AgentIdStandIn();
        BinanceAgentIdSource binance = new BinanceAgentIdSource(address(standIn));
        Erc8004Source erc8004 = new Erc8004Source(AgentIdentityAddresses.ERC8004_TESTNET);
        vm.stopBroadcast();

        vm.startBroadcast(admin);
        portal.setLauncherFactoryMultiplier(address(launcherFactory), 10_000, true);
        portal.setVaultFactoryMultiplier(address(vaultFactory), 10_000, true);
        vm.stopBroadcast();

        uint256 fee = portal.SALT_LOCK_FEE();
        UniformLauncher openL = _create(portal, launcherFactory, fee, binance, erc8004, bytes32("identity-open-9"));
        _nine(openL, standIn);
        UniformLauncher fewL = _create(portal, launcherFactory, fee, binance, erc8004, bytes32("identity-few-2"));
        _few(fewL, standIn);
        console.log("LAUNCH_OPEN", address(openL));
        console.log("LAUNCH_FEW", address(fewL));
        console.log("AGENT_STANDIN", binance.standIn());
    }

    function _nine(UniformLauncher launcher, AgentIdStandIn standIn) internal {
        _agent(launcher, standIn, address(uint160(0xC0DE0002)), 3 ether, 8e13);
        _erc(launcher, address(uint160(0xC0DE0003)), 2.5 ether, 5e13);
        _agent(launcher, standIn, address(uint160(0xC0DE0004)), 2.5 ether, 3e13);
        _erc(launcher, address(uint160(0xC0DE0005)), 2 ether, 2e13);
        _agent(launcher, standIn, address(uint160(0xC0DE0006)), 1 ether, 2e13);
        _erc(launcher, address(uint160(0xC0DE0007)), 1.5 ether, 1.6e13);
        _agent(launcher, standIn, address(uint160(0xC0DE0008)), 1.2 ether, 1.4e13);
        _erc(launcher, address(uint160(0xC0DE0009)), 1 ether, 1.2e13);
        _agent(launcher, standIn, address(uint160(0xC0DE000A)), 1 ether, 1.1e13);
    }

    function _few(UniformLauncher launcher, AgentIdStandIn standIn) internal {
        _agent(launcher, standIn, address(uint160(0xC0DE0002)), 3 ether, 8e13);
        _erc(launcher, address(uint160(0xC0DE0003)), 2 ether, 5e13);
    }

    function _agent(UniformLauncher launcher, AgentIdStandIn standIn, address who, uint256 value, uint256 price)
        internal
    {
        vm.startBroadcast(who);
        standIn.claim();
        launcher.bid{value: value}(price, 0, uint160(who));
        vm.stopBroadcast();
    }

    function _erc(UniformLauncher launcher, address who, uint256 value, uint256 price) internal {
        vm.startBroadcast(who);
        uint256 id = IOfficial8004(AgentIdentityAddresses.ERC8004_TESTNET).register();
        launcher.bid{value: value}(price, 1, id);
        vm.stopBroadcast();
    }

    function _create(
        IPortal portal,
        UniformLauncherFactory factory,
        uint256 fee,
        BinanceAgentIdSource binance,
        Erc8004Source erc8004,
        bytes32 seed
    ) internal returns (UniformLauncher launcher) {
        LaunchConfig memory c;
        c.name = unicode"同价发射";
        c.symbol = "ID";
        c.meta = "bafkreig4y5nwb4izyilbbmiydumvkld446d4k7j4ohg3x3q2lfel3fo4yq";
        c.salt = _mine(seed, address(portal));
        c.floorPrice = 1e13;
        c.durationBlocks = 20_000;
        c.identitySources = new address[](2);
        c.identitySources[0] = address(binance);
        c.identitySources[1] = address(erc8004);
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
