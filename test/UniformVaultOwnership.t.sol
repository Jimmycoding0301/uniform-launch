// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {LibClone} from "solady/utils/LibClone.sol";
import {UpgradeableBeacon} from "solady/utils/UpgradeableBeacon.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {UniformVault} from "src/uniform/UniformVault.sol";

contract UniformVaultOwnershipTest is Test {
    UniformVault internal vault;
    address internal constant OWNER = address(0xA11CE);
    address internal constant NOMINEE = address(0xB0B);
    address internal constant OTHER = address(0xCAFE);

    function setUp() public {
        vm.chainId(97);
        address beacon = address(new UpgradeableBeacon(address(this), address(new UniformVault())));
        vault = UniformVault(payable(LibClone.deployERC1967BeaconProxy(beacon)));
        vault.initialize(address(0x1000), address(0x2000), OWNER);
        vm.deal(address(vault), 1 ether);
    }

    function test_acceptMovesWithdrawalRightsAndExistingBalance() public {
        assertEq(vault.pendingOwner(), address(0));
        vm.expectEmit(true, true, false, false, address(vault));
        emit UniformVault.OwnershipTransferStarted(OWNER, NOMINEE);
        vm.prank(OWNER);
        vault.transferOwnership(NOMINEE);
        assertEq(vault.owner(), OWNER);
        assertEq(vault.pendingOwner(), NOMINEE);

        vm.expectRevert(UniformVault.NotOwner.selector);
        vm.prank(NOMINEE);
        vault.withdrawAll();
        vm.expectEmit(true, true, false, false, address(vault));
        emit UniformVault.OwnershipTransferred(OWNER, NOMINEE);
        vm.prank(NOMINEE);
        vault.acceptOwnership();
        assertEq(vault.owner(), NOMINEE);
        assertEq(vault.pendingOwner(), address(0));
        assertEq(vault.accrued(), 1 ether);

        vm.expectRevert(UniformVault.NotOwner.selector);
        vm.prank(OWNER);
        vault.withdrawAll();
        vm.expectRevert(UniformVault.NotOwner.selector);
        vm.prank(OWNER);
        vault.transferOwnership(OTHER);
        vm.prank(NOMINEE);
        vault.withdraw(OTHER, 1 ether);
        assertEq(OTHER.balance, 1 ether);
    }

    function test_ownerMayReplaceOrCancelNomination() public {
        vm.prank(OWNER);
        vault.transferOwnership(NOMINEE);
        vm.prank(OWNER);
        vault.transferOwnership(OTHER);
        vm.expectRevert(UniformVault.NotPendingOwner.selector);
        vm.prank(NOMINEE);
        vault.acceptOwnership();

        vm.expectEmit(true, true, false, false, address(vault));
        emit UniformVault.OwnershipTransferStarted(OWNER, address(0));
        vm.prank(OWNER);
        vault.transferOwnership(address(0));
        assertEq(vault.pendingOwner(), address(0));
        vm.expectRevert(UniformVault.NotPendingOwner.selector);
        vm.prank(OTHER);
        vault.acceptOwnership();
        assertEq(vault.owner(), OWNER);
        assertEq(vault.accrued(), 1 ether);
    }

    function test_guardianSweepsOnlyToCurrentOwnerAcrossHandoff() public {
        address guardian = LaunchVaultAddresses.guardian();
        vm.prank(OWNER);
        vault.transferOwnership(NOMINEE);
        vm.startPrank(guardian);
        vm.expectRevert(UniformVault.NotOwner.selector);
        vault.transferOwnership(guardian);
        vm.expectRevert(UniformVault.NotOwner.selector);
        vault.transferOwnership(address(0));
        vm.expectRevert(UniformVault.NotPendingOwner.selector);
        vault.acceptOwnership();
        vm.expectRevert(UniformVault.NotOwner.selector);
        vault.withdraw(guardian, 1 ether);
        vault.withdrawAll();
        vm.stopPrank();
        assertEq(OWNER.balance, 1 ether);
        assertEq(NOMINEE.balance, 0);

        vm.prank(NOMINEE);
        vault.acceptOwnership();
        vm.deal(address(vault), 2 ether);
        vm.prank(guardian);
        vault.withdrawAll();
        assertEq(OWNER.balance, 1 ether);
        assertEq(NOMINEE.balance, 2 ether);
        assertEq(vault.accrued(), 0);
    }
}
