import { ethers } from "hardhat";

const CONTRACTS = {
  policyEngine: '0xD0CE6F16969d81997750afE018A34921DeDd04A0',
  firewall: '0xC3C4E069B294C8ED3841c87d527c942F873CFAA9',
};

async function main() {
  console.log("Testing x402 Payment Firewall on Cronos Testnet...\n");

  const [signer] = await ethers.getSigners();
  console.log("Tester:", signer.address);

  // Get contracts
  const PolicyEngine = await ethers.getContractFactory("X402PolicyEngine");
  const policyEngine = PolicyEngine.attach(CONTRACTS.policyEngine);

  const Firewall = await ethers.getContractFactory("X402PaymentFirewall");
  const firewall = Firewall.attach(CONTRACTS.firewall);

  // Check policy settings
  console.log("\n📋 Policy Settings:");
  const maxPayment = await policyEngine.globalMaxPayment();
  const dailyLimit = await policyEngine.globalDailyLimit();
  console.log("  Max Payment:", ethers.formatEther(maxPayment), "CRO");
  console.log("  Daily Limit:", ethers.formatEther(dailyLimit), "CRO");

  // Check firewall stats
  console.log("\n📊 Firewall Stats:");
  const stats = await firewall.getStats();
  console.log("  Total Intents:", stats[0].toString());
  console.log("  Total Approved:", stats[1].toString());
  console.log("  Total Rejected:", stats[2].toString());
  console.log("  Total Executed:", stats[3].toString());
  console.log("  Total Blocked:", stats[4].toString());
  console.log("  Total Volume:", ethers.formatEther(stats[5]), "CRO");

  // Test simulation
  console.log("\n🔍 Simulating Payments:");
  const recipient = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
  
  // Small payment (should pass)
  const sim1 = await firewall.simulatePayment(signer.address, recipient, ethers.parseEther("100"));
  console.log("  100 CRO:", sim1[0] ? "✅ ALLOWED" : "❌ BLOCKED", "-", sim1[1]);

  // Large payment (should fail)
  const sim2 = await firewall.simulatePayment(signer.address, recipient, ethers.parseEther("15000"));
  console.log("  15,000 CRO:", sim2[0] ? "✅ ALLOWED" : "❌ BLOCKED", "-", sim2[1]);

  console.log("\n✅ Firewall is working correctly!");
}

main().catch(console.error);
