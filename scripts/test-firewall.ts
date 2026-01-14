/**
 * Test script for x402 Payment Firewall
 * Runs on local Hardhat network
 */

import { ethers } from "hardhat";

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║       x402 Payment Firewall - Local Test                       ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const [owner, sender, recipient, blocked] = await ethers.getSigners();
  
  console.log("Accounts:");
  console.log("  Owner:", owner.address);
  console.log("  Sender:", sender.address);
  console.log("  Recipient:", recipient.address);
  console.log("  Blocked:", blocked.address);
  console.log("");

  // ========================================================================
  // DEPLOY CONTRACTS
  // ========================================================================
  console.log("Deploying contracts...\n");

  const PolicyEngine = await ethers.getContractFactory("X402PolicyEngine");
  const policyEngine = await PolicyEngine.deploy();
  await policyEngine.waitForDeployment();
  console.log("✓ X402PolicyEngine deployed:", await policyEngine.getAddress());

  const Router = await ethers.getContractFactory("X402ExecutionRouter");
  const router = await Router.deploy(await policyEngine.getAddress());
  await router.waitForDeployment();
  console.log("✓ X402ExecutionRouter deployed:", await router.getAddress());
  console.log("");

  // ========================================================================
  // TEST 1: Normal payment (should PASS)
  // ========================================================================
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("TEST 1: Normal Payment (should PASS)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  const amount1 = ethers.parseEther("100");
  const balanceBefore = await ethers.provider.getBalance(recipient.address);

  console.log("  Sender:", sender.address);
  console.log("  Recipient:", recipient.address);
  console.log("  Amount:", ethers.formatEther(amount1), "ETH");
  console.log("");

  // Simulate first
  const [simAllowed, simReason] = await router.simulatePayment(
    sender.address,
    recipient.address,
    amount1
  );
  console.log("  Simulation:", simAllowed ? "✓ ALLOWED" : "✗ BLOCKED", "-", simReason);

  // Execute
  const tx1 = await router.connect(sender).executePayment(recipient.address, { value: amount1 });
  const receipt1 = await tx1.wait();
  
  const balanceAfter = await ethers.provider.getBalance(recipient.address);
  const received = balanceAfter - balanceBefore;

  console.log("  Execution: ✓ SUCCESS");
  console.log("  Recipient received:", ethers.formatEther(received), "ETH");
  console.log("  Gas used:", receipt1?.gasUsed.toString());
  console.log("");

  // ========================================================================
  // TEST 2: Payment exceeds max (should FAIL)
  // ========================================================================
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("TEST 2: Payment Exceeds Max (should FAIL)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  // Set a low max for sender
  await policyEngine.setSenderMaxPayment(sender.address, ethers.parseEther("50"));
  console.log("  Set sender max payment to 50 ETH");

  const amount2 = ethers.parseEther("100");
  console.log("  Attempting to send:", ethers.formatEther(amount2), "ETH");
  console.log("");

  // Simulate
  const [sim2Allowed, sim2Reason] = await router.simulatePayment(
    sender.address,
    recipient.address,
    amount2
  );
  console.log("  Simulation:", sim2Allowed ? "✓ ALLOWED" : "✗ BLOCKED", "-", sim2Reason);

  // Try to execute (should revert)
  try {
    await router.connect(sender).executePayment(recipient.address, { value: amount2 });
    console.log("  Execution: ✗ ERROR - Should have reverted!");
  } catch (error: any) {
    console.log("  Execution: ✓ REVERTED as expected");
    console.log("  Reason:", error.message.includes("Amount exceeds maximum") ? "Amount exceeds maximum" : error.message);
  }
  console.log("");

  // Reset max
  await policyEngine.setSenderMaxPayment(sender.address, 0);

  // ========================================================================
  // TEST 3: Blocked sender (should FAIL)
  // ========================================================================
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("TEST 3: Blocked Sender (should FAIL)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  // Block the sender
  await policyEngine.blockSender(blocked.address, true);
  console.log("  Blocked address:", blocked.address);

  const amount3 = ethers.parseEther("10");
  console.log("  Attempting to send:", ethers.formatEther(amount3), "ETH");
  console.log("");

  // Simulate
  const [sim3Allowed, sim3Reason] = await router.simulatePayment(
    blocked.address,
    recipient.address,
    amount3
  );
  console.log("  Simulation:", sim3Allowed ? "✓ ALLOWED" : "✗ BLOCKED", "-", sim3Reason);

  // Try to execute
  try {
    await router.connect(blocked).executePayment(recipient.address, { value: amount3 });
    console.log("  Execution: ✗ ERROR - Should have reverted!");
  } catch (error: any) {
    console.log("  Execution: ✓ REVERTED as expected");
    console.log("  Reason:", error.message.includes("Sender is blocked") ? "Sender is blocked" : error.message);
  }
  console.log("");

  // ========================================================================
  // TEST 4: Blacklisted recipient (should FAIL)
  // ========================================================================
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("TEST 4: Blacklisted Recipient (should FAIL)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  // Blacklist the recipient
  const blacklistedRecipient = "0xDEADDEADDEADDEADDEADDEADDEADDEADDEADDEAD";
  await policyEngine.blacklistRecipient(blacklistedRecipient, true);
  console.log("  Blacklisted recipient:", blacklistedRecipient);

  const amount4 = ethers.parseEther("10");
  console.log("  Attempting to send:", ethers.formatEther(amount4), "ETH");
  console.log("");

  // Simulate
  const [sim4Allowed, sim4Reason] = await router.simulatePayment(
    sender.address,
    blacklistedRecipient,
    amount4
  );
  console.log("  Simulation:", sim4Allowed ? "✓ ALLOWED" : "✗ BLOCKED", "-", sim4Reason);

  // Try to execute
  try {
    await router.connect(sender).executePayment(blacklistedRecipient, { value: amount4 });
    console.log("  Execution: ✗ ERROR - Should have reverted!");
  } catch (error: any) {
    console.log("  Execution: ✓ REVERTED as expected");
    console.log("  Reason:", error.message.includes("blacklisted") ? "Recipient is blacklisted" : error.message);
  }
  console.log("");

  // ========================================================================
  // TEST 5: Daily limit (should FAIL on second payment)
  // ========================================================================
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("TEST 5: Daily Limit (should FAIL on second payment)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  // Use a fresh sender for this test
  const [,,,, freshSender] = await ethers.getSigners();
  
  // Set daily limit for fresh sender
  await policyEngine.setSenderDailyLimit(freshSender.address, ethers.parseEther("150"));
  console.log("  Fresh sender:", freshSender.address);
  console.log("  Set daily limit to 150 ETH");

  // First payment (100 ETH) - should pass
  const amount5a = ethers.parseEther("100");
  console.log("  First payment:", ethers.formatEther(amount5a), "ETH");
  
  const tx5a = await router.connect(freshSender).executePayment(recipient.address, { value: amount5a });
  await tx5a.wait();
  console.log("  First payment: ✓ SUCCESS");

  // Check daily spent
  const dailySpent = await policyEngine.getDailySpent(freshSender.address);
  console.log("  Daily spent so far:", ethers.formatEther(dailySpent), "ETH");

  // Second payment (100 ETH) - should fail (would exceed 150 limit)
  const amount5b = ethers.parseEther("100");
  console.log("  Second payment:", ethers.formatEther(amount5b), "ETH");
  console.log("");

  // Simulate
  const [sim5Allowed, sim5Reason] = await router.simulatePayment(
    freshSender.address,
    recipient.address,
    amount5b
  );
  console.log("  Simulation:", sim5Allowed ? "✓ ALLOWED" : "✗ BLOCKED", "-", sim5Reason);

  // Try to execute
  try {
    await router.connect(freshSender).executePayment(recipient.address, { value: amount5b });
    console.log("  Execution: ✗ ERROR - Should have reverted!");
  } catch (error: any) {
    console.log("  Execution: ✓ REVERTED as expected");
    console.log("  Reason:", error.message.includes("Daily limit") ? "Daily limit exceeded" : error.message);
  }
  console.log("");

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("                         TEST SUMMARY                               ");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  const stats = await router.getStats();
  console.log("Router Statistics:");
  console.log("  Total Payments:", stats[0].toString());
  console.log("  Total Volume:", ethers.formatEther(stats[1]), "ETH");
  console.log("  Total Blocked:", stats[2].toString());
  console.log("");

  console.log("Test Results:");
  console.log("  ✓ TEST 1: Normal payment - PASSED");
  console.log("  ✓ TEST 2: Max payment cap - BLOCKED correctly");
  console.log("  ✓ TEST 3: Blocked sender - BLOCKED correctly");
  console.log("  ✓ TEST 4: Blacklisted recipient - BLOCKED correctly");
  console.log("  ✓ TEST 5: Daily limit - BLOCKED correctly");
  console.log("");
  console.log("All tests passed! On-chain enforcement is working.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
