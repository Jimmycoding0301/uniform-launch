// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LibClone} from "solady/utils/LibClone.sol";
import {UpgradeableBeacon} from "solady/utils/UpgradeableBeacon.sol";
import {LauncherFactoryBase} from "src/flap/LauncherFactoryBase.sol";
import {LauncherDataSchema, FieldDescriptor} from "src/flap/IVaultSchemas.sol";
import {IPortal} from "src/flap/IPortal.sol";
import {AgentIdentityAddresses} from "./AgentIdentityAddresses.sol";
import {BinanceAgentIdSource} from "./BinanceAgentIdSource.sol";
import {Erc8004Source} from "./Erc8004Source.sol";
import {UniformLauncher, LaunchConfig} from "./UniformLauncher.sol";

contract UniformLauncherFactory is LauncherFactoryBase {
    address public immutable beacon;
    address public immutable vaultFactory;
    address public immutable agentIdSource;
    address public immutable erc8004Source;

    event UniformLauncherCreated(address indexed launcher, address indexed creator, bytes32 salt);
    event FlapLauncherImplementationUpgraded(address implementation);

    error ZeroAddress();
    error InvalidIdentitySource(address source);
    error UnrecognizedLauncher(address candidate);
    error UnsupportedChain();

    constructor(address vaultFactory_) {
        uint256 chain = block.chainid;
        if (chain != 56 && chain != 97) revert UnsupportedChain();
        vaultFactory = vaultFactory_;
        agentIdSource = address(
            new BinanceAgentIdSource(
                chain == 56 ? AgentIdentityAddresses.AGENT_ID_MAINNET : AgentIdentityAddresses.AGENT_ID_TESTNET_STAND_IN
            )
        );
        erc8004Source = chain == 97 ? address(new Erc8004Source(AgentIdentityAddresses.ERC8004_TESTNET)) : address(0);
        beacon = address(new UpgradeableBeacon(address(this), address(new UniformLauncher())));
    }

    /// @notice Resolve a Launcher for Flap's Mini App from its Portal registration.
    function resolveLauncher(address candidate) external view returns (address) {
        if (candidate.code.length == 0 || IPortal(_getHub()).getLauncher(candidate).launcherFactory != address(this)) {
            revert UnrecognizedLauncher(candidate);
        }
        return candidate;
    }

    function _newLauncher(address creator, bytes calldata data) internal override returns (address launcher) {
        LaunchConfig memory config = abi.decode(data, (LaunchConfig));
        for (uint256 i; i < config.identitySources.length; ++i) {
            address source = config.identitySources[i];
            if (!_allowedIdentitySource(source)) revert InvalidIdentitySource(source);
        }
        launcher = LibClone.deployDeterministicERC1967BeaconProxy(beacon, config.salt);
        UniformLauncher(payable(launcher)).initialize{value: msg.value}(_getHub(), creator, vaultFactory, config);
        emit UniformLauncherCreated(launcher, creator, config.salt);
    }

    function _allowedIdentitySource(address source) internal view virtual returns (bool) {
        return source != address(0) && (source == agentIdSource || source == erc8004Source);
    }

    function upgradeVaultImplementation(address newImplementation) external override onlyGuardian {
        if (newImplementation == address(0)) revert ZeroAddress();
        UpgradeableBeacon(beacon).upgradeTo(newImplementation);
        emit FlapLauncherImplementationUpgraded(newImplementation);
    }

    function launcherDataSchema() external pure override returns (LauncherDataSchema memory schema) {
        schema.description =
            "Uniform-price batch auction. Half the supply sells at one clearing price and half seeds the pool with the BNB taken. Below the reserve price, bids are refunded.";
        schema.isArray = false;
        FieldDescriptor[] memory fields = new FieldDescriptor[](6);
        fields[0] = FieldDescriptor("name", "string", "Token name", 0);
        fields[1] = FieldDescriptor("symbol", "string", "Token symbol", 0);
        fields[2] = FieldDescriptor("meta", "string", "Metadata URI", 0);
        fields[3] = FieldDescriptor("salt", "bytes32", "CREATE2 salt ending in 0x7777", 0);
        fields[4] = FieldDescriptor("floorPrice", "uint256", "Reserve price, quote wei per token", 18);
        fields[5] = FieldDescriptor(
            "durationBlocks", "uint64", "Blocks. 200-20000 is about 90 seconds to 2.5 hours at 0.45 s/block.", 0
        );
        schema.fields = fields;
    }
}
