// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LibClone} from "solady/utils/LibClone.sol";
import {UpgradeableBeacon} from "solady/utils/UpgradeableBeacon.sol";
import {LauncherFactoryBase} from "src/flap/LauncherFactoryBase.sol";
import {LauncherDataSchema, FieldDescriptor} from "src/flap/IVaultSchemas.sol";
import {IFlapNamePolicy} from "./IFlapNamePolicy.sol";
import {UniformLauncher, LaunchConfig} from "./UniformLauncher.sol";

contract UniformLauncherFactory is LauncherFactoryBase {
    address public immutable beacon;
    address public immutable vaultFactory;
    IFlapNamePolicy public immutable namePolicy;

    event UniformLauncherCreated(address indexed launcher, address indexed creator, bytes32 salt);
    event FlapLauncherImplementationUpgraded(address implementation);

    error ZeroAddress();
    error InvalidNamePolicy();
    error ScamNameOrSymbol();
    error NameScreenUnavailable();

    constructor(address vaultFactory_, address namePolicy_) {
        if (namePolicy_.code.length == 0) revert InvalidNamePolicy();
        vaultFactory = vaultFactory_;
        namePolicy = IFlapNamePolicy(namePolicy_);
        beacon = address(new UpgradeableBeacon(address(this), address(new UniformLauncher())));
    }

    function _newLauncher(address creator, bytes calldata data) internal override returns (address launcher) {
        LaunchConfig memory config = abi.decode(data, (LaunchConfig));
        if (_blocked(config.name) || _blocked(config.symbol)) revert ScamNameOrSymbol();
        launcher = LibClone.deployDeterministicERC1967BeaconProxy(beacon, config.salt);
        UniformLauncher(payable(launcher)).initialize{value: msg.value}(_getHub(), creator, vaultFactory, config);
        emit UniformLauncherCreated(launcher, creator, config.salt);
    }

    function _blocked(string memory value) private view returns (bool) {
        try namePolicy.isScamWord(value) returns (bool blocked) {
            return blocked;
        } catch {
            revert NameScreenUnavailable();
        }
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
        fields[5] = FieldDescriptor("durationBlocks", "uint64", "Auction length in blocks", 0);
        schema.fields = fields;
    }
}
