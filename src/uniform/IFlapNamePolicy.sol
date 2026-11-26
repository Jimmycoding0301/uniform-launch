// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Adapter for the Flap-approved name screening service, configured per deployment.
interface IFlapNamePolicy {
    function isScamWord(string calldata value) external view returns (bool);
}
