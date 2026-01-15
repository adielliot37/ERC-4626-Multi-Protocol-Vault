// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUnderlyingStrategy {
    function deposit(uint256 amount) external returns (uint256);
    function withdraw(uint256 amount) external returns (uint256);
    function withdrawWithLockup(uint256 amount) external returns (uint256 requestId);
    function claimWithdrawal(uint256 requestId) external returns (uint256);
    function totalAssets() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function hasLockup() external view returns (bool);
    function getPendingWithdrawal(address user, uint256 requestId) external view returns (uint256);
}


