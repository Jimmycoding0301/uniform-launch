// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPortal} from "src/flap/IPortal.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {UniformLauncher} from "src/uniform/UniformLauncher.sol";
import {UniformVault} from "src/uniform/UniformVault.sol";
import {PancakeV2Testnet} from "src/uniform/PancakeV2Testnet.sol";

interface ITaxTokenLike {
    function taxProcessor() external view returns (address);
}

interface ITaxProcessorLike {
    function dispatch() external;
    function feeQuoteBalance() external view returns (uint256);
    function marketQuoteBalance() external view returns (uint256);
    function pendingDividendQuoteTokenBalance() external view returns (uint256);
    function lpQuoteBalance() external view returns (uint256);
}

interface IRouterLike {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256, address[] calldata, address, uint256)
        external
        payable;
    function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256, uint256, address[] calldata, address, uint256)
        external;
}

contract TaxScript is Script {
    address internal constant LAUNCHER = 0x4F1bF7E3205c9516c09aaA311971E42e50F3aB59;
    address internal constant WBNB = PancakeV2Testnet.WBNB;
    address internal constant ROUTER = PancakeV2Testnet.ROUTER;
    address internal trader = address(uint160(0xC0DE0004));
    address internal creator = address(uint160(0xC0DE0001));

    function run() external {
        UniformLauncher launcher = UniformLauncher(payable(LAUNCHER));
        address token = launcher.token();
        (address vault,) = IPortal(LaunchVaultAddresses.hub()).getLaunchVault(token);
        vm.warp(block.timestamp + 2 days);
        address proc = ITaxTokenLike(token).taxProcessor();
        address[] memory buyPath = new address[](2);
        buyPath[0] = WBNB;
        buyPath[1] = token;
        address[] memory sellPath = new address[](2);
        sellPath[0] = token;
        sellPath[1] = WBNB;
        vm.startBroadcast(trader);
        IRouterLike(ROUTER).swapExactETHForTokensSupportingFeeOnTransferTokens{value: 8 ether}(
            0, buyPath, trader, block.timestamp + 600
        );
        for (uint256 i; i < 8; ++i) {
            if (_liquid(proc)) break;
            uint256 sellAmt = IERC20(token).balanceOf(trader) * 30 / 100;
            if (sellAmt == 0) break;
            IERC20(token).approve(ROUTER, sellAmt);
            uint256 beforeBal = trader.balance;
            IRouterLike(ROUTER)
                .swapExactTokensForETHSupportingFeeOnTransferTokens(sellAmt, 0, sellPath, trader, block.timestamp + 600);
            uint256 proceeds = trader.balance - beforeBal;
            if (proceeds > 0) {
                IRouterLike(ROUTER).swapExactETHForTokensSupportingFeeOnTransferTokens{value: proceeds * 90 / 100}(
                    0, buyPath, trader, block.timestamp + 600
                );
            }
        }
        vm.stopBroadcast();
        vm.startBroadcast(creator);
        ITaxProcessorLike(proc).dispatch();
        uint256 beforeCreator = creator.balance;
        uint256 accrued = UniformVault(payable(vault)).accrued();
        UniformVault(payable(vault)).withdrawAll();
        vm.stopBroadcast();
        console.log("TOKEN", token);
        console.log("VAULT", vault);
        console.log("ACCRUED", accrued);
        console.log("CREATOR_DELTA", creator.balance - beforeCreator);
    }

    function _liquid(address proc) internal view returns (bool) {
        ITaxProcessorLike t = ITaxProcessorLike(proc);
        return t.feeQuoteBalance() > 0 || t.marketQuoteBalance() > 0 || t.pendingDividendQuoteTokenBalance() > 0
            || t.lpQuoteBalance() > 0;
    }
}
