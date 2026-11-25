// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {UniformLauncher} from "src/uniform/UniformLauncher.sol";
import {UniformSettle} from "src/uniform/UniformSettle.sol";
import {UniformVault} from "src/uniform/UniformVault.sol";
import {BinanceAgentIdSource} from "src/uniform/BinanceAgentIdSource.sol";
import {Erc8004Source} from "src/uniform/Erc8004Source.sol";
import {PermissiveAgentDirectory} from "./PermissiveAgentDirectory.sol";
import {AgentIdentityAddresses} from "src/uniform/AgentIdentityAddresses.sol";
import {UniformForkTest, IOfficial8004} from "./Uniform.fork.t.sol";

/// @notice 一条从头到尾的分叉流程：两种身份、一笔低于清算价、领取金额对照清算库、买卖税、owner 提走相同数额。
contract UniformE2EForkTest is UniformForkTest {
    address internal carol = address(uint160(0xC0DE0005));

    function test_e2eSuccessClaimTradeAndWithdraw() public {
        vm.deal(carol, 80 ether);
        address[] memory sources = new address[](2);
        sources[0] = address(new BinanceAgentIdSource(address(new PermissiveAgentDirectory())));
        sources[1] = address(new Erc8004Source(AgentIdentityAddresses.ERC8004_TESTNET));
        UniformLauncher launcher = _launch(1e13, 200, "E2E", bytes32("e2e-success"), sources);

        vm.prank(alice);
        launcher.bid{value: 20 ether}(1e16, 0, uint160(alice));

        IOfficial8004 reg = IOfficial8004(AgentIdentityAddresses.ERC8004_TESTNET);
        vm.prank(bob);
        uint256 bobId = reg.register();
        vm.prank(bob);
        launcher.bid{value: 20 ether}(1e16, 1, bobId);

        vm.prank(carol);
        launcher.bid{value: 1 ether}(2e13, 0, uint160(carol));

        (,, uint256[] memory maxPrices,,) = launcher.getBids();
        UniformSettle.Bid[] memory inputs = new UniformSettle.Bid[](3);
        inputs[0] = UniformSettle.Bid(0, 20 ether, maxPrices[0]);
        inputs[1] = UniformSettle.Bid(1, 20 ether, maxPrices[1]);
        inputs[2] = UniformSettle.Bid(2, 1 ether, maxPrices[2]);
        UniformSettle.Outcome memory quote = UniformSettle.settle(launcher.SELL_AMOUNT(), launcher.floorPrice(), inputs);
        (bool ok, uint256 clearing, uint256 poolQuote) = launcher.preview();
        assertTrue(ok);
        assertEq(clearing, quote.clearingPrice);
        assertEq(poolQuote, quote.poolQuote);
        assertEq(quote.fills[2].tokens, 0);
        assertEq(quote.fills[2].refundQuote, 1 ether);
        assertGt(quote.fills[0].tokens, 0);
        assertGt(quote.fills[1].tokens, 0);

        vm.roll(launcher.endBlock());
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Succeeded));

        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;
        uint256 carolBefore = carol.balance;
        vm.prank(alice);
        launcher.claim();
        vm.prank(bob);
        launcher.claim();
        vm.prank(carol);
        launcher.claim();
        assertEq(IERC20(launcher.token()).balanceOf(alice), quote.fills[0].tokens);
        assertEq(IERC20(launcher.token()).balanceOf(bob), quote.fills[1].tokens);
        assertEq(IERC20(launcher.token()).balanceOf(carol), 0);
        assertEq(alice.balance - aliceBefore, quote.fills[0].refundQuote);
        assertEq(bob.balance - bobBefore, quote.fills[1].refundQuote);
        assertEq(carol.balance - carolBefore, 1 ether);

        (address vault,) = portal.getLaunchVault(launcher.token());
        uint256 vaultBefore = address(vault).balance;
        _generateTaxAndDispatch(launcher.token());
        uint256 accrued = UniformVault(payable(vault)).accrued();
        assertGt(address(vault).balance, vaultBefore);
        assertEq(accrued, address(vault).balance);
        uint256 ownerBefore = creator.balance;
        vm.prank(creator);
        UniformVault(payable(vault)).withdrawAll();
        assertEq(creator.balance - ownerBefore, accrued);
        assertEq(address(vault).balance, 0);
    }

    function test_e2eFailRefundsFullBudget() public {
        vm.deal(carol, 80 ether);
        UniformLauncher launcher = _create(1 ether, 200, "LOWE", bytes32("e2e-fail"));
        vm.prank(alice);
        launcher.bid{value: 0.01 ether}(1 ether, 0, uint160(alice));
        vm.prank(bob);
        launcher.bid{value: 0.01 ether}(1 ether, 0, uint160(bob));
        vm.prank(carol);
        launcher.bid{value: 0.01 ether}(1 ether, 0, uint160(carol));
        assertLt(0.03 ether, launcher.minPoolQuote());
        vm.roll(launcher.endBlock());
        launcher.settle();
        assertEq(uint8(launcher.status()), uint8(UniformLauncher.Status.Failed));
        uint256 beforeA = alice.balance;
        uint256 beforeB = bob.balance;
        uint256 beforeC = carol.balance;
        vm.prank(alice);
        launcher.refund();
        vm.prank(bob);
        launcher.refund();
        vm.prank(carol);
        launcher.refund();
        assertEq(alice.balance - beforeA, 0.01 ether);
        assertEq(bob.balance - beforeB, 0.01 ether);
        assertEq(carol.balance - beforeC, 0.01 ether);
        assertEq(address(launcher).balance, 0);
    }
}
