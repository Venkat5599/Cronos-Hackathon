import { ethers } from "hardhat";

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║     x402 PAYMENT FIREWALL - CRONOS TESTNET DEPLOYMENT         ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "tCRO\n");

  // Deploy PolicyEngine
  console.log("1. Deploying X402PolicyEngine...");
  const PolicyEngine = await ethers.getContractFactory("X402PolicyEngine");
  const policyEngine = await PolicyEngine.deploy();
  await policyEngine.waitForDeployment();
  const policyAddr = await policyEngine.getAddress();
  console.log("   ✓ PolicyEngine:", policyAddr);

  // Deploy PaymentFirewall
  console.log("\n2. Deploying X402PaymentFirewall...");
  const Firewall = await ethers.getContractFactory("X402PaymentFirewall");
  const firewall = await Firewall.deploy(policyAddr);
  await firewall.waitForDeployment();
  const firewallAddr = await firewall.getAddress();
  console.log("   ✓ PaymentFirewall:", firewallAddr);

  // Configure policies
  console.log("\n3. Configuring policies...");
  await policyEngine.setGlobalMaxPayment(ethers.parseEther("10000"));
  console.log("   ✓ Max payment: 10,000 CRO");
  await policyEngine.setGlobalDailyLimit(ethers.parseEther("50000"));
  console.log("   ✓ Daily limit: 50,000 CRO");

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║                    DEPLOYMENT COMPLETE                        ║");
  console.log("╠═══════════════════════════════════════════════════════════════╣");
  console.log(`║ PolicyEngine:    ${policyAddr} ║`);
  console.log(`║ PaymentFirewall: ${firewallAddr} ║`);
  console.log("╠═══════════════════════════════════════════════════════════════╣");
  console.log("║ Explorer: https://cronos.org/explorer/testnet3                 ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
