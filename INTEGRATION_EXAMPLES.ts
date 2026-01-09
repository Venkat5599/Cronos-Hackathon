/**
 * x402 Intent Firewall - Integration Examples Reference
 *
 * This file contains commented reference examples for common integration patterns.
 * For working code examples and detailed documentation, see INTEGRATION_PATTERNS.md
 */

/*
// ============================================================================
// PATTERN 1: Express.js HTTP Server
// ============================================================================

import express, { Request, Response } from "express";
import { initializeFirewall, withX402Firewall, getDefaultConfig } from "x402-firewall";

const app = express();
app.use(express.json());

const config = getDefaultConfig();
config.cronos.policyEngineAddress = process.env.POLICY_ENGINE_ADDRESS || "";
initializeFirewall(config);

app.post("/x402/evaluate", async (req: Request, res: Response) => {
  try {
    const response = await withX402Firewall(req.body);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "healthy" });
});

app.listen(3000);

// ============================================================================
// PATTERN 2: Direct Function Call
// ============================================================================

import { setupX402Firewall, withX402Firewall } from "x402-firewall";

async function example() {
  await setupX402Firewall("0x...", "https://evm-cn.cronos.org");
  const response = await withX402Firewall({...});
  console.log(response.decision);
}

// ============================================================================
// PATTERN 3: DeFi Protocol Integration
// ============================================================================

async function swapWithFirewall(request, routerAddress) {
  const decision = await withX402Firewall({...});
  if (decision.decision === "BLOCK") return { success: false };
  return { success: true, txHash: "0x..." };
}

// ============================================================================
// PATTERN 4: Batch Processing
// ============================================================================

async function processBatch(payments) {
  const results = new Map();
  for (const payment of payments) {
    const decision = await withX402Firewall(payment);
    results.set(payment.requestId, decision);
  }
  return results;
}

// ============================================================================
// PATTERN 5: Subscription Service
// ============================================================================

async function subscriptionPayment(payment) {
  const decision = await withX402Firewall({...});
  if (decision.decision === "BLOCK" || decision.decision === "LIMIT") {
    return false;
  }
  return true;
}

// ============================================================================
// PATTERN 6: React Component
// ============================================================================

function PaymentComponent() {
  const [loading, setLoading] = React.useState(false);
  const [decision, setDecision] = React.useState(null);

  const evaluate = async (request) => {
    setLoading(true);
    const response = await fetch("/api/x402/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    setDecision(await response.json());
    setLoading(false);
  };

  return <div>{decision?.message}</div>;
}

// ============================================================================
// PATTERN 7: Monitoring & Analytics
// ============================================================================

class FirewallMetrics {
  recordDecision(decision, riskScore) {
    // Track metric
  }

  getStats() {
    return {
      totalDecisions: 100,
      blockRate: "5%",
      averageRiskScore: "35.2",
    };
  }
}

*/

export const INTEGRATION_GUIDE = "See INTEGRATION_PATTERNS.md for detailed examples";
