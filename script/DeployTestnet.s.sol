// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {LibString} from "solady/utils/LibString.sol";
import {UniformLauncherFactory} from "src/uniform/UniformLauncherFactory.sol";
import {UniformVaultFactory} from "src/uniform/UniformVaultFactory.sol";
import {AgentIdentityAddresses} from "src/uniform/AgentIdentityAddresses.sol";
import {AgentIdStandIn} from "src/uniform/AgentIdStandIn.sol";
import {BinanceAgentIdSource} from "src/uniform/BinanceAgentIdSource.sol";
import {Erc8004Source} from "src/uniform/Erc8004Source.sol";

/// @notice 按 chainId 部署两个工厂和身份适配器。
///         56：Agent ID 与 ERC-8004 都指向官方合约。
///         97：ERC-8004 指向官方 Identity Registry。Agent ID 真合约不在这条链上时，部署只含 balanceOf 的替身。
///         私钥只从环境变量 DEPLOYER_PRIVATE_KEY 读取，任何日志都不打印它。
///         不加 --broadcast 时只模拟。代理不要自己加 --broadcast。
contract DeployTestnet is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(key);
        uint256 chainId = block.chainid;
        address erc8004Registry = _erc8004(chainId);
        if (chainId == 56) {
            require(AgentIdentityAddresses.AGENT_ID_MAINNET.code.length > 0, "agent id");
            require(erc8004Registry.code.length > 0, "8004");
        } else {
            require(erc8004Registry.code.length > 0, "8004");
        }

        vm.startBroadcast(key);
        uint256 nonce = vm.getNonce(deployer);
        address predictedLauncher = vm.computeCreateAddress(deployer, nonce + 1);
        UniformVaultFactory vaultFactory = new UniformVaultFactory(predictedLauncher);
        UniformLauncherFactory launcherFactory = new UniformLauncherFactory(address(vaultFactory));

        address agentNft;
        bool standIn;
        if (chainId == 56) {
            agentNft = AgentIdentityAddresses.AGENT_ID_MAINNET;
            standIn = false;
        } else if (AgentIdentityAddresses.AGENT_ID_MAINNET.code.length > 0) {
            agentNft = AgentIdentityAddresses.AGENT_ID_MAINNET;
            standIn = false;
        } else {
            agentNft = address(new AgentIdStandIn());
            standIn = true;
        }
        BinanceAgentIdSource agentIdSource = new BinanceAgentIdSource(agentNft);
        Erc8004Source erc8004Source = new Erc8004Source(erc8004Registry);
        vm.stopBroadcast();

        require(address(launcherFactory) == predictedLauncher, "launcher factory nonce");
        require(agentIdSource.standIn() == standIn, "stand-in flag");
        require(address(erc8004Source.registry()) == erc8004Registry, "8004 registry");

        string memory json = string.concat(
            "{\n",
            '  "chainId": ',
            vm.toString(chainId),
            ",\n",
            '  "deployer": "',
            LibString.toHexStringChecksummed(deployer),
            '",\n',
            '  "vaultFactory": "',
            LibString.toHexStringChecksummed(address(vaultFactory)),
            '",\n',
            '  "launcherFactory": "',
            LibString.toHexStringChecksummed(address(launcherFactory)),
            '",\n',
            '  "agentIdNft": "',
            LibString.toHexStringChecksummed(agentNft),
            '",\n',
            '  "agentIdStandIn": ',
            standIn ? "true" : "false",
            ",\n",
            '  "agentIdSource": "',
            LibString.toHexStringChecksummed(address(agentIdSource)),
            '",\n',
            '  "erc8004Registry": "',
            LibString.toHexStringChecksummed(erc8004Registry),
            '",\n',
            '  "erc8004Source": "',
            LibString.toHexStringChecksummed(address(erc8004Source)),
            '",\n',
            '  "saltLockFeeWei": "5000000000000000"\n',
            "}\n"
        );
        string memory out = chainId == 56 ? "deployments/bsc-mainnet.json" : "deployments/bsc-testnet.json";
        vm.writeFile(out, json);
        console2.log("chainId", chainId);
        console2.log("vaultFactory", address(vaultFactory));
        console2.log("launcherFactory", address(launcherFactory));
        console2.log("agentIdNft", agentNft);
        console2.log("agentIdStandIn", standIn);
        console2.log("agentIdSource", address(agentIdSource));
        console2.log("erc8004Registry", erc8004Registry);
        console2.log("erc8004Source", address(erc8004Source));
    }

    function _erc8004(uint256 chainId) internal pure returns (address) {
        if (chainId == 56) return AgentIdentityAddresses.ERC8004_MAINNET;
        if (chainId == 97) return AgentIdentityAddresses.ERC8004_TESTNET;
        revert("chain");
    }
}
