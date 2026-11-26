// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice 单次统一价格清算。价格单位是每 1e18 代币 wei 需要多少报价 wei。
///         全额前缀与边际卡价取较高清算价；价格相同保留全额前缀。
///         代币数量向下取整，实付向上取整，退款是预算减去实付。除不尽的代币留在调用方，不送给某一笔出价。
library UniformSettle {
    struct Bid {
        uint256 index;
        uint256 budget;
        uint256 maxPrice;
    }

    struct Fill {
        uint256 index;
        uint256 spend;
        uint256 tokens;
        uint256 refundQuote;
    }

    struct Outcome {
        bool ok;
        uint256 clearingPrice;
        uint256 poolQuote;
        Fill[] fills;
    }

    uint256 internal constant WAD = 1e18;

    error ZeroSupply();

    function settle(uint256 sellAmount, uint256 floorPrice, Bid[] memory bids)
        internal
        pure
        returns (Outcome memory o)
    {
        if (sellAmount == 0) revert ZeroSupply();
        uint256 n = bids.length;
        o.fills = new Fill[](n);
        for (uint256 i; i < n; ++i) {
            o.fills[i].index = bids[i].index;
            o.fills[i].refundQuote = bids[i].budget;
        }
        if (n == 0 || floorPrice == 0) return o;

        uint256[] memory order = new uint256[](n);
        uint256 m;
        for (uint256 i; i < n; ++i) {
            if (bids[i].maxPrice < floorPrice || bids[i].budget == 0) continue;
            order[m++] = i;
        }
        if (m == 0) return o;
        _sort(bids, order, m);

        uint8 kind;
        uint256 winK;
        uint256 pinPrice;
        uint256 bestP;

        uint256 cum;
        for (uint256 k = 1; k <= m; ++k) {
            cum += bids[order[k - 1]].budget;
            uint256 mMin = bids[order[k - 1]].maxPrice;
            uint256 p = cum * WAD / sellAmount;
            if (p >= floorPrice && p <= mMin && p > bestP) {
                bestP = p;
                kind = 1;
                winK = k;
            }
        }

        for (uint256 i; i < m; ++i) {
            uint256 price = bids[order[i]].maxPrice;
            if (i > 0 && price == bids[order[i - 1]].maxPrice) continue;
            (bool feasible, uint256 infraTokens) = _pinFeasible(bids, order, m, sellAmount, price);
            if (!feasible) continue;
            if (price > bestP) {
                bestP = price;
                kind = 2;
                pinPrice = price;
                winK = infraTokens;
            }
        }

        if (kind == 0) return o;
        o.ok = true;
        o.clearingPrice = bestP;
        if (kind == 1) _fillPrefix(o, bids, order, winK, sellAmount);
        else _fillPin(o, bids, order, m, sellAmount, pinPrice);
    }

    function _pinFeasible(Bid[] memory bids, uint256[] memory order, uint256 m, uint256 sellAmount, uint256 price)
        private
        pure
        returns (bool feasible, uint256 infraTokens)
    {
        uint256 marginalBudget;
        for (uint256 i; i < m; ++i) {
            Bid memory b = bids[order[i]];
            if (b.maxPrice > price) {
                infraTokens += b.budget * WAD / price;
            } else if (b.maxPrice == price) {
                marginalBudget += b.budget;
            }
        }
        if (infraTokens >= sellAmount) return (false, 0);
        uint256 remaining = sellAmount - infraTokens;
        uint256 cost = remaining * price / WAD;
        if (marginalBudget < cost || marginalBudget == 0) return (false, 0);
        return (true, infraTokens);
    }

    function _fillPrefix(Outcome memory o, Bid[] memory bids, uint256[] memory order, uint256 k, uint256 sellAmount)
        private
        pure
    {
        uint256 budgetSum;
        for (uint256 i; i < k; ++i) {
            budgetSum += bids[order[i]].budget;
        }
        for (uint256 i; i < k; ++i) {
            uint256 pos = order[i];
            o.fills[pos].tokens = bids[pos].budget * sellAmount / budgetSum;
            o.fills[pos].spend = bids[pos].budget;
            o.fills[pos].refundQuote = 0;
        }
        o.poolQuote = budgetSum;
    }

    function _fillPin(
        Outcome memory o,
        Bid[] memory bids,
        uint256[] memory order,
        uint256 m,
        uint256 sellAmount,
        uint256 price
    ) private pure {
        uint256 infraTokens;
        uint256 marginalBudget;
        for (uint256 i; i < m; ++i) {
            Bid memory b = bids[order[i]];
            if (b.maxPrice > price) infraTokens += b.budget * WAD / price;
            else if (b.maxPrice == price) marginalBudget += b.budget;
        }
        uint256 remaining = sellAmount - infraTokens;
        uint256 spent;
        for (uint256 i; i < m; ++i) {
            uint256 pos = order[i];
            Bid memory b = bids[pos];
            uint256 tokens;
            if (b.maxPrice > price) {
                tokens = b.budget * WAD / price;
            } else if (b.maxPrice == price) {
                tokens = remaining * b.budget / marginalBudget;
            } else {
                continue;
            }
            uint256 spend = _charge(tokens, price, b.budget);
            if (spend == b.budget && tokens > b.budget * WAD / price) {
                tokens = b.budget * WAD / price;
                spend = _charge(tokens, price, b.budget);
            }
            o.fills[pos].tokens = tokens;
            o.fills[pos].spend = spend;
            o.fills[pos].refundQuote = b.budget - spend;
            spent += spend;
        }
        o.poolQuote = spent;
    }

    /// @dev 向上取整，但不超过这笔预算。代币已经按向下取整算过。
    function _charge(uint256 tokens, uint256 price, uint256 budget) private pure returns (uint256) {
        if (tokens == 0 || price == 0) return 0;
        uint256 raw = tokens * price;
        uint256 spend = (raw + WAD - 1) / WAD;
        if (spend > budget) return budget;
        return spend;
    }

    function _sort(Bid[] memory bids, uint256[] memory order, uint256 m) private pure {
        for (uint256 i = 1; i < m; ++i) {
            uint256 key = order[i];
            uint256 j = i;
            while (j > 0 && _before(bids[key], bids[order[j - 1]])) {
                order[j] = order[j - 1];
                --j;
            }
            order[j] = key;
        }
    }

    function _before(Bid memory a, Bid memory b) private pure returns (bool) {
        if (a.maxPrice != b.maxPrice) return a.maxPrice > b.maxPrice;
        return a.index < b.index;
    }
}
