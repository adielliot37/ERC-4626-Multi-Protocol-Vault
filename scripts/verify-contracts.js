const hre = require("hardhat");

async function main() {
  if (!process.env.ETHERSCAN_API_KEY) {
    throw new Error("ETHERSCAN_API_KEY not found in .env file!");
  }

  const MOCK_USDC = "0x63653c34d5f96Ac0F6fb780EDd2eE9384211Fe22";
  const STRATEGY1_ADDRESS = "0xa0532ac24813E2a04594b9554f2D73b44640c7a4";
  const STRATEGY2_ADDRESS = "0x4AC1201EE7BF886EfdFA7d4d19678B536Ff0c35a";
  const VAULT_ADDRESS = "0xE16B4cCD109649DdcA66c50Bb627F77c4a96e77c";

  const [deployer] = await hre.ethers.getSigners();
  console.log("Verifying contracts with account:", deployer.address);

  console.log("\nWaiting for block confirmations...");
  await new Promise(resolve => setTimeout(resolve, 30000));

  try {
    console.log("\nVerifying Strategy 1...");
    await hre.run("verify:verify", {
      address: STRATEGY1_ADDRESS,
      constructorArguments: [MOCK_USDC, false, 0],
    });
    console.log("Strategy 1 verified successfully");
  } catch (e) {
    console.log("Strategy 1 verification failed:", e.message);
  }

  try {
    console.log("\nVerifying Strategy 2...");
    await hre.run("verify:verify", {
      address: STRATEGY2_ADDRESS,
      constructorArguments: [MOCK_USDC, true, 7 * 24 * 60 * 60],
    });
    console.log("Strategy 2 verified successfully");
  } catch (e) {
    console.log("Strategy 2 verification failed:", e.message);
  }

  try {
    console.log("\nVerifying Vault...");
    await hre.run("verify:verify", {
      address: VAULT_ADDRESS,
      constructorArguments: [MOCK_USDC, deployer.address],
    });
    console.log("Vault verified successfully");
  } catch (e) {
    console.log("Vault verification failed:", e.message);
  }

  console.log("\n=== Verification Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

