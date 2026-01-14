/**
 * x402 Payment Firewall - Deployment Script
 * 
 * Deploys to Cronos EVM (Testnet or Mainnet)
 * 
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network cronos-testnet
 *   npx hardhat run scripts/deploy.ts --network cronos-mainnet
 */

import { ethers } from "hardhat";

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║       x402 Payment Firewall - Cronos Deployment                ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);
  
  console.log("Deployment Configuration:");
  console.log("  Deployer:", deployer.address);
  console.log("  Network:", network.chainId === 338n ? "Cronos Testnet" : network.chainId === 25n ? "Cronos Mainnet" : `Chain ${network.chainId}`);
  console.log("  Chain ID:", network.chainId.toString());
  console.log("  Balance:", ethers.formatEther(balance), "CRO");
  console.log("");

  if (balance === 0n) {
    console.error("ERROR: Deployer has no CRO for gas!");
    console.log("Get testnet CRO from: https://cronos.org/faucet");
    process.exit(1);
  }

  // ========================================================================
  // DEPLOY X402PolicyEngine
  // ========================================================================
  console.log("Step 1: Deploying X402PolicyEngine...");
  
  const PolicyEngine = await ethers.getContractFactory("X402PolicyEngine");
  const policyEngine = await PolicyEngine.deploy();
  await policyEngine.waitForDeployment();
  
  const policyEngineAddress = await policyEngine.getAddress();
  console.log("✓ X402PolicyEngine deployed:", policyEngineAddress);

  // ========================================================================
  // DEPLOY X402ExecutionRouter
  // ========================================================================
  console.log("\nStep 2: Deploying X402ExecutionRouter...");
  
  const Router = await ethers.getContractFactory("X402ExecutionRouter");
  const router = await Router.deploy(policyEngineAddress);
  await router.waitForDeployment();
  
  const routerAddress = await router.getAddress();
  console.log("✓ X402ExecutionRouter deployed:", routerAddress);

  // ========================================================================
  // CONFIGURE DEFAULT POLICIES
  // ========================================================================
  console.log("\nStep 3: Configuring default policies...");
  
  // Set reasonable defaults
  const tx1 = await policyEngine.setGlobalMaxPayment(ethers.parseEther("10000")); // 10,000 CRO max per tx
  await tx1.wait();
  console.log("  ✓ Global max payment: 10,000 CRO");
  
  const tx2 = await policyEngine.setGlobalDailyLimit(ethers.parseEther("50000")); // 50,000 CRO daily limit
  await tx2.wait();
  console.log("  ✓ Global daily limit: 50,000 CRO");

  // ========================================================================
  // DEPLOYMENT SUMMARY
  // ========================================================================
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("                    DEPLOYMENT COMPLETE                             ");
  console.log("═══════════════════════════════════════════════════════════════════\n");
  
  console.log("Contract Addresses:");
  console.log("  X402PolicyEngine:    ", policyEngineAddress);
  console.log("  X402ExecutionRouter: ", routerAddress);
  console.log("");
  
  console.log("Network:");
  console.log("  Chain ID:", network.chainId.toString());
  console.log("  Name:", network.chainId === 338n ? "Cronos Testnet" : network.chainId === 25n ? "Cronos Mainnet" : "Unknown");
  console.log("");

  const explorerBase = network.chainId === 338n 
    ? "https://cronos.org/explorer/testnet3" 
    : "https://cronos.org/explorer";
  
  console.log("Verify on Explorer:");
  console.log(`  PolicyEngine: ${explorerBase}/address/${policyEngineAddress}`);
  console.log(`  Router:       ${explorerBase}/address/${routerAddress}`);
  console.log("");

  console.log("Environment Variables (add to .env):");
  console.log(`  POLICY_ENGINE_ADDRESS=${policyEngineAddress}`);
  console.log(`  ROUTER_ADDRESS=${routerAddress}`);
  console.log("");

  // Return addresses for programmatic use
  return {
    policyEngine: policyEngineAddress,
    router: routerAddress,
    chainId: network.chainId.toString(),
  };
}

main()
  .then((result) => {
    console.log("Deployment successful!");
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
