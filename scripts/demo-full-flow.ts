/**
 * x402 Payment Firewall - Full Flow Demo
 * 
 * Demonstrates the complete payment lifecycle:
 * 1. Register intent
 * 2. Approve intent (agent)
 * 3. Execute payment
 * 
 * Usage:
 *   npx hardhat run scripts/demo-full-flow.ts --network cronos-testnet
 */

import { ethers } from "hardhat";

// Deployed contract addresses on Cronos Testnet
const POLICY_ENGINE_ADDRESS = "0xD0CE6F16969d81997750afE018A34921DeDd04A0";
const FIREWALL_ADDRESS = "0xC3C4E069B294C8ED3841c87d527c942F873CFAA9";

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║       x402 Payment Firewall - Full Flow Demo                   ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const [sender] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("Network:", network.chainId === 338n ? "Cronos Testnet" : `Chain ${network.chainId}`);
  console.log("Sender:", sender.address);
  console.log("Firewall:", FIREWALL_ADDRESS);
  console.log("PolicyEngine:", POLICY_ENGINE_ADDRESS);
  console.log("");

  // Connect to contracts
  const firewall = await ethers.getContractAt("X402PaymentFirewall", FIREWALL_ADDRESS);
  const policyEngine = await ethers.getContractAt("X402PolicyEngine", POLICY_ENGINE_ADDRESS);

  // Test recipient (use a random address for demo)
  const recipient = "0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21";

  // ========================================================================
  // DEMO 1: DIRECT PAYMENT (Policy Check Only)
  // ========================================================================
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("DEMO 1: Direct Payment (Policy Check Only)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  const amount1 = ethers.parseEther("0.001"); // 0.001 CRO

  console.log("Step 1: Simulating payment...");
  const [simAllowed, simReason] = await firewall.simulatePayment(
    sender.address,
    recipient,
    amount1
  );
  console.log("  Simulation Result:", simAllowed ? "✓ ALLOWED" : "✗ BLOCKED");
  console.log("  Reason:", simReason);
  console.log("");

  if (simAllowed) {
    console.log("Step 2: Executing direct payment...");
    try {
      const tx1 = await firewall.executePayment(recipient, { value: amount1 });
      const receipt = await tx1.wait();
      console.log("  ✓ Payment executed!");
      console.log("  TX Hash:", tx1.hash);
      console.log("  Gas Used:", receipt?.gasUsed.toString());
    } catch (error: any) {
      console.log("  ✗ Payment failed:", error.message);
    }
  }
  console.log("");

  // ========================================================================
  // DEMO 2: INTENT-BASED PAYMENT (Full Flow)
  // ========================================================================
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("DEMO 2: Intent-Based Payment (Full Flow)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  const amount2 = ethers.parseEther("0.002"); // 0.002 CRO
  const validFor = 3600; // 1 hour

  console.log("Step 1: Registering payment intent...");
  const tx2 = await firewall.registerIntent(recipient, amount2, validFor);
  const receipt2 = await tx2.wait();
  
  // Get intent hash from event
  const intentEvent = receipt2?.logs.find((log: any) => {
    try {
      const parsed = firewall.interface.parseLog({ topics: log.topics as string[], data: log.data });
      return parsed?.name === "IntentRegistered";
    } catch { return false; }
  });
  
  let intentHash: string;
  if (intentEvent) {
    const parsed = firewall.interface.parseLog({ topics: intentEvent.topics as string[], data: intentEvent.data });
    intentHash = parsed?.args[0];
    console.log("  ✓ Intent registered!");
    console.log("  Intent Hash:", intentHash);
    console.log("  TX:", tx2.hash);
  } else {
    console.log("  ✗ Could not find intent hash in events");
    return;
  }
  console.log("");

  console.log("Step 2: Checking intent status...");
  const intent = await firewall.getIntent(intentHash);
  const statusNames = ["PENDING", "APPROVED", "REJECTED", "EXECUTED", "EXPIRED", "CANCELLED"];
  console.log("  Status:", statusNames[Number(intent.status)]);
  console.log("  Amount:", ethers.formatEther(intent.amount), "CRO");
  console.log("  Recipient:", intent.recipient);
  console.log("");

  console.log("Step 3: Approving intent (as agent)...");
  const riskScore = 15; // Low risk
  const approvalReason = "Payment approved. Risk: LOW (score: 15)";
  
  try {
    const tx3 = await firewall.approveIntent(intentHash, riskScore, approvalReason);
    await tx3.wait();
    console.log("  ✓ Intent approved!");
    console.log("  Risk Score:", riskScore);
    console.log("  TX:", tx3.hash);
  } catch (error: any) {
    console.log("  ✗ Approval failed:", error.message);
    return;
  }
  console.log("");

  console.log("Step 4: Executing approved intent...");
  try {
    const tx4 = await firewall.executeIntent(intentHash, { value: amount2 });
    const receipt4 = await tx4.wait();
    console.log("  ✓ Payment executed!");
    console.log("  TX:", tx4.hash);
    console.log("  Gas Used:", receipt4?.gasUsed.toString());
  } catch (error: any) {
    console.log("  ✗ Execution failed:", error.message);
  }
  console.log("");

  // ========================================================================
  // DEMO 3: BLOCKED PAYMENT (Unapproved Intent)
  // ========================================================================
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("DEMO 3: Blocked Payment (Unapproved Intent)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  const amount3 = ethers.parseEther("0.003");

  console.log("Step 1: Registering another intent...");
  const tx5 = await firewall.registerIntent(recipient, amount3, validFor);
  const receipt5 = await tx5.wait();
  
  const intentEvent2 = receipt5?.logs.find((log: any) => {
    try {
      const parsed = firewall.interface.parseLog({ topics: log.topics as string[], data: log.data });
      return parsed?.name === "IntentRegistered";
    } catch { return false; }
  });
  
  let intentHash2: string;
  if (intentEvent2) {
    const parsed = firewall.interface.parseLog({ topics: intentEvent2.topics as string[], data: intentEvent2.data });
    intentHash2 = parsed?.args[0];
    console.log("  ✓ Intent registered (NOT approved)");
    console.log("  Intent Hash:", intentHash2);
  } else {
    return;
  }
  console.log("");

  console.log("Step 2: Attempting to execute WITHOUT approval...");
  try {
    await firewall.executeIntent(intentHash2, { value: amount3 });
    console.log("  ✗ ERROR: Should have reverted!");
  } catch (error: any) {
    console.log("  ✓ Transaction REVERTED as expected!");
    console.log("  Reason: Intent not approved - execution blocked");
  }
  console.log("");

  // ========================================================================
  // DEMO 4: REJECTED INTENT
  // ========================================================================
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("DEMO 4: Rejected Intent (High Risk)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  const amount4 = ethers.parseEther("0.004");

  console.log("Step 1: Registering high-risk intent...");
  const tx6 = await firewall.registerIntent(recipient, amount4, validFor);
  const receipt6 = await tx6.wait();
  
  const intentEvent3 = receipt6?.logs.find((log: any) => {
    try {
      const parsed = firewall.interface.parseLog({ topics: log.topics as string[], data: log.data });
      return parsed?.name === "IntentRegistered";
    } catch { return false; }
  });
  
  let intentHash3: string;
  if (intentEvent3) {
    const parsed = firewall.interface.parseLog({ topics: intentEvent3.topics as string[], data: intentEvent3.data });
    intentHash3 = parsed?.args[0];
    console.log("  ✓ Intent registered");
    console.log("  Intent Hash:", intentHash3);
  } else {
    return;
  }
  console.log("");

  console.log("Step 2: Rejecting intent (high risk detected)...");
  const highRiskScore = 85;
  const rejectReason = "High-risk: amount_spike, suspicious_pattern";
  
  try {
    const tx7 = await firewall.rejectIntent(intentHash3, highRiskScore, rejectReason);
    await tx7.wait();
    console.log("  ✓ Intent REJECTED!");
    console.log("  Risk Score:", highRiskScore);
    console.log("  Reason:", rejectReason);
  } catch (error: any) {
    console.log("  ✗ Rejection failed:", error.message);
    return;
  }
  console.log("");

  console.log("Step 3: Attempting to execute rejected intent...");
  try {
    await firewall.executeIntent(intentHash3, { value: amount4 });
    console.log("  ✗ ERROR: Should have reverted!");
  } catch (error: any) {
    console.log("  ✓ Transaction REVERTED as expected!");
    console.log("  Reason: Rejected intents cannot be executed");
  }
  console.log("");

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("                         DEMO COMPLETE                              ");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  const stats = await firewall.getStats();
  console.log("Firewall Statistics:");
  console.log("  Total Intents:", stats[0].toString());
  console.log("  Approved:", stats[1].toString());
  console.log("  Rejected:", stats[2].toString());
  console.log("  Executed:", stats[3].toString());
  console.log("  Blocked:", stats[4].toString());
  console.log("  Total Volume:", ethers.formatEther(stats[5]), "CRO");
  console.log("");

  console.log("Key Takeaways:");
  console.log("  ✓ ALLOW: Approved intents execute successfully");
  console.log("  ✓ DENY: Unapproved intents REVERT on-chain");
  console.log("  ✓ REJECT: High-risk intents are blocked by agent");
  console.log("  ✓ x402 authorization is ENFORCED at the contract level");
  console.log("");
  
  console.log("Explorer Links:");
  console.log("  Firewall: https://cronos.org/explorer/testnet3/address/" + FIREWALL_ADDRESS);
  console.log("  PolicyEngine: https://cronos.org/explorer/testnet3/address/" + POLICY_ENGINE_ADDRESS);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Demo failed:", error);
    process.exit(1);
  });
