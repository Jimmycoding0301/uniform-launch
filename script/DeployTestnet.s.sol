// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {LibString} from "solady/utils/LibString.sol";
import {UniformLauncherFactory} from "src/uniform/UniformLauncherFactory.sol";
import {IPortal} from "src/flap/IPortal.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {AgentIdentityAddresses} from "src/uniform/AgentIdentityAddresses.sol";
import {BinanceAgentIdSource} from "src/uniform/BinanceAgentIdSource.sol";

/// @notice 按 chainId 部署 MARKETING 版 Launcher Factory 和身份适配器。
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
        UniformLauncherFactory launcherFactory = new UniformLauncherFactory(address(0));

        address agentIdSource = launcherFactory.agentIdSource();
        address erc8004Source = launcherFactory.erc8004Source();
        address agentNft = address(BinanceAgentIdSource(agentIdSource).nft());
        bool standIn = BinanceAgentIdSource(agentIdSource).standIn();

        string memory json = string.concat(
            "{\n",
            '  "chainId": ',
            vm.toString(chainId),
            ",\n",
            '  "deployer": "',
            LibString.toHexStringChecksummed(deployer),
            '",\n',
            '  "vaultFactory": "',
            LibString.toHexStringChecksummed(address(0)),
            '",\n',
            '  "taxRoute": "marketing",\n',
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
            '  "saltLockFeeWei": "',
            vm.toString(IPortal(LaunchVaultAddresses.hub()).SALT_LOCK_FEE()),
            '"\n',
            "}\n"
        );
        string memory out =
            chainId == 56 ? "deployments/bsc-mainnet-release.json" : "deployments/bsc-testnet-release.json";
        vm.writeFile(out, json);
        console2.log("chainId", chainId);
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
