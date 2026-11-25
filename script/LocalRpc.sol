// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice 只有主机名正好是 127.0.0.1 或 localhost 才允许广播。
library LocalRpc {
    function isLocal(string memory rpc) internal pure returns (bool) {
        bytes memory h = bytes(rpc);
        uint256 start;
        for (uint256 i; i + 2 < h.length; ++i) {
            if (h[i] == ":" && h[i + 1] == "/" && h[i + 2] == "/") {
                start = i + 3;
                break;
            }
        }
        uint256 end = h.length;
        for (uint256 i = start; i < h.length; ++i) {
            if (h[i] == "/" || h[i] == "?" || h[i] == "#") {
                end = i;
                break;
            }
        }
        for (uint256 i = start; i < end; ++i) {
            if (h[i] == "@") start = i + 1;
        }
        uint256 hostEnd = end;
        for (uint256 i = start; i < end; ++i) {
            if (h[i] == ":") {
                hostEnd = i;
                break;
            }
        }
        return _eq(h, start, hostEnd, "127.0.0.1") || _eqFold(h, start, hostEnd, "localhost");
    }

    function _eq(bytes memory h, uint256 start, uint256 end, string memory needle) private pure returns (bool) {
        bytes memory n = bytes(needle);
        if (end < start || end - start != n.length) return false;
        for (uint256 i; i < n.length; ++i) {
            if (h[start + i] != n[i]) return false;
        }
        return true;
    }

    function _eqFold(bytes memory h, uint256 start, uint256 end, string memory needle) private pure returns (bool) {
        bytes memory n = bytes(needle);
        if (end < start || end - start != n.length) return false;
        for (uint256 i; i < n.length; ++i) {
            bytes1 c = h[start + i];
            if (c >= 0x41 && c <= 0x5A) c = bytes1(uint8(c) + 32);
            if (c != n[i]) return false;
        }
        return true;
    }
}
