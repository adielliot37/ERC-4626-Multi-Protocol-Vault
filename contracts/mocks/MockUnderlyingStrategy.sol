// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IUnderlyingStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUnderlyingStrategy is IUnderlyingStrategy {
    IERC20 public immutable asset;
    bool public immutable hasLockupPeriod;
    uint256 public lockupDuration;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(uint256 => uint256)) public pendingWithdrawals;
    mapping(address => uint256) public withdrawalRequestCount;
    
    uint256 public totalDeposited;
    uint256 public yieldMultiplier;
    
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event WithdrawalRequested(address indexed user, uint256 requestId, uint256 amount);
    event WithdrawalClaimed(address indexed user, uint256 requestId, uint256 amount);
    
    constructor(address _asset, bool _hasLockup, uint256 _lockupDuration) {
        asset = IERC20(_asset);
        hasLockupPeriod = _hasLockup;
        lockupDuration = _lockupDuration;
        yieldMultiplier = 1e18;
    }
    
    function deposit(uint256 amount) external returns (uint256) {
        require(asset.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        balanceOf[msg.sender] += amount;
        totalDeposited += amount;
        emit Deposit(msg.sender, amount);
        return amount;
    }
    
    function withdraw(uint256 amount) external returns (uint256) {
        require(!hasLockupPeriod, "Use withdrawWithLockup");
        uint256 userBalance = balanceOf[msg.sender];
        require(userBalance >= amount, "Insufficient balance");
        
        balanceOf[msg.sender] -= amount;
        totalDeposited -= amount;
        
        uint256 assetsToReturn = (amount * yieldMultiplier) / 1e18;
        require(asset.transfer(msg.sender, assetsToReturn), "Transfer failed");
        
        emit Withdraw(msg.sender, assetsToReturn);
        return assetsToReturn;
    }
    
    function withdrawWithLockup(uint256 amount) external returns (uint256) {
        require(hasLockupPeriod, "Use withdraw");
        uint256 userBalance = balanceOf[msg.sender];
        require(userBalance >= amount, "Insufficient balance");
        
        balanceOf[msg.sender] -= amount;
        totalDeposited -= amount;
        
        uint256 requestId = withdrawalRequestCount[msg.sender]++;
        pendingWithdrawals[msg.sender][requestId] = amount;
        
        emit WithdrawalRequested(msg.sender, requestId, amount);
        return requestId;
    }
    
    function claimWithdrawal(uint256 requestId) external returns (uint256) {
        uint256 amount = pendingWithdrawals[msg.sender][requestId];
        require(amount > 0, "No pending withdrawal");
        
        delete pendingWithdrawals[msg.sender][requestId];
        
        uint256 assetsToReturn = (amount * yieldMultiplier) / 1e18;
        require(asset.transfer(msg.sender, assetsToReturn), "Transfer failed");
        
        emit WithdrawalClaimed(msg.sender, requestId, assetsToReturn);
        return assetsToReturn;
    }
    
    function totalAssets() external view returns (uint256) {
        return (totalDeposited * yieldMultiplier) / 1e18;
    }
    
    function hasLockup() external view returns (bool) {
        return hasLockupPeriod;
    }
    
    function getPendingWithdrawal(address user, uint256 requestId) external view returns (uint256) {
        return pendingWithdrawals[user][requestId];
    }
    
    function setYieldMultiplier(uint256 _multiplier) external {
        yieldMultiplier = _multiplier;
    }
}

