// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice ERC-8004 Identity Registry 的参考实现。
///         官方注册表已部署，但没有从地址反查 agentId 的视图（`tokenOfOwnerByIndex` 和 `agentIdOf` 都会 revert）。
///         这一份按 EIP-8004 登记 owner 与 agentWallet，并在转走 NFT 时清掉 agentWallet。
///         `agentIdOf` 让拍卖能在一次调用里核对 owner 或已登记的 agentWallet。
contract Erc8004Registry {
    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) public getAgentWallet;
    mapping(address => uint256) private _agentIdOf;

    uint256 public nextId = 1;

    event Registered(uint256 indexed agentId, address indexed owner);
    event Transfer(address indexed from, address indexed to, uint256 indexed agentId);
    event AgentWalletSet(uint256 indexed agentId, address indexed wallet);

    error NotOwner();
    error ZeroAddress();
    error UnknownAgent();

    function agentIdOf(address account) external view returns (uint256) {
        return _agentIdOf[account];
    }

    function register() external returns (uint256 agentId) {
        agentId = nextId++;
        ownerOf[agentId] = msg.sender;
        balanceOf[msg.sender] += 1;
        getAgentWallet[agentId] = msg.sender;
        if (_agentIdOf[msg.sender] == 0) _agentIdOf[msg.sender] = agentId;
        emit Registered(agentId, msg.sender);
        emit Transfer(address(0), msg.sender, agentId);
        emit AgentWalletSet(agentId, msg.sender);
    }

    function transfer(address to, uint256 agentId) external {
        if (to == address(0)) revert ZeroAddress();
        if (ownerOf[agentId] != msg.sender) revert NotOwner();
        address wallet = getAgentWallet[agentId];
        _clear(msg.sender, agentId);
        if (wallet != address(0) && wallet != msg.sender) _clear(wallet, agentId);
        getAgentWallet[agentId] = address(0);
        balanceOf[msg.sender] -= 1;
        balanceOf[to] += 1;
        ownerOf[agentId] = to;
        if (_agentIdOf[to] == 0) _agentIdOf[to] = agentId;
        emit Transfer(msg.sender, to, agentId);
        emit AgentWalletSet(agentId, address(0));
    }

    /// @dev 测试和参考部署用。正式的 EIP-8004 还要求 EIP-712 签名，这里只保留归属检查。
    function setAgentWallet(uint256 agentId, address wallet) external {
        if (wallet == address(0)) revert ZeroAddress();
        if (ownerOf[agentId] != msg.sender) revert NotOwner();
        address prev = getAgentWallet[agentId];
        if (prev != address(0) && prev != msg.sender) _clear(prev, agentId);
        getAgentWallet[agentId] = wallet;
        _agentIdOf[wallet] = agentId;
        emit AgentWalletSet(agentId, wallet);
    }

    function _clear(address account, uint256 agentId) private {
        if (_agentIdOf[account] == agentId) _agentIdOf[account] = 0;
    }
}
