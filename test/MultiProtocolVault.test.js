const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

describe("MultiProtocolVault - Core Test Scenario", function () {
  let mockUSDC;
  let vault;
  let strategyA;
  let strategyB;
  let owner;
  let manager;
  let user;
  let MOCK_USDC_ADDRESS;

  const DEPLOYED_MOCK_USDC = "0x63653c34d5f96Ac0F6fb780EDd2eE9384211Fe22";

  beforeEach(async function () {
    [owner, manager, user] = await ethers.getSigners();

    const network = await ethers.provider.getNetwork();
    
    if (network.chainId === 31337n) {
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 18);
      await mockUSDC.waitForDeployment();
      MOCK_USDC_ADDRESS = await mockUSDC.getAddress();
      console.log("Deployed fresh MockUSDC for local testing at:", MOCK_USDC_ADDRESS);
      
      const decimals = await mockUSDC.decimals();
      console.log("MockUSDC decimals:", decimals.toString());
      expect(decimals).to.equal(18, "MockUSDC should have 18 decimals");
    } else {
      mockUSDC = await ethers.getContractAt("contracts/interfaces/IERC20.sol:IERC20", DEPLOYED_MOCK_USDC);
      MOCK_USDC_ADDRESS = DEPLOYED_MOCK_USDC;
      console.log("Using deployed MockUSDC at:", MOCK_USDC_ADDRESS);
      console.log("Note: MockUSDC uses 18 decimals (as per codebase)");
    }

    const MockUnderlyingStrategy = await ethers.getContractFactory("MockUnderlyingStrategy");
    
    strategyA = await MockUnderlyingStrategy.deploy(
      MOCK_USDC_ADDRESS,
      false,
      0
    );
    await strategyA.waitForDeployment();

    strategyB = await MockUnderlyingStrategy.deploy(
      MOCK_USDC_ADDRESS,
      true,
      7 * 24 * 60 * 60
    );
    await strategyB.waitForDeployment();

    const MultiProtocolVault = await ethers.getContractFactory("MultiProtocolVault");
    vault = await MultiProtocolVault.deploy(
      MOCK_USDC_ADDRESS,
      owner.address
    );
    await vault.waitForDeployment();

    await vault.grantRole(await vault.MANAGER_ROLE(), manager.address);

    await vault.connect(manager).addStrategy(await strategyA.getAddress(), 6000);
    await vault.connect(manager).addStrategy(await strategyB.getAddress(), 4000);

    if (network.chainId === 31337n) {
      await mockUSDC.mint(user.address, ethers.parseUnits("10000", 18));
      console.log("Minted 10000 USDC to user for local testing");
    } else {
      const balance = await mockUSDC.balanceOf(user.address);
      console.log("User's USDC balance on testnet:", ethers.formatEther(balance));
      if (balance < ethers.parseUnits("1000", 18)) {
        console.warn("⚠️  Warning: User may not have enough USDC. Ensure the address in .env has tokens.");
      }
    }
  });

  it("Should complete the full test scenario: Deposit -> Set Allocation -> Yield Appreciation -> Withdraw", async function () {
    const depositAmount = ethers.parseUnits("1000", 18);

    console.log("\n=== Step 1: User deposits 1000 USDC ===");
    
    await mockUSDC.connect(user).approve(await vault.getAddress(), depositAmount);
    
    const initialUserUSDC = await mockUSDC.balanceOf(user.address);
    const initialVaultAssets = await vault.totalAssets();
    
    const depositTx = await vault.connect(user).deposit(depositAmount, user.address);
    await depositTx.wait();
    
    const userUSDCAfterDeposit = await mockUSDC.balanceOf(user.address);
    
    const userShares = await vault.balanceOf(user.address);
    const vaultAssetsAfterDeposit = await vault.totalAssets();
    const userAssetsValue = await vault.convertToAssets(userShares);
    
    console.log("User shares received:", ethers.formatEther(userShares));
    console.log("Vault total assets:", ethers.formatEther(vaultAssetsAfterDeposit));
    console.log("User's assets value:", ethers.formatEther(userAssetsValue));
    
    expect(userShares).to.be.gt(0, "User should receive shares");
    expect(vaultAssetsAfterDeposit).to.be.closeTo(depositAmount, ethers.parseUnits("1", 15), "Vault should have ~1000 USDC");
    
    const strategyABalance = await strategyA.totalAssets();
    const strategyBBalance = await strategyB.totalAssets();
    console.log("Strategy A balance:", ethers.formatEther(strategyABalance));
    console.log("Strategy B balance:", ethers.formatEther(strategyBBalance));
    
    const strategyAInfo = await vault.getStrategyInfo(0);
    const strategyBInfo = await vault.getStrategyInfo(1);
    
    console.log("Strategy A allocation:", strategyAInfo.allocationBps.toString(), "bps (60%)");
    console.log("Strategy B allocation:", strategyBInfo.allocationBps.toString(), "bps (40%)");
    
    expect(strategyAInfo.allocationBps).to.equal(6000, "Strategy A should be 60%");
    expect(strategyBInfo.allocationBps).to.equal(4000, "Strategy B should be 40%");
    
    expect(strategyABalance).to.be.closeTo(ethers.parseUnits("600", 18), ethers.parseUnits("1", 18), "Strategy A should have ~600 USDC");
    expect(strategyBBalance).to.be.closeTo(ethers.parseUnits("400", 18), ethers.parseUnits("1", 18), "Strategy B should have ~400 USDC");
    
    console.log("\n=== Step 2: Allocation confirmed at 60/40 ===");
    
    console.log("\n=== Step 3: Protocol A increases by 10% ===");
    
    const strategyAAssetsBefore = await strategyA.totalAssets();
    console.log("Strategy A assets before yield:", ethers.formatEther(strategyAAssetsBefore));
    
    const yieldMultiplier = ethers.parseUnits("1.1", 18);
    await strategyA.setYieldMultiplier(yieldMultiplier);
    
    const strategyAAssetsAfter = await strategyA.totalAssets();
    const strategyBAssets = await strategyB.totalAssets();
    const totalVaultAssets = await vault.totalAssets();
    
    console.log("Strategy A assets after 10% yield:", ethers.formatEther(strategyAAssetsAfter));
    console.log("Strategy B assets:", ethers.formatEther(strategyBAssets));
    console.log("Total vault assets:", ethers.formatEther(totalVaultAssets));
    
    const expectedStrategyA = ethers.parseUnits("660", 18);
    expect(strategyAAssetsAfter).to.be.closeTo(expectedStrategyA, ethers.parseUnits("1", 18), "Strategy A should be ~660 USDC after 10% yield");
    
    const expectedTotal = ethers.parseUnits("1060", 18);
    expect(totalVaultAssets).to.be.closeTo(expectedTotal, ethers.parseUnits("1", 18), "Total vault assets should be ~1060 USDC");
    
    console.log("\n=== Step 4: Verify user's shares value ===");
    
    const userSharesAfterYield = await vault.balanceOf(user.address);
    const userAssetsValueAfterYield = await vault.convertToAssets(userSharesAfterYield);
    const expectedValue = ethers.parseUnits("1060", 18);
    
    console.log("User shares:", ethers.formatEther(userSharesAfterYield));
    console.log("User's assets value:", ethers.formatEther(userAssetsValueAfterYield));
    console.log("Expected value: ~1060 USDC");
    
    expect(userAssetsValueAfterYield).to.be.closeTo(
      expectedValue,
      ethers.parseUnits("1", 18),
      "User's shares should be worth approximately 1060 USDC"
    );
    
    console.log("\n=== Step 5: User withdraws ===");
    
    const withdrawAmount = ethers.parseUnits("500", 18);
    
    const maxWithdraw = await vault.maxWithdraw(user.address);
    console.log("Max withdrawable:", ethers.formatEther(maxWithdraw));
    
    const withdrawTx = await vault.connect(user).withdraw(withdrawAmount, user.address, user.address);
    const withdrawReceipt = await withdrawTx.wait();
    
    const withdrawalQueuedEvents = withdrawReceipt.logs.filter(
      log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed && parsed.name === "WithdrawalQueued";
        } catch {
          return false;
        }
      }
    );
    
    console.log("Withdrawal queued events:", withdrawalQueuedEvents.length);
    
    const userUSDCAfterWithdraw = await mockUSDC.balanceOf(user.address);
    const userSharesAfterWithdraw = await vault.balanceOf(user.address);
    const pendingWithdrawalCount = await vault.withdrawalRequestCount(user.address);
    
    console.log("User USDC balance after withdraw:", ethers.formatEther(userUSDCAfterWithdraw));
    console.log("User shares remaining:", ethers.formatEther(userSharesAfterWithdraw));
    console.log("Pending withdrawal requests:", pendingWithdrawalCount.toString());
    
    expect(userUSDCAfterWithdraw).to.be.gt(userUSDCAfterDeposit, "User should have received some USDC from withdrawal");
    
    const instantWithdrawn = userUSDCAfterWithdraw - userUSDCAfterDeposit;
    console.log("Instant withdrawal received:", ethers.formatEther(instantWithdrawn));
    expect(instantWithdrawn).to.be.gt(0, "User should have received instant withdrawal");
    
    if (pendingWithdrawalCount > 0n) {
      console.log("\n=== Testing withdrawal claim ===");
      
      const pendingWithdrawalInfo = await vault.getPendingWithdrawalInfo(user.address, 0);
      console.log("Pending withdrawal - Strategy:", pendingWithdrawalInfo.strategy);
      console.log("Pending withdrawal - Amount:", ethers.formatEther(pendingWithdrawalInfo.amount));
      
      const userUSDCBeforeClaim = await mockUSDC.balanceOf(user.address);
      const claimTx = await vault.connect(user).claimWithdrawal(0);
      await claimTx.wait();
      
      const userUSDCAfterClaim = await mockUSDC.balanceOf(user.address);
      const claimedAmount = userUSDCAfterClaim - userUSDCBeforeClaim;
      console.log("User USDC balance after claim:", ethers.formatEther(userUSDCAfterClaim));
      console.log("Claimed amount:", ethers.formatEther(claimedAmount));
      
      expect(userUSDCAfterClaim).to.be.gt(userUSDCBeforeClaim, "User should receive more USDC after claiming");
      expect(claimedAmount).to.be.gt(0, "Claimed amount should be positive");
    }
    
    const finalVaultAssets = await vault.totalAssets();
    const finalUserShares = await vault.balanceOf(user.address);
    const finalUserAssetsValue = await vault.convertToAssets(finalUserShares);
    
    console.log("\n=== Final State ===");
    console.log("Final vault assets:", ethers.formatEther(finalVaultAssets));
    console.log("Final user shares:", ethers.formatEther(finalUserShares));
    console.log("Final user assets value:", ethers.formatEther(finalUserAssetsValue));
    
    const totalUserUSDC = await mockUSDC.balanceOf(user.address);
    const netUSDCFromVault = totalUserUSDC - userUSDCAfterDeposit;
    const totalUserValue = netUSDCFromVault + finalUserAssetsValue;
    
    console.log("Net USDC received from vault (withdrawals - deposit):", ethers.formatEther(netUSDCFromVault));
    console.log("Total user value (withdrawn + remaining shares):", ethers.formatEther(totalUserValue));
    
    const expectedTotalValue = ethers.parseUnits("1060", 18);
    expect(totalUserValue).to.be.closeTo(
      expectedTotalValue,
      ethers.parseUnits("10", 18),
      "Total user value (withdrawn + remaining) should be approximately 1060 USDC"
    );
    
    expect(finalUserAssetsValue).to.be.gte(
      ethers.parseUnits("500", 18),
      "User should have at least 500 USDC worth remaining"
    );
    expect(finalUserAssetsValue).to.be.lte(
      ethers.parseUnits("570", 18),
      "User should have at most 570 USDC worth remaining"
    );
  });
});
