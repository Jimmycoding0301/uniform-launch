// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Initializable} from "@openzeppelin-contracts-upgradeable/proxy/utils/Initializable.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {LauncherBase} from "src/flap/LauncherBase.sol";
import {LauncherDescription} from "src/flap/LauncherHelper.sol";
import {IPortal, IPortalTypes} from "src/flap/IPortal.sol";
import {Distribution, DistributionTarget} from "src/flap/Distribution.sol";
import {IStrategy} from "src/flap/IStrategy.sol";
import {LaunchExtensionHelper} from "src/flap/LaunchExtensionHelper.sol";
import {IAgentIdentitySource} from "./IAgentIdentitySource.sol";
import {UniformSettle} from "./UniformSettle.sol";

string constant TITLE_ZH = unicode"统一价拍卖";
string constant TITLE_EN = "Uniform-price auction";
string constant SUMMARY_ZH =
    unicode"代理提交限价和预算。窗口结束后按一个清算价卖出一半供应，另一半和成交的 BNB 注入池子。到不了保留价就全额退款，不发射。";
string constant SUMMARY_EN =
    "Agents submit a limit and a budget. At the end, half the supply sells at one clearing price. The other half and the BNB taken seed the pool. Below the reserve price, bidders are refunded in full and nothing launches.";

struct LaunchConfig {
    string name;
    string symbol;
    string meta;
    bytes32 salt;
    uint256 floorPrice;
    uint64 durationBlocks;
    address[] identitySources;
    address[] admittedWallets;
}

contract UniformLauncher is LauncherBase, Initializable, IStrategy {
    using SafeTransferLib for address;

    uint256 public constant TOTAL_SUPPLY = 1_000_000 ether;
    uint256 public constant SELL_AMOUNT = TOTAL_SUPPLY / 2;
    uint256 public constant POOL_AMOUNT = TOTAL_SUPPLY - SELL_AMOUNT;
    uint256 public constant MIN_BUDGET = 0.01 ether;
    uint256 public constant MAX_BUDGET = 100 ether;
    uint256 public constant MAX_BIDS = 128;
    uint64 public constant CLOSE_BUFFER = 20;
    /// @notice Reject an underfunded settle call before it can change auction state.
    ///         Clients add 1,000,000 gas for transaction and proxy overhead.
    uint256 public constant MIN_SETTLE_GAS = 13_000_000;
    uint64 public constant MIN_DURATION = 200;
    uint64 public constant MAX_DURATION = 20_000;
    uint16 public constant BUY_TAX_BPS = 300;
    uint16 public constant SELL_TAX_BPS = 300;
    /// @dev Additional liquidity retained above the Portal's current larger floor.
    uint256 public constant LAUNCH_MARGIN = 0.05 ether;

    enum Status {
        Open,
        Succeeded,
        Failed
    }

    struct Bid {
        address agent;
        uint256 budget;
        uint256 maxPrice;
        uint256 tokensOwed;
        uint256 quoteOwed;
        bool pulled;
        bytes32 sourceId;
        uint256 agentId;
    }

    address public hub;
    address public creator;
    address public vaultFactory;
    bytes32 public launchSalt;
    uint256 public floorPrice;
    uint64 public startBlock;
    uint64 public endBlock;
    string public name;
    string public symbol;
    string public meta;

    Status public status;
    uint256 public clearingPrice;
    uint256 public poolQuote;
    address public token;
    address public pool;
    uint256[8] public demandBins;

    Bid[] internal _bids;
    mapping(address => uint256) public bidOf;
    address[] public identitySources;
    mapping(bytes32 => mapping(uint256 => bool)) private _agentUsed;

    bool public launching;
    bool internal distributionInitialized;
    bool internal busy;

    uint256 public admittedWalletCount;
    mapping(address => bool) public admittedWallet;
    uint256 public unallocatedTokens;

    event BidPlaced(
        address indexed agent,
        uint256 indexed bidId,
        bytes32 indexed sourceId,
        uint256 agentId,
        uint256 budget,
        uint256 maxPrice
    );
    event AuctionSettled(uint256 clearingPrice, uint256 poolQuote, address token, address pool);
    event AuctionFailed(uint8 reason);
    event Claimed(address indexed agent, uint256 tokens, uint256 quoteRefunded);
    event Refunded(address indexed agent, uint256 amount);
    event UnallocatedTokensSentToBurnAddress(uint256 amount);

    error InvalidConfig();
    error Closed();
    error Early();
    error AlreadyBid();
    error BadBudget();
    error BelowFloor();
    error Full();
    error Busy();
    error DirectEth();
    error UnauthorizedDistribution();
    error NothingToClaim();
    error RefundUnavailable();
    error NothingToRefund();
    error NotCreator();
    error InsufficientGas();
    error NotAgent();
    error AgentAlreadyBid();
    error NotAdmitted();
    error NoUnallocatedTokens();
    error PortalQuoteUnavailable();

    modifier nonReentrant() {
        if (busy) revert Busy();
        busy = true;
        _;
        busy = false;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address hub_, address creator_, address vaultFactory_, LaunchConfig calldata c)
        external
        payable
        initializer
        nonReentrant
    {
        if (hub_ == address(0) || creator_ == address(0) || vaultFactory_ == address(0)) revert InvalidConfig();
        if (bytes(c.name).length == 0 || bytes(c.name).length > 32) revert InvalidConfig();
        if (bytes(c.symbol).length == 0 || bytes(c.symbol).length > 8) revert InvalidConfig();
        if (bytes(c.meta).length == 0 || c.salt == bytes32(0)) revert InvalidConfig();
        if (c.floorPrice == 0 || c.floorPrice > 1e36) revert InvalidConfig();
        if (c.durationBlocks < MIN_DURATION || c.durationBlocks > MAX_DURATION) revert InvalidConfig();
        if (c.identitySources.length == 0 || c.identitySources.length > 4) revert InvalidConfig();
        for (uint256 i; i < c.identitySources.length; ++i) {
            if (c.identitySources[i].code.length == 0) revert InvalidConfig();
            identitySources.push(c.identitySources[i]);
        }
        if (c.admittedWallets.length > MAX_BIDS || (block.chainid == 56 && c.admittedWallets.length == 0)) {
            revert InvalidConfig();
        }
        admittedWalletCount = c.admittedWallets.length;
        for (uint256 i; i < c.admittedWallets.length; ++i) {
            address wallet = c.admittedWallets[i];
            if (wallet == address(0) || admittedWallet[wallet]) revert InvalidConfig();
            admittedWallet[wallet] = true;
        }

        hub = hub_;
        creator = creator_;
        vaultFactory = vaultFactory_;
        launchSalt = c.salt;
        floorPrice = c.floorPrice;
        name = c.name;
        symbol = c.symbol;
        meta = c.meta;
        startBlock = uint64(block.number);
        endBlock = startBlock + c.durationBlocks;

        uint256 fee = IPortal(hub_).SALT_LOCK_FEE();
        if (msg.value != fee) revert InvalidConfig();
        IPortal(hub_).lockSalt{value: fee}(c.salt, uint8(IPortalTypes.LaunchKind.DIRECT_V2_POOL_TAX));
    }

    receive() external payable {
        revert DirectEth();
    }

    function _getHub() internal view override returns (address) {
        return hub;
    }

    function _description() internal view override returns (LauncherDescription memory d) {
        d.name = name;
        d.symbol = symbol;
        d.quoteToken = address(0);
        d.targetRaise = softCap();
        d.poolTokenRatio = POOL_AMOUNT * 1e18 / TOTAL_SUPPLY;
        d.titleZh = TITLE_ZH;
        d.titleEn = TITLE_EN;
        d.summaryZh = SUMMARY_ZH;
        d.summaryEn = SUMMARY_EN;
    }

    function softCap() public view returns (uint256) {
        return floorPrice * SELL_AMOUNT / 1e18;
    }

    /// @notice Current Portal floor plus the auction's liquidity margin.
    function minPoolQuote() public view returns (uint256) {
        (uint256 price, IPortal.GraduationFloorResultV2 memory floor) = _portalFloor(0);
        return _minimumQuote(price, floor);
    }

    function bidCount() external view returns (uint256) {
        return _bids.length;
    }

    function identitySourceCount() external view returns (uint256) {
        return identitySources.length;
    }

    function statusCode() external view returns (uint8) {
        return uint8(status);
    }

    function demand0() external view returns (uint256) {
        return demandBins[0];
    }

    function demand1() external view returns (uint256) {
        return demandBins[1];
    }

    function demand2() external view returns (uint256) {
        return demandBins[2];
    }

    function demand3() external view returns (uint256) {
        return demandBins[3];
    }

    function demand4() external view returns (uint256) {
        return demandBins[4];
    }

    function demand5() external view returns (uint256) {
        return demandBins[5];
    }

    function demand6() external view returns (uint256) {
        return demandBins[6];
    }

    function demand7() external view returns (uint256) {
        return demandBins[7];
    }

    function getFills()
        external
        view
        returns (uint256[] memory tokensOwed, uint256[] memory quoteOwed, bool[] memory pulled)
    {
        uint256 n = _bids.length;
        tokensOwed = new uint256[](n);
        quoteOwed = new uint256[](n);
        pulled = new bool[](n);
        for (uint256 i; i < n; ++i) {
            tokensOwed[i] = _bids[i].tokensOwed;
            quoteOwed[i] = _bids[i].quoteOwed;
            pulled[i] = _bids[i].pulled;
        }
    }

    function getBids()
        external
        view
        returns (
            address[] memory agents,
            uint256[] memory budgets,
            uint256[] memory maxPrices,
            bytes32[] memory sourceIds,
            uint256[] memory agentIds
        )
    {
        uint256 n = _bids.length;
        agents = new address[](n);
        budgets = new uint256[](n);
        maxPrices = new uint256[](n);
        sourceIds = new bytes32[](n);
        agentIds = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            agents[i] = _bids[i].agent;
            budgets[i] = _bids[i].budget;
            maxPrices[i] = _bids[i].maxPrice;
            sourceIds[i] = _bids[i].sourceId;
            agentIds[i] = _bids[i].agentId;
        }
    }

    function preview() external view returns (bool ok, uint256 clearingPrice_, uint256 poolQuote_) {
        UniformSettle.Outcome memory o = _quote();
        return (o.ok, o.clearingPrice, o.poolQuote);
    }

    /// @notice `sourceIndex` 选择创建时固定的身份来源。`agentId` 由代理自己申报。
    ///         Agent ID on mainnet takes the ERC-721 token ID.
    ///         ERC-8004：填官方 Identity Registry 的编号，且本地址是 owner 或 `getAgentWallet`。
    function bid(uint256 maxPrice, uint8 sourceIndex, uint256 agentId) external payable nonReentrant {
        if (status != Status.Open) revert Closed();
        if (block.number < startBlock || block.number >= endBlock - CLOSE_BUFFER) revert Closed();
        if (bidOf[msg.sender] != 0) revert AlreadyBid();
        if (admittedWalletCount != 0 && !admittedWallet[msg.sender]) revert NotAdmitted();
        if (msg.value < MIN_BUDGET || msg.value > MAX_BUDGET) revert BadBudget();
        if (maxPrice < floorPrice) revert BelowFloor();
        if (_bids.length >= MAX_BIDS) revert Full();
        if (sourceIndex >= identitySources.length) revert NotAgent();
        (bool agentOk, bytes32 sourceId) =
            IAgentIdentitySource(identitySources[sourceIndex]).verify(msg.sender, agentId);
        if (!agentOk) revert NotAgent();
        if (_agentUsed[sourceId][agentId]) revert AgentAlreadyBid();
        _agentUsed[sourceId][agentId] = true;

        _bids.push(
            Bid({
                agent: msg.sender,
                budget: msg.value,
                maxPrice: maxPrice,
                tokensOwed: 0,
                quoteOwed: 0,
                pulled: false,
                sourceId: sourceId,
                agentId: agentId
            })
        );
        bidOf[msg.sender] = _bids.length;
        for (uint256 i; i < 8; ++i) {
            if (maxPrice >= (floorPrice << i)) demandBins[i] += msg.value;
        }
        emit BidPlaced(msg.sender, _bids.length - 1, sourceId, agentId, msg.value, maxPrice);
    }

    function settle() external nonReentrant {
        if (gasleft() < MIN_SETTLE_GAS) revert InsufficientGas();
        if (status != Status.Open) revert Closed();
        if (block.number < endBlock) revert Early();

        UniformSettle.Outcome memory o = _quote();
        if (!o.ok || o.poolQuote == 0 || !_portalAllowsLaunch(o.poolQuote)) {
            status = Status.Failed;
            emit AuctionFailed(1);
            return;
        }

        IPortalTypes.CreateTaxTokenParams memory p = _params(o.poolQuote);
        Distribution memory dist = Distribution({
            target: DistributionTarget.EXPLICIT, strategy: address(this), amount: uint128(SELL_AMOUNT), configData: ""
        });
        IPortalTypes.CreatorBuyParams memory buy;

        launching = true;
        try IPortal(hub).launchTaxTokenV2{value: o.poolQuote}(p, dist, buy) returns (address token_, address pool_) {
            launching = false;
            _storeSuccess(o, token_, pool_);
        } catch {
            launching = false;
            status = Status.Failed;
            emit AuctionFailed(2);
        }
    }

    function claim() external nonReentrant {
        if (status != Status.Succeeded) revert NothingToClaim();
        uint256 id = bidOf[msg.sender];
        if (id == 0) revert NothingToClaim();
        Bid storage b = _bids[id - 1];
        uint256 tokensOut = b.tokensOwed;
        uint256 quoteOut = b.quoteOwed;
        if (b.pulled || (tokensOut == 0 && quoteOut == 0)) revert NothingToClaim();
        b.tokensOwed = 0;
        b.quoteOwed = 0;
        b.pulled = true;
        if (quoteOut > 0) msg.sender.safeTransferETH(quoteOut);
        if (tokensOut > 0) token.safeTransfer(msg.sender, tokensOut);
        emit Claimed(msg.sender, tokensOut, quoteOut);
    }

    function refund() external nonReentrant {
        if (status != Status.Failed) revert RefundUnavailable();
        uint256 id = bidOf[msg.sender];
        if (id == 0) revert NothingToRefund();
        Bid storage b = _bids[id - 1];
        if (b.pulled || b.budget == 0) revert NothingToRefund();
        uint256 amount = b.budget;
        b.pulled = true;
        msg.sender.safeTransferETH(amount);
        emit Refunded(msg.sender, amount);
    }

    function guardianFail() external onlyGuardian nonReentrant {
        if (status != Status.Open) revert Closed();
        status = Status.Failed;
        emit AuctionFailed(1);
    }

    function initializeDistribution(address token_, uint256 amount, bytes calldata, bytes32) external onlyHub {
        if (!launching || distributionInitialized) revert UnauthorizedDistribution();
        if (token_ == address(0) || amount != SELL_AMOUNT) revert InvalidConfig();
        distributionInitialized = true;
        token = token_;
        token_.safeTransferFrom(msg.sender, address(this), amount);
        emit FlapDistributionInitialized(token_, amount);
    }

    function burnUnallocatedTokens() external nonReentrant {
        uint256 amount = unallocatedTokens;
        if (status != Status.Succeeded || amount == 0) revert NoUnallocatedTokens();
        unallocatedTokens = 0;
        token.safeTransfer(address(0xdEaD), amount);
        emit UnallocatedTokensSentToBurnAddress(amount);
    }

    function _portalAllowsLaunch(uint256 quoteIn) internal view returns (bool) {
        (uint256 price, IPortal.GraduationFloorResultV2 memory floor) = _portalFloor(quoteIn);
        return floor.meetsCreateFloor && floor.meetsFloor && quoteIn >= _minimumQuote(price, floor);
    }

    function _portalFloor(uint256 quoteIn)
        internal
        view
        returns (uint256 price, IPortal.GraduationFloorResultV2 memory floor)
    {
        bool enabled;
        (enabled, price) = IPortal(hub).launchQuoteConfig(uint8(IPortalTypes.LaunchKind.DIRECT_V2_POOL_TAX), address(0));
        if (!enabled || price == 0) revert PortalQuoteUnavailable();
        floor = IPortal(hub)
            .graduationFloorV2ForLauncher(
                IPortal.GraduationFloorParams({
                quoteToken: address(0),
                quotePriceUsd: price,
                poolQuote: quoteIn,
                poolToken: POOL_AMOUNT,
                totalSupply: TOTAL_SUPPLY,
                vaultFactory: vaultFactory
            }),
                address(this)
            );
    }

    function _minimumQuote(uint256 price, IPortal.GraduationFloorResultV2 memory floor)
        internal
        pure
        returns (uint256)
    {
        uint256 usd = FixedPointMathLib.max(floor.floorUsdWad, floor.createFloorUsdWad);
        return FixedPointMathLib.fullMulDivUp(usd, 1 ether, price) + LAUNCH_MARGIN;
    }

    function _quote() internal view returns (UniformSettle.Outcome memory) {
        uint256 n = _bids.length;
        UniformSettle.Bid[] memory inputs = new UniformSettle.Bid[](n);
        for (uint256 i; i < n; ++i) {
            inputs[i] = UniformSettle.Bid({index: i, budget: _bids[i].budget, maxPrice: _bids[i].maxPrice});
        }
        return UniformSettle.settle(SELL_AMOUNT, floorPrice, inputs);
    }

    function _storeSuccess(UniformSettle.Outcome memory o, address token_, address pool_) internal {
        status = Status.Succeeded;
        clearingPrice = o.clearingPrice;
        poolQuote = o.poolQuote;
        token = token_;
        pool = pool_;
        uint256 n = _bids.length;
        uint256 remaining = SELL_AMOUNT;
        for (uint256 i; i < n; ++i) {
            remaining -= o.fills[i].tokens;
            _bids[i].tokensOwed = o.fills[i].tokens;
            _bids[i].quoteOwed = o.fills[i].refundQuote;
        }
        unallocatedTokens = remaining;
        emit AuctionSettled(o.clearingPrice, o.poolQuote, token_, pool_);
    }

    function _params(uint256 quoteIn) internal view returns (IPortalTypes.CreateTaxTokenParams memory p) {
        p.name = name;
        p.symbol = symbol;
        p.meta = meta;
        p.totalSupply = TOTAL_SUPPLY;
        p.salt = launchSalt;
        p.quoteToken = address(0);
        p.dexId = 0;
        p.poolQuote = quoteIn;
        p.poolToken = POOL_AMOUNT;
        p.buyTaxRate = BUY_TAX_BPS;
        p.sellTaxRate = SELL_TAX_BPS;
        p.taxDuration = 30 days;
        p.antiFarmerDuration = 1 days;
        p.feeConfigs = _fees();
        p.antiSniperMode = 0;
        p.exemptWindow = 0;
        p.exemptAddrs = new address[](0);
        p.creatorBuyQuote = 0;
        (p.extensionID, p.extensionData) = LaunchExtensionHelper.encodeCreator(creator);
        p.commissionReceiver = address(0);
    }

    function _fees() internal view returns (IPortalTypes.FeeConfig[] memory fees) {
        fees = new IPortalTypes.FeeConfig[](1);
        fees[0] = IPortalTypes.FeeConfig({
            feeType: IPortalTypes.FeeSlotType.VAULT,
            bps: 10_000,
            configData: abi.encode(
                IPortalTypes.FeeConfigVault({vaultFactory: vaultFactory, vaultData: abi.encode(address(this))})
            )
        });
    }
}
