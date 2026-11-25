// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LibClone} from "solady/utils/LibClone.sol";
import {UpgradeableBeacon} from "solady/utils/UpgradeableBeacon.sol";
import {DirectLaunchVaultFactoryBase} from "src/flap/DirectLaunchVaultFactoryBase.sol";
import {IPortal, IPortalTypes} from "src/flap/IPortal.sol";
import {Distribution} from "src/flap/Distribution.sol";
import {VaultDataSchema, FieldDescriptor, FactoryPolicy} from "src/flap/IVaultSchemas.sol";
import {UniformVault} from "./UniformVault.sol";

interface IUniformLauncherView {
    function creator() external view returns (address);
    function launching() external view returns (bool);
}

contract UniformVaultFactory is DirectLaunchVaultFactoryBase {
    address public immutable beacon;
    address public immutable launcherFactory;

    uint16 public constant VAULT_SLOT_BPS = 10_000;

    error NotFromLauncherFactory(address launcher);
    error VaultDataLauncherMismatch(address expected, address got);
    error VaultSlotBpsMismatch(uint16 got, uint16 expected);
    error LauncherNotLaunching(address launcher);

    event FlapVaultImplementationUpgraded(address implementation);
    event UniformVaultCreated(address indexed vault, address indexed token, address indexed launcher);

    constructor(address launcherFactory_) {
        if (launcherFactory_ == address(0)) revert ZeroAddress();
        launcherFactory = launcherFactory_;
        beacon = address(new UpgradeableBeacon(address(this), address(new UniformVault())));
    }

    function newVault(address token, address creator, uint8 launchKind, bytes calldata launchParams)
        external
        override
        onlyHub
        returns (address vault)
    {
        (IPortalTypes.CreateTaxTokenParams memory p, Distribution memory d, bytes memory vaultData) =
            _validateLaunch(token, creator, launchKind, launchParams);
        _requireNoReserveDistribution(d);

        if (IPortal(_getHub()).getLauncher(creator).launcherFactory != launcherFactory) {
            revert NotFromLauncherFactory(creator);
        }
        if (vaultData.length != 32) revert InvalidVaultData();
        address named = abi.decode(vaultData, (address));
        if (named != creator) revert VaultDataLauncherMismatch(creator, named);

        uint16 slotBps = _slotBps(p.feeConfigs);
        if (slotBps != VAULT_SLOT_BPS) revert VaultSlotBpsMismatch(slotBps, VAULT_SLOT_BPS);

        IUniformLauncherView launcher = IUniformLauncherView(creator);
        if (!launcher.launching()) revert LauncherNotLaunching(creator);

        vault = LibClone.deployDeterministicERC1967BeaconProxy(beacon, bytes32(uint256(uint160(token))));
        UniformVault(payable(vault)).initialize(token, creator, launcher.creator());
        emit UniformVaultCreated(vault, token, creator);
    }

    function _slotBps(IPortalTypes.FeeConfig[] memory fees) internal view returns (uint16) {
        for (uint256 i; i < fees.length; ++i) {
            if (fees[i].feeType != IPortalTypes.FeeSlotType.VAULT) continue;
            IPortalTypes.FeeConfigVault memory v = abi.decode(fees[i].configData, (IPortalTypes.FeeConfigVault));
            if (v.vaultFactory == address(this)) return fees[i].bps;
        }
        return 0;
    }

    function vaultDataSchema() public pure override returns (VaultDataSchema memory schema) {
        schema.description =
        "Uniform vault. vaultData is the launching Launcher address. Tax is withdrawable by its creator.";
        schema.fields = new FieldDescriptor[](1);
        schema.fields[0] = FieldDescriptor("launcher", "address", "Launcher that is launching", 0);
    }

    function isQuoteTokenSupported(address quoteToken) public pure override returns (bool) {
        return quoteToken == address(0);
    }

    function factorySpecVersion() public pure override returns (string memory) {
        return "pl-v1";
    }

    function tokenCreationPolicies() public view override returns (FactoryPolicy[] memory policies) {}

    function upgradeVaultImplementation(address newImplementation) external override onlyGuardian {
        if (newImplementation == address(0)) revert ZeroAddress();
        UpgradeableBeacon(beacon).upgradeTo(newImplementation);
        emit FlapVaultImplementationUpgraded(newImplementation);
    }
}
