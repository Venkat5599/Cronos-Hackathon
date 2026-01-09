/**
 * x402 Intent Firewall - Backend Demo / Example
 * 
 * Shows how to:
 * 1. Initialize the firewall
 * 2. Create payment requests
 * 3. Process them through the middleware
 * 4. Handle decisions
 * 
 * This can be run as:
 * - npm run dev (with ts-node)
 * - Direct HTTP endpoint (add Express)
 * - WebSocket stream (add ws library)
 */

import {
  X402PaymentRequest,
  PaymentDecision,
  RiskLevel,
  FirewallConfig,
} from "./types";
import { X402IntentFirewall } from "./middleware";

/**
 * Demo application
 */
async function main() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║       x402 Intent Firewall - MVP Demo                          ║");
  console.log("║       Cronos EVM + AI-powered payment evaluation               ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  // ========================================================================
  // STEP 1: Initialize Firewall
  // ========================================================================
  console.log("Step 1: Initializing firewall...");

  const config: FirewallConfig = {
    cronos: {
      rpcUrl: "https://evm-cn.cronos.org",
      chainId: 25,
      policyEngineAddress: "0x0000000000000000000000000000000000000000", // TODO: Deploy contract
      gasLimit: 300000,
    },
    agent: {
      historyWindow: 100,
      amountAnomalyThreshold: 5,
      frequencyAnomalyThreshold: 3,
      blockThreshold: 80,
      limitThreshold: 60,
      delayThreshold: 40,
      defaultDelaySeconds: 300,
    },
  };

  const firewall = new X402IntentFirewall(config);
  console.log("✓ Firewall initialized\n");

  // ========================================================================
  // STEP 2: Simulate Payment Requests
  // ========================================================================
  console.log("Step 2: Processing payment requests...\n");

  // Request 1: Normal user, known recipient, reasonable amount
  console.log("─".repeat(70));
  console.log("TEST 1: Normal User → Known Recipient");
  console.log("─".repeat(70));
  const request1: X402PaymentRequest = {
    requestId: "req-001",
    sender: "0x1234567890123456789012345678901234567890",
    recipient: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", // Known DeFi protocol
    amount: 100n, // 100 CRO in wei
    timestamp: Math.floor(Date.now() / 1000),
    metadata: {
      intent: "api_call",
      service: "data_oracle",
    },
  };

  const response1 = await firewall.processPaymentRequest(request1);
  printResponse(response1);
  console.log();

  // Request 2: New user to unfamiliar recipient with large amount
  console.log("─".repeat(70));
  console.log("TEST 2: New User → Unknown Recipient + Amount Spike");
  console.log("─".repeat(70));
  const request2: X402PaymentRequest = {
    requestId: "req-002",
    sender: "0x9999999999999999999999999999999999999999",
    recipient: "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead", // Unknown address
    amount: 50000n, // Very large amount
    timestamp: Math.floor(Date.now() / 1000),
    metadata: {
      intent: "bulk_purchase",
      service: "unknown_service",
    },
  };

  const response2 = await firewall.processPaymentRequest(request2);
  printResponse(response2);
  console.log();

  // Request 3: Round amount from new user (suspicious pattern)
  console.log("─".repeat(70));
  console.log("TEST 3: New User + Round Amount (Suspicious Pattern)");
  console.log("─".repeat(70));
  const request3: X402PaymentRequest = {
    requestId: "req-003",
    sender: "0x7777777777777777777777777777777777777777",
    recipient: "0x5555555555555555555555555555555555555555",
    amount: 1000000n, // Round amount (1M)
    timestamp: Math.floor(Date.now() / 1000),
    metadata: {},
  };

  const response3 = await firewall.processPaymentRequest(request3);
  printResponse(response3);
  console.log();

  // Request 4: Same user as request1 with moderate increase
  console.log("─".repeat(70));
  console.log("TEST 4: Repeat User with Gradual Amount Increase");
  console.log("─".repeat(70));
  const request4: X402PaymentRequest = {
    requestId: "req-004",
    sender: "0x1234567890123456789012345678901234567890", // Same as request1
    recipient: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", // Same recipient
    amount: 250n, // 250 CRO (2.5x the previous 100)
    timestamp: Math.floor(Date.now() / 1000) + 3600, // 1 hour later
    metadata: {
      intent: "api_call",
      service: "data_oracle",
    },
  };

  const response4 = await firewall.processPaymentRequest(request4);
  printResponse(response4);
  console.log();

  // ========================================================================
  // STEP 3: Summary
  // ========================================================================
  console.log("═".repeat(70));
  console.log("DEMO COMPLETE");
  console.log("═".repeat(70));
  console.log(`Processed ${[response1, response2, response3, response4].length} requests`);
  console.log(`Decisions: ` + [response1, response2, response3, response4]
    .map((r) => r.decision)
    .join(" | "));
  console.log();
  console.log("Key Takeaways:");
  console.log("✓ AI engine detected anomalies (new user, amount spike, etc)");
  console.log("✓ Decisions are explainable with risk scores and factors");
  console.log("✓ On-chain recording prepared (ready for actual deployment)");
  console.log("✓ User context learns from interactions");
  console.log();
}

/**
 * Pretty-print a firewall response
 */
function printResponse(response: any) {
  const decision = response.decision;
  const icon =
    decision === PaymentDecision.ALLOW ? "✓ " :
    decision === PaymentDecision.BLOCK ? "✗ " :
    decision === PaymentDecision.LIMIT ? "⚠ " :
    "⏱ ";

  console.log(`${icon}Decision: ${decision}`);
  console.log(`   Message: ${response.message}`);
  console.log();
  console.log("   AI Reasoning:");
  const { riskAssessment, intent, anomalies, confidence } = response.aiDecision;
  console.log(`   - Risk Level: ${riskAssessment.level} (score: ${riskAssessment.score}/100)`);
  console.log(`   - Risk Factors: ${riskAssessment.factors.slice(0, 3).join(", ") || "none"}`);
  console.log(`   - Intent: ${intent.category} (${intent.confidence}% confidence)`);
  console.log(`   - Anomalies: ${anomalies.detected.length === 0 ? "none" : anomalies.detected.join(", ")}`);
  console.log(`   - Overall Confidence: ${confidence}%`);

  if (response.allowedAmount) {
    console.log(`   - Adjusted Amount: ${response.allowedAmount}`);
  }

  if (response.recordingTxHash) {
    console.log(`   - Recording TX: ${response.recordingTxHash}`);
  }
}

// ============================================================================
// Run the demo
// ============================================================================
main().catch((error) => {
  console.error("Demo failed:", error);
  process.exit(1);
});
