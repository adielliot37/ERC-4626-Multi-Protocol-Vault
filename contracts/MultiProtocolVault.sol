// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IERC4626.sol";
import "./interfaces/IUnderlyingStrategy.sol";

contract MultiProtocolVault is ERC20, IERC4626, AccessControl, Pausable {
    using SafeERC20 for IERC20;
    
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 public constant MAX_ALLOCATION_BPS = 8000;
    uint256 private constant PRECISION = 1e18;
    
    IERC20 private immutable _asset;
    
    function asset() public view override returns (address) {
        return address(_asset);
    }
    
    struct Strategy {
        IUnderlyingStrategy strategy;
        uint256 allocationBps;
        bool active;
    }
    
    Strategy[] public strategies;
    
    struct WithdrawalRequest {
        address strategy;
        uint256 strategyRequestId;
        uint256 amount;
    }
    
    mapping(address => mapping(uint256 => WithdrawalRequest)) public pendingWithdrawals;
    mapping(address => uint256) public withdrawalRequestCount;
    
    event StrategyAdded(address indexed strategy, uint256 allocationBps);
    event StrategyAllocationUpdated(uint256 indexed index, uint256 newAllocationBps);
    event Rebalance(uint256[] allocations);
    event WithdrawalQueued(address indexed user, uint256 requestId, address indexed strategy, uint256 amount);
    event WithdrawalClaimed(address indexed user, uint256 requestId, uint256 amount);
    event YieldUpdate(uint256 totalAssets, uint256 totalShares, uint256 sharePrice);
    
    constructor(
        address assetAddress,
        address _admin
    ) ERC20("Multi Protocol Vault", "MPV") {
        _asset = IERC20(assetAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MANAGER_ROLE, _admin);
    }
    
    // ============ ERC-4626 Functions ============
    
    function totalAssets() public view override returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active) {
                total += strategies[i].strategy.totalAssets();
            }
        }
        return total;
    }
    
    function convertToShares(uint256 assets) public view override returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return assets;
        return (assets * supply) / totalAssets();
    }
    
    function convertToAssets(uint256 shares) public view override returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        return (shares * totalAssets()) / supply;
    }
    
    function maxDeposit(address) public view override returns (uint256) {
        return type(uint256).max;
    }
    
    function previewDeposit(uint256 assets) public view override returns (uint256) {
        return convertToShares(assets);
    }
    
    function deposit(uint256 assets, address receiver) public override whenNotPaused returns (uint256 shares) {
        require(assets > 0, "Zero assets");
        require(receiver != address(0), "Invalid receiver");
        
        shares = previewDeposit(assets);
        require(shares > 0, "Zero shares");
        
        _asset.safeTransferFrom(msg.sender, address(this), assets);
        
        // Route to strategies based on allocations
        _routeDeposit(assets);
        
        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }
    
    function maxMint(address) public view override returns (uint256) {
        return type(uint256).max;
    }
    
    function previewMint(uint256 shares) public view override returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        return (shares * totalAssets()) / supply;
    }
    
    function mint(uint256 shares, address receiver) public override whenNotPaused returns (uint256 assets) {
        assets = previewMint(shares);
        return deposit(assets, receiver);
    }
    
    function maxWithdraw(address owner) public view override returns (uint256) {
        return convertToAssets(balanceOf(owner));
    }
    
    function previewWithdraw(uint256 assets) public view override returns (uint256) {
        return convertToShares(assets);
    }
    
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override whenNotPaused returns (uint256 shares) {
        shares = previewWithdraw(assets);
        return redeem(shares, receiver, owner);
    }
    
    function maxRedeem(address owner) public view override returns (uint256) {
        return balanceOf(owner);
    }
    
    function previewRedeem(uint256 shares) public view override returns (uint256) {
        return convertToAssets(shares);
    }
    
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override whenNotPaused returns (uint256 assets) {
        require(shares > 0, "Zero shares");
        require(receiver != address(0), "Invalid receiver");
        
        if (msg.sender != owner) {
            uint256 allowed = allowance(owner, msg.sender);
            require(allowed >= shares, "Insufficient allowance");
            _spendAllowance(owner, msg.sender, shares);
        }
        
        assets = previewRedeem(shares);
        require(assets > 0, "Zero assets");
        
        _burn(owner, shares);
        
        // Handle withdrawal across strategies
        assets = _handleWithdrawal(assets, receiver);
        
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
        
        // Emit yield tracking event
        uint256 currentTotalAssets = totalAssets();
        uint256 currentTotalShares = totalSupply();
        uint256 sharePrice = currentTotalShares > 0 ? (currentTotalAssets * 1e18) / currentTotalShares : 1e18;
        emit YieldUpdate(currentTotalAssets, currentTotalShares, sharePrice);
    }
    
    // ============ Strategy Management ============
    
    function addStrategy(address _strategy, uint256 _allocationBps) external onlyRole(MANAGER_ROLE) {
        require(_allocationBps <= MAX_ALLOCATION_BPS, "Allocation too high");
        require(_strategy != address(0), "Invalid strategy");
        
        strategies.push(Strategy({
            strategy: IUnderlyingStrategy(_strategy),
            allocationBps: _allocationBps,
            active: true
        }));
        
        emit StrategyAdded(_strategy, _allocationBps);
    }
    
    function updateStrategyAllocation(uint256 _index, uint256 _allocationBps) external onlyRole(MANAGER_ROLE) {
        require(_index < strategies.length, "Invalid index");
        require(_allocationBps <= MAX_ALLOCATION_BPS, "Allocation too high");
        
        strategies[_index].allocationBps = _allocationBps;
        emit StrategyAllocationUpdated(_index, _allocationBps);
    }
    
    function rebalance() external onlyRole(MANAGER_ROLE) {
        uint256 totalAssetsValue = totalAssets();
        require(totalAssetsValue > 0, "No assets to rebalance");
        
        // Calculate target allocations
        uint256[] memory targetAmounts = new uint256[](strategies.length);
        uint256 totalAllocation = 0;
        
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active) {
                totalAllocation += strategies[i].allocationBps;
            }
        }
        
        require(totalAllocation > 0, "No active strategies");
        
        // Withdraw only from strategies without lockup (can't rebalance locked assets)
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active && !strategies[i].strategy.hasLockup()) {
                uint256 currentBalance = strategies[i].strategy.totalAssets();
                if (currentBalance > 0) {
                    strategies[i].strategy.withdraw(currentBalance);
                }
            }
            // Skip strategies with lockup - they can't be rebalanced immediately
        }
        
        // Get actual available assets (only from instant withdrawal strategies)
        uint256 availableAssets = _asset.balanceOf(address(this));
        
        // Deposit according to allocations
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active) {
                uint256 targetAmount = (availableAssets * strategies[i].allocationBps) / totalAllocation;
                if (targetAmount > 0) {
                    _asset.forceApprove(address(strategies[i].strategy), targetAmount);
                    strategies[i].strategy.deposit(targetAmount);
                }
                targetAmounts[i] = targetAmount;
            }
        }
        
        emit Rebalance(targetAmounts);
    }
    
    // ============ Withdrawal Queue ============
    
    function claimWithdrawal(uint256 requestId) external returns (uint256) {
        WithdrawalRequest memory request = pendingWithdrawals[msg.sender][requestId];
        require(request.amount > 0, "No pending withdrawal");
        require(request.strategy != address(0), "Invalid request");
        
        IUnderlyingStrategy strategy = IUnderlyingStrategy(request.strategy);
        delete pendingWithdrawals[msg.sender][requestId];
        
        uint256 claimed = strategy.claimWithdrawal(request.strategyRequestId);
        _asset.safeTransfer(msg.sender, claimed);
        
        emit WithdrawalClaimed(msg.sender, requestId, claimed);
        return claimed;
    }
    
    function getPendingWithdrawal(address user, uint256 requestId) external view returns (uint256) {
        return pendingWithdrawals[user][requestId].amount;
    }
    
    function getPendingWithdrawalInfo(address user, uint256 requestId) external view returns (
        address strategy,
        uint256 strategyRequestId,
        uint256 amount
    ) {
        WithdrawalRequest memory request = pendingWithdrawals[user][requestId];
        return (request.strategy, request.strategyRequestId, request.amount);
    }
    
    // ============ Internal Functions ============
    
    function _routeDeposit(uint256 amount) internal {
        if (strategies.length == 0) return;
        
        uint256 totalAllocation = 0;
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active) {
                totalAllocation += strategies[i].allocationBps;
            }
        }
        
        if (totalAllocation == 0) return;
        
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active) {
                uint256 depositAmount = (amount * strategies[i].allocationBps) / totalAllocation;
                if (depositAmount > 0) {
                    _asset.forceApprove(address(strategies[i].strategy), depositAmount);
                    strategies[i].strategy.deposit(depositAmount);
                }
            }
        }
    }
    
    function _handleWithdrawal(uint256 amount, address receiver) internal returns (uint256) {
        if (strategies.length == 0) {
            _asset.safeTransfer(receiver, amount);
            return amount;
        }
        
        uint256 totalAssetsValue = totalAssets();
        if (totalAssetsValue == 0) {
            _asset.safeTransfer(receiver, amount);
            return amount;
        }
        
        uint256 totalWithdrawn = 0;
        uint256 remaining = amount;
        
        // Try to withdraw from strategies without lockup first
        for (uint256 i = 0; i < strategies.length && remaining > 0; i++) {
            if (strategies[i].active) {
                uint256 strategyAssets = strategies[i].strategy.totalAssets();
                if (strategyAssets > 0) {
                    uint256 strategyShare = (amount * strategyAssets) / totalAssetsValue;
                    uint256 toWithdraw = strategyShare < remaining ? strategyShare : remaining;
                    
                    if (!strategies[i].strategy.hasLockup()) {
                        // Instant withdrawal
                        uint256 withdrawn = strategies[i].strategy.withdraw(toWithdraw);
                        totalWithdrawn += withdrawn;
                        remaining -= toWithdraw;
                    }
                }
            }
        }
        
        // If still need more, queue withdrawals from locked strategies
        if (remaining > 0) {
            for (uint256 i = 0; i < strategies.length && remaining > 0; i++) {
                if (strategies[i].active && strategies[i].strategy.hasLockup()) {
                    uint256 strategyAssets = strategies[i].strategy.totalAssets();
                    if (strategyAssets > 0) {
                        uint256 strategyShare = (amount * strategyAssets) / totalAssetsValue;
                        uint256 toWithdraw = strategyShare < remaining ? strategyShare : remaining;
                        
                        uint256 strategyRequestId = strategies[i].strategy.withdrawWithLockup(toWithdraw);
                        uint256 requestIdForUser = withdrawalRequestCount[receiver]++;
                        pendingWithdrawals[receiver][requestIdForUser] = WithdrawalRequest({
                            strategy: address(strategies[i].strategy),
                            strategyRequestId: strategyRequestId,
                            amount: toWithdraw
                        });
                        
                        emit WithdrawalQueued(receiver, requestIdForUser, address(strategies[i].strategy), toWithdraw);
                        remaining -= toWithdraw;
                    }
                }
            }
        }
        
        // Transfer instant withdrawals
        if (totalWithdrawn > 0) {
            _asset.safeTransfer(receiver, totalWithdrawn);
        }
        
        return totalWithdrawn;
    }
    
    // ============ View Functions ============
    
    function getStrategiesCount() external view returns (uint256) {
        return strategies.length;
    }
    
    function getStrategyInfo(uint256 index) external view returns (
        address strategy,
        uint256 allocationBps,
        bool active,
        uint256 totalAssetsInStrategy
    ) {
        require(index < strategies.length, "Invalid index");
        Strategy memory s = strategies[index];
        return (
            address(s.strategy),
            s.allocationBps,
            s.active,
            s.active ? s.strategy.totalAssets() : 0
        );
    }
    
    // ============ Pausable ============
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}

