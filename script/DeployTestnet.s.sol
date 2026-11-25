// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {LibString} from "solady/utils/LibString.sol";
import {UniformLauncherFactory} from "src/uniform/UniformLauncherFactory.sol";
import {UniformVaultFactory} from "src/uniform/UniformVaultFactory.sol";
import {Erc8004Registry} from "src/uniform/Erc8004Registry.sol";
import {Erc8004Source} from "src/uniform/Erc8004Source.sol";

/// @notice 在 BSC 测试网部署 UniformVaultFactory 和 UniformLauncherFactory。
///         私钥只从环境变量 DEPLOYER_PRIVATE_KEY 读取，任何日志都不打印它。
///         不加 --broadcast 时只模拟。代理不要自己加 --broadcast。
contract DeployTestnet is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(key);

        vm.startBroadcast(key);
        uint256 nonce = vm.getNonce(deployer);
        address predictedLauncher = vm.computeCreateAddress(deployer, nonce + 1);
        UniformVaultFactory vaultFactory = new UniformVaultFactory(predictedLauncher);
        UniformLauncherFactory launcherFactory = new UniformLauncherFactory(address(vaultFactory));
        Erc8004Registry erc8004Registry = new Erc8004Registry();
        Erc8004Source erc8004Source = new Erc8004Source(address(erc8004Registry));
        vm.stopBroadcast();

        require(address(launcherFactory) == predictedLauncher, "launcher factory nonce");

        string memory vault = LibString.toHexStringChecksummed(address(vaultFactory));
        string memory launcher = LibString.toHexStringChecksummed(address(launcherFactory));
        string memory who = LibString.toHexStringChecksummed(deployer);
        string memory json = string.concat(
            "{\n",
            '  "chainId": 97,\n',
            '  "deployer": "',
            who,
            '",\n',
            '  "vaultFactory": "',
            vault,
            '",\n',
            '  "launcherFactory": "',
            launcher,
            '",\n',
            '  "erc8004Registry": "',
            LibString.toHexStringChecksummed(address(erc8004Registry)),
            '",\n',
            '  "erc8004Source": "',
            LibString.toHexStringChecksummed(address(erc8004Source)),
            '",\n',
            '  "officialErc8004IdentityRegistry": "0x8004A818BFB912233c491871b3d84c89A494BD9e",\n',
            '  "saltLockFeeWei": "5000000000000000"\n',
            "}\n"
        );
        vm.writeFile("deployments/bsc-testnet.json", json);
        console2.log("vaultFactory", address(vaultFactory));
        console2.log("launcherFactory", address(launcherFactory));
        console2.log("erc8004Registry", address(erc8004Registry));
        console2.log("erc8004Source", address(erc8004Source));
    }
}
