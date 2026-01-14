const hre = require("hardhat");

async function main() {
  if (!process.env.PRIVATE_KEY) {
    throw new Error(
      "PRIVATE_KEY not found in .env file!\n" +
      "Please create a .env file with:\n" +
      "PRIVATE_KEY=your_private_key_here\n" +
      "SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
    );
  }
  
  if (!process.env.SEPOLIA_RPC_URL || process.env.SEPOLIA_RPC_URL.includes("YOUR_INFURA_KEY")) {
    throw new Error(
      "SEPOLIA_RPC_URL not configured!\n" +
      "Please set SEPOLIA_RPC_URL in your .env file:\n" +
      "SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
    );
  }
  
  const signers = await hre.ethers.getSigners();
  
  if (!signers || signers.length === 0) {
    throw new Error("No signers found. Please check your network configuration and private key in .env file.");
  }
  
  const deployer = signers[0];
  
  if (!deployer || !deployer.address) {
    throw new Error("Deployer account not found. Please check your PRIVATE_KEY in .env file.");
  }
  
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceEth = hre.ethers.formatEther(balance);
  console.log("Account balance:", balanceEth, "ETH");
  
  if (balance === 0n) {
    throw new Error("❌ Account has zero balance. You need Sepolia ETH for gas fees!");
  }
  
  if (parseFloat(balanceEth) < 0.01) {
    console.warn("⚠️  Warning: Account balance is very low. You may need more Sepolia ETH for gas fees!");
  }

  const MOCK_USDC = "0x63653c34d5f96Ac0F6fb780EDd2eE9384211Fe22";

  console.log("\nDeploying Mock Underlying Strategies...");
  
  const MockUnderlyingStrategy = await hre.ethers.getContractFactory("MockUnderlyingStrategy");
  
  const strategy1 = await MockUnderlyingStrategy.deploy(
    MOCK_USDC,
    false,
    0
  );
  await strategy1.waitForDeployment();
  const strategy1Address = await strategy1.getAddress();
  console.log("Strategy 1 (No Lockup) deployed to:", strategy1Address);

  const strategy2 = await MockUnderlyingStrategy.deploy(
    MOCK_USDC,
    true,
    7 * 24 * 60 * 60
  );
  await strategy2.waitForDeployment();
  const strategy2Address = await strategy2.getAddress();
  console.log("Strategy 2 (With Lockup) deployed to:", strategy2Address);

  console.log("\nDeploying Multi-Protocol Vault...");
  const MultiProtocolVault = await hre.ethers.getContractFactory("MultiProtocolVault");
  const vault = await MultiProtocolVault.deploy(
    MOCK_USDC,
    deployer.address
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("Multi-Protocol Vault deployed to:", vaultAddress);

  console.log("\nConfiguring vault strategies...");
  
  const tx1 = await vault.addStrategy(strategy1Address, 5000);
  await tx1.wait();
  console.log("Added Strategy 1 with 50% allocation");

  const tx2 = await vault.addStrategy(strategy2Address, 5000);
  await tx2.wait();
  console.log("Added Strategy 2 with 50% allocation");

  console.log("\n=== Deployment Summary ===");
  console.log("Mock USDC:", MOCK_USDC);
  console.log("Strategy 1 (No Lockup):", strategy1Address);
  console.log("Strategy 2 (With Lockup):", strategy2Address);
  console.log("Multi-Protocol Vault:", vaultAddress);
  console.log("\nSave these addresses for the UI!");

  if (process.env.ETHERSCAN_API_KEY) {
    console.log("\nWaiting for block confirmations...");
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    try {
      await hre.run("verify:verify", {
        address: strategy1Address,
        constructorArguments: [MOCK_USDC, false, 0],
      });
      console.log("Strategy 1 verified");
    } catch (e) {
      console.log("Strategy 1 verification failed:", e.message);
    }

    try {
      await hre.run("verify:verify", {
        address: strategy2Address,
        constructorArguments: [MOCK_USDC, true, 7 * 24 * 60 * 60],
      });
      console.log("Strategy 2 verified");
    } catch (e) {
      console.log("Strategy 2 verification failed:", e.message);
    }

    try {
      await hre.run("verify:verify", {
        address: vaultAddress,
        constructorArguments: [MOCK_USDC, deployer.address],
      });
      console.log("Vault verified");
    } catch (e) {
      console.log("Vault verification failed:", e.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

