# x402 Intent Firewall - Integration Patterns

This document contains reference code patterns for integrating the x402 Intent Firewall.
All examples are TypeScript. Adapt syntax for your framework.

## Pattern 1: Express.js HTTP Server

```typescript
import express, { Request, Response } from "express";
import {
  initializeFirewall,
  withX402Firewall,
  X402PaymentRequest,
  getDefaultConfig,
} from "x402-firewall";

const app = express();
app.use(express.json());

// Initialize on startup
const config = getDefaultConfig();
config.cronos.policyEngineAddress = process.env.POLICY_ENGINE_ADDRESS || "";
initializeFirewall(config);

// Endpoint: POST /x402/evaluate
app.post("/x402/evaluate", async (req: Request, res: Response) => {
  try {
    const request: X402PaymentRequest = {
      requestId: req.body.requestId,
      sender: req.body.sender,
      recipient: req.body.recipient,
      amount: BigInt(req.body.amount),
      timestamp: req.body.timestamp,
      metadata: req.body.metadata,
    };

    const response = await withX402Firewall(request);
    res.json(response);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Endpoint: GET /health
app.get("/health", async (req: Request, res: Response) => {
  try {
    const ready = true; // Check on-chain connectivity in production
    res.json({ status: ready ? "healthy" : "degraded" });
  } catch (error) {
    res.status(503).json({ status: "unhealthy" });
  }
});

app.listen(3000, () => {
  console.log("x402 Firewall API listening on port 3000");
});
```

## Pattern 2: Direct Function Call

```typescript
import {
  setupX402Firewall,
  withX402Firewall,
  X402PaymentRequest,
} from "x402-firewall";

async function evaluatePayment() {
  // Setup (one-time)
  await setupX402Firewall("0x...", "https://evm-cn.cronos.org");

  // Create request
  const request: X402PaymentRequest = {
    requestId: "req-001",
    sender: "0x1111111111111111111111111111111111111111",
    recipient: "0x2222222222222222222222222222222222222222",
    amount: 100n,
    timestamp: Math.floor(Date.now() / 1000),
  };

  // Evaluate
  const response = await withX402Firewall(request);

  // Handle
  switch (response.decision) {
    case "ALLOW":
      console.log("Process payment:", request.amount);
      break;
    case "LIMIT":
      console.log("Process payment with limit:", response.allowedAmount);
      break;
    case "BLOCK":
      console.log("Reject payment:", response.message);
      break;
    case "DELAY":
      console.log("Retry after:", new Date(response.retryAfter! * 1000));
      break;
  }
}
```

## Pattern 3: DeFi Protocol Integration

```typescript
import { withX402Firewall, X402PaymentRequest, PaymentDecision } from "x402-firewall";

interface TokenSwapRequest {
  userAddress: string;
  fromToken: string;
  toToken: string;
  amount: bigint;
  slippageTolerance: number;
}

async function swapTokensWithFirewall(
  request: TokenSwapRequest,
  routerAddress: string
): Promise<{ success: boolean; txHash?: string; reason?: string }> {
  // Convert swap to x402 payment for evaluation
  const paymentRequest: X402PaymentRequest = {
    requestId: `swap-${Date.now()}`,
    sender: request.userAddress,
    recipient: routerAddress,
    amount: request.amount,
    timestamp: Math.floor(Date.now() / 1000),
    metadata: {
      intent: "token_swap",
      service: "dex",
      fromToken: request.fromToken,
      toToken: request.toToken,
    },
  };

  // Evaluate through firewall
  const decision = await withX402Firewall(paymentRequest);

  // Check result
  if (decision.decision === PaymentDecision.BLOCK) {
    return {
      success: false,
      reason: `Swap blocked: ${decision.message}`,
    };
  }

  const amountToSwap =
    decision.decision === PaymentDecision.LIMIT
      ? decision.allowedAmount
      : request.amount;

  // Execute swap
  // const tx = await dex.swap({ amount: amountToSwap, ... });

  return {
    success: true,
    txHash: "0x...",
  };
}
```

## Pattern 4: Batch Payment Processing

```typescript
import { withX402Firewall, X402PaymentRequest } from "x402-firewall";

interface BatchPaymentJob {
  payments: X402PaymentRequest[];
}

async function processBatchPayments(
  job: BatchPaymentJob
): Promise<Map<string, any>> {
  const results = new Map();

  for (const payment of job.payments) {
    const decision = await withX402Firewall(payment);
    results.set(payment.requestId, {
      decision: decision.decision,
      allowedAmount: decision.allowedAmount,
      message: decision.message,
      confidence: decision.aiDecision.confidence,
    });

    console.log(
      `[Batch] ${payment.requestId}: ${decision.decision} (${decision.aiDecision.confidence}% confidence)`
    );
  }

  return results;
}
```

## Pattern 5: Subscription Payment with Firewall Protection

```typescript
import { withX402Firewall, X402PaymentRequest, PaymentDecision } from "x402-firewall";

interface SubscriptionPayment {
  userId: string;
  subscriptionId: string;
  amount: bigint;
  billingAddress: string;
  period: "monthly" | "yearly";
}

async function processSubscriptionPayment(
  payment: SubscriptionPayment
): Promise<boolean> {
  // Convert to x402 request
  const request: X402PaymentRequest = {
    requestId: `sub-${payment.subscriptionId}-${Date.now()}`,
    sender: payment.userId,
    recipient: payment.billingAddress,
    amount: payment.amount,
    timestamp: Math.floor(Date.now() / 1000),
    metadata: {
      intent: "subscription",
      service: "recurring_billing",
      period: payment.period,
    },
  };

  const decision = await withX402Firewall(request);

  // For subscriptions, be stricter (don't reduce amounts)
  if (
    decision.decision === PaymentDecision.BLOCK ||
    decision.decision === PaymentDecision.LIMIT
  ) {
    console.log(`Subscription ${payment.subscriptionId} flagged: ${decision.message}`);
    // Notify user and pause subscription
    return false;
  }

  // Process payment
  // const tx = await processPayment(payment);
  return true;
}
```

## Pattern 6: React Component Integration

```typescript
import React from "react";
import {
  withX402Firewall,
  X402PaymentRequest,
  X402FirewallResponse,
} from "x402-firewall";

interface PaymentUIState {
  loading: boolean;
  decision: string | null;
  message: string | null;
  details: any | null;
  error: string | null;
}

function usePaymentFirewall() {
  const [state, setState] = React.useState<PaymentUIState>({
    loading: false,
    decision: null,
    message: null,
    details: null,
    error: null,
  });

  const evaluatePayment = async (request: X402PaymentRequest) => {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      // Call backend endpoint (not directly from browser)
      const response = await fetch("/api/x402/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: request.requestId,
          sender: request.sender,
          recipient: request.recipient,
          amount: request.amount.toString(),
          timestamp: request.timestamp,
          metadata: request.metadata,
        }),
      });

      const data: X402FirewallResponse = await response.json();

      setState({
        loading: false,
        decision: data.decision,
        message: data.message,
        details: data.aiDecision,
        error: null,
      });
    } catch (error) {
      setState({
        loading: false,
        decision: null,
        message: null,
        details: null,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return { ...state, evaluatePayment };
}

// Usage in component
function PaymentComponent() {
  const { decision, message, details, evaluatePayment, loading } =
    usePaymentFirewall();

  const handlePayment = async () => {
    await evaluatePayment({
      requestId: "uuid-123",
      sender: "0x...",
      recipient: "0x...",
      amount: 100n,
      timestamp: Math.floor(Date.now() / 1000),
    });
  };

  return (
    <div>
      <button onClick={handlePayment} disabled={loading}>
        {loading ? "Evaluating..." : "Send Payment"}
      </button>
      {message && <p>{message}</p>}
      {details && (
        <details>
          <summary>Risk Score: {details.riskAssessment.score}/100</summary>
          <pre>{JSON.stringify(details, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
```

## Pattern 7: Monitoring & Analytics

```typescript
import { PaymentDecision } from "x402-firewall";

class FirewallMetrics {
  private decisions: Map<string, number> = new Map();
  private riskScores: number[] = [];

  recordDecision(decision: string, riskScore: number) {
    this.decisions.set(decision, (this.decisions.get(decision) || 0) + 1);
    this.riskScores.push(riskScore);
  }

  getStats() {
    const total = Array.from(this.decisions.values()).reduce((a, b) => a + b, 0);
    const avgRisk =
      this.riskScores.length > 0
        ? this.riskScores.reduce((a, b) => a + b, 0) / this.riskScores.length
        : 0;

    return {
      totalDecisions: total,
      decisions: Object.fromEntries(this.decisions),
      averageRiskScore: avgRisk.toFixed(2),
      blockRate: ((this.decisions.get("BLOCK") || 0) / total * 100).toFixed(2) + "%",
      limitRate: ((this.decisions.get("LIMIT") || 0) / total * 100).toFixed(2) + "%",
    };
  }
}

// Usage
const metrics = new FirewallMetrics();
const response = await withX402Firewall(request);
metrics.recordDecision(response.decision, response.aiDecision.riskAssessment.score);
console.log(metrics.getStats());
```

---

## Common Integration Points

| Integration | Endpoint | Purpose |
|-----------|----------|---------|
| **Payment Gateway** | POST /x402/evaluate | Evaluate before charging |
| **DeFi Protocol** | Swap/Liquidity functions | Gate access to swaps |
| **Subscription** | Recurring charge function | Protect billing |
| **API Server** | Payment middleware | Rate limiting + security |
| **Frontend** | `/api/x402/evaluate` | Show decision to user |

## Quick Setup

```typescript
// 1. Initialize (once at startup)
await setupX402Firewall("0x...", "https://evm-cn.cronos.org");

// 2. Use (in payment handler)
const response = await withX402Firewall(paymentRequest);

// 3. Act on decision
if (response.decision === "ALLOW") {
  // Process payment
} else if (response.decision === "LIMIT") {
  // Process with reduced amount
} else {
  // Handle BLOCK/DELAY
}
```

---

For more details, see [README.md](README.md) and [INTEGRATION_EXAMPLES.ts](INTEGRATION_EXAMPLES.ts)
