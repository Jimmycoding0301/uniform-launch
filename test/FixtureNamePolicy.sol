// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IFlapNamePolicy} from "src/uniform/IFlapNamePolicy.sol";
import {UniformLauncherFactory} from "src/uniform/UniformLauncherFactory.sol";

/// @dev Offline word list. Live fork tests call the real Flap module.
contract FixtureNamePolicy is IFlapNamePolicy {
    bool public unavailable;

    function setUnavailable(bool value) external {
        unavailable = value;
    }

    function isScamWord(string calldata name, string calldata symbol) external view returns (bool, bool) {
        require(!unavailable, "fixture unavailable");
        bytes32 blocked = keccak256("BLOCKED");
        return (keccak256(bytes(name)) == blocked, keccak256(bytes(symbol)) == blocked);
    }
}

/// @dev Test-only factory for synthetic bidders. Release and authorization tests deploy the base factory.
contract FixtureLauncherFactory is UniformLauncherFactory {
    constructor(address vaultFactory_) UniformLauncherFactory(vaultFactory_) {}

    function _allowedIdentitySource(address source) internal view override returns (bool) {
        return source.code.length > 0;
    }
}
