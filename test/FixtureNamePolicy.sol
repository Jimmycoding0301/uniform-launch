// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IFlapNamePolicy} from "src/uniform/IFlapNamePolicy.sol";

/// @dev Used only by test harnesses and local fork demos.
contract FixtureNamePolicy is IFlapNamePolicy {
    bool public unavailable;

    function setUnavailable(bool value) external {
        unavailable = value;
    }

    function isScamWord(string calldata value) external view returns (bool) {
        require(!unavailable, "fixture unavailable");
        return keccak256(bytes(value)) == keccak256("BLOCKED");
    }
}
