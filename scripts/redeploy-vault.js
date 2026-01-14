const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Redeploying vault with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

  const MOCK_USDC = "0x63653c34d5f96Ac0F6fb780EDd2eE9384211Fe22";
  const STRATEGY1_ADDRESS = "0x1C451023E4b66a941DE7Cf28b286F215d7c2CbD6";
  const STRATEGY2_ADDRESS = "0x2e2B23916Ec9b97e43171aA4B35721F2dBd73fFF";

  console.log("\nDeploying updated Multi-Protocol Vault...");
  const MultiProtocolVault = await hre.ethers.getContractFactory("MultiProtocolVault");
  const vault = await MultiProtocolVault.deploy(
    MOCK_USDC,
    deployer.address
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("New Multi-Protocol Vault deployed to:", vaultAddress);

  console.log("\nConfiguring vault strategies...");
  
  const tx1 = await vault.addStrategy(STRATEGY1_ADDRESS, 5000);
  await tx1.wait();
  console.log("Added Strategy 1 with 50% allocation");

  const tx2 = await vault.addStrategy(STRATEGY2_ADDRESS, 5000);
  await tx2.wait();
  console.log("Added Strategy 2 with 50% allocation");

  console.log("\n=== Redeployment Summary ===");
  console.log("Mock USDC:", MOCK_USDC);
  console.log("Strategy 1 (No Lockup):", STRATEGY1_ADDRESS, "(unchanged)");
  console.log("Strategy 2 (With Lockup):", STRATEGY2_ADDRESS, "(unchanged)");
  console.log("NEW Multi-Protocol Vault:", vaultAddress);
  console.log("\n⚠️  IMPORTANT: Update the vault address in your frontend!");
  console.log("Update frontend/src/App.jsx with new vault address:", vaultAddress);

  if (process.env.ETHERSCAN_API_KEY) {
    console.log("\nWaiting for block confirmations...");
    await new Promise(resolve => setTimeout(resolve, 30000));
    
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

