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
        order = _sort(bids, order, m);

        uint8 kind;
        uint256 winK;
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

        (uint256 marginalPrice, uint256 marginalEnd) = _findPin(bids, order, m, sellAmount, bestP);
        if (marginalPrice != 0) {
            kind = 2;
            bestP = marginalPrice;
            winK = marginalEnd;
        }

        if (kind == 0) return o;
        o.ok = true;
        o.clearingPrice = bestP;
        if (kind == 1) _fillPrefix(o, bids, order, winK, sellAmount);
        else _fillPin(o, bids, order, winK, sellAmount, bestP);
    }

    function _findPin(Bid[] memory bids, uint256[] memory order, uint256 count, uint256 sellAmount, uint256 bestP)
        private
        pure
        returns (uint256 price, uint256 end)
    {
        uint256 eligibleBudget;
        while (end < count) {
            uint256 first = end;
            uint256 candidate = bids[order[first]].maxPrice;
            // The prefix wins ties. Lower limits cannot improve the current clearing price.
            if (candidate <= bestP) break;

            uint256 groupBudget;
            do {
                groupBudget += bids[order[end++]].budget;
            } while (end < count && bids[order[end]].maxPrice == candidate);
            eligibleBudget += groupBudget;
            // Rounding down the higher bids' token amounts can only increase the
            // remaining cost. Insufficient aggregate budget rules this price out.
            if (candidate > ((eligibleBudget + 1) * WAD - 1) / sellAmount) continue;

            uint256 higherTokens;
            for (uint256 i; i < first; ++i) {
                higherTokens += bids[order[i]].budget * WAD / candidate;
            }
            if (higherTokens < sellAmount && groupBudget >= (sellAmount - higherTokens) * candidate / WAD) {
                return (candidate, end);
            }
        }
        return (0, 0);
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

    function _sort(Bid[] memory bids, uint256[] memory order, uint256 count) private pure returns (uint256[] memory) {
        if (count < 2) return order;
        uint256[] memory merged = new uint256[](count);
        for (uint256 width = 1; width < count; width *= 2) {
            for (uint256 first; first < count; first += 2 * width) {
                uint256 middle = first + width < count ? first + width : count;
                uint256 end = middle + width < count ? middle + width : count;
                uint256 left = first;
                uint256 right = middle;
                for (uint256 i = first; i < end; ++i) {
                    if (right == end || (left < middle && !_before(bids[order[right]], bids[order[left]]))) {
                        merged[i] = order[left++];
                    } else {
                        merged[i] = order[right++];
                    }
                }
            }
            (order, merged) = (merged, order);
        }
        return order;
    }

    function _before(Bid memory a, Bid memory b) private pure returns (bool) {
        if (a.maxPrice != b.maxPrice) return a.maxPrice > b.maxPrice;
        return a.index < b.index;
    }
}
