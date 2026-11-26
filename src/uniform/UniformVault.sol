// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Initializable} from "@openzeppelin-contracts-upgradeable/proxy/utils/Initializable.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {LibString} from "solady/utils/LibString.sol";
import {DirectLaunchVaultBase} from "src/flap/DirectLaunchVaultBase.sol";
import {VaultUISchema, VaultMethodSchema, FieldDescriptor} from "src/flap/IVaultSchemas.sol";

/// @notice 税的 100% 进入本合约。owner 可提到任意地址。Guardian 只能提到 owner。
contract UniformVault is DirectLaunchVaultBase, Initializable {
    using SafeTransferLib for address;

    address public taxToken;
    address public launcher;
    address public owner;
    bool private locked;
    address public pendingOwner;

    event TaxWithdrawn(address indexed to, uint256 amount);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error NotPendingOwner();
    error ZeroAddress();
    error NothingToWithdraw();
    error AmountTooHigh();
    error Busy();

    modifier nonReentrant() {
        if (locked) revert Busy();
        locked = true;
        _;
        locked = false;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address taxToken_, address launcher_, address owner_) external initializer {
        if (taxToken_ == address(0) || launcher_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        taxToken = taxToken_;
        launcher = launcher_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    receive() external payable {}

    function accrued() public view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Nominate a new owner. Pass address(0) to cancel a pending nomination.
    function transferOwnership(address newOwner) external nonReentrant {
        if (msg.sender != owner) revert NotOwner();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(msg.sender, newOwner);
    }

    /// @notice The nominee takes ownership of the vault and its existing balance.
    function acceptOwnership() external nonReentrant {
        if (pendingOwner == address(0) || msg.sender != pendingOwner) revert NotPendingOwner();
        address previousOwner = owner;
        owner = msg.sender;
        delete pendingOwner;
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    function withdraw(address to, uint256 amount) external nonReentrant {
        if (msg.sender != owner) revert NotOwner();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0 || amount > address(this).balance) revert AmountTooHigh();
        to.safeTransferETH(amount);
        emit TaxWithdrawn(to, amount);
    }

    function withdrawAll() external nonReentrant {
        if (msg.sender != owner && msg.sender != _getGuardian()) revert NotOwner();
        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();
        owner.safeTransferETH(amount);
        emit TaxWithdrawn(owner, amount);
    }

    function description() public view override returns (string memory) {
        return string.concat(
            "UniformVault: 100% of quote tax is held here. Owner ",
            LibString.toHexString(owner),
            " may withdraw to any address. Guardian may withdrawAll only to the owner. No other recipient."
        );
    }

    function vaultUISchema() public pure override returns (VaultUISchema memory schema) {
        schema.vaultType = "UniformVault";
        schema.description = "Holds 100% of the tax. The owner withdraws it. No vote.";
        schema.methods = new VaultMethodSchema[](7);

        schema.methods[0].name = "accrued";
        schema.methods[0].description = "BNB currently in the vault.";
        schema.methods[0].outputs = new FieldDescriptor[](1);
        schema.methods[0].outputs[0] = FieldDescriptor("amount", "uint256", "BNB balance", 18);

        schema.methods[1].name = "owner";
        schema.methods[1].description = "Address that can withdraw.";
        schema.methods[1].outputs = new FieldDescriptor[](1);
        schema.methods[1].outputs[0] = FieldDescriptor("owner", "address", "Owner", 0);

        schema.methods[2].name = "withdraw";
        schema.methods[2].description = "Owner sends part of the balance to an address.";
        schema.methods[2].isWriteMethod = true;
        schema.methods[2].inputs = new FieldDescriptor[](2);
        schema.methods[2].inputs[0] = FieldDescriptor("to", "address", "Recipient", 0);
        schema.methods[2].inputs[1] = FieldDescriptor("amount", "uint256", "Amount", 18);

        schema.methods[3].name = "withdrawAll";
        schema.methods[3].description = "Send the full balance to the owner.";
        schema.methods[3].isWriteMethod = true;

        schema.methods[4].name = "pendingOwner";
        schema.methods[4].description = "Nominee who can accept ownership. Zero means there is no nominee.";
        schema.methods[4].outputs = new FieldDescriptor[](1);
        schema.methods[4].outputs[0] = FieldDescriptor("nominee", "address", "Nominated owner", 0);

        schema.methods[5].name = "transferOwnership";
        schema.methods[5].description = "Owner nominates a successor. Use the zero address to cancel.";
        schema.methods[5].isWriteMethod = true;
        schema.methods[5].inputs = new FieldDescriptor[](1);
        schema.methods[5].inputs[0] = FieldDescriptor("newOwner", "address", "Nominee", 0);

        schema.methods[6].name = "acceptOwnership";
        schema.methods[6].description = "Nominee accepts control of the vault and its balance.";
        schema.methods[6].isWriteMethod = true;
    }
}
