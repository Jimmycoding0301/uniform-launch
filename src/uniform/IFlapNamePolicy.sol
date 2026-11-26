// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IFlapNamePolicy {
    function isScamWord(string calldata name, string calldata symbol)
        external
        view
        returns (bool nameScam, bool symbolScam);
}
