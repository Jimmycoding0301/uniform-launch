// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice 只有指向本机的 RPC 才允许广播。
library LocalRpc {
    function isLocal(string memory rpc) internal pure returns (bool) {
        return _has(rpc, "127.0.0.1") || _has(rpc, "localhost");
    }

    function _has(string memory hay, string memory needle) private pure returns (bool) {
        bytes memory h = bytes(hay);
        bytes memory n = bytes(needle);
        if (n.length == 0 || n.length > h.length) return false;
        for (uint256 i; i + n.length <= h.length; ++i) {
            bool ok = true;
            for (uint256 j; j < n.length; ++j) {
                if (h[i + j] != n[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return true;
        }
        return false;
    }
}
