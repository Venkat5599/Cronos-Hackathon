/**
 * x402 Intent Firewall - Express Server
 * 
 * HTTP API for the frontend dashboard to interact with the firewall.
 * Endpoints:
 * - POST /api/x402/simulate - Simulate a payment intent
 * - POST /api/x402/approve - Approve an intent (register on-chain)
 * - GET /api/x402/intent/:hash - Get intent status
 * - GET /api/health - Health check
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { X402IntentFirewall } from "./middleware";
import { X402PaymentRequest, FirewallConfig, PaymentDecision } from "./types";
import { ethers } from "ethers";

// ============================================================================
// CONFIGURATION
// ============================================================================

const config: FirewallConfig = {
  cronos: {
    rpcUrl: process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org",
    chainId: parseInt(process.env.CRONOS_CHAIN_ID || "338"),
    policyEngineAddress: process.env.POLICY_ENGINE_ADDRESS || "0x0000000000000000000000000000000000000000",
    gasLimit: 300000,
  },
  agent: {
    historyWindow: 100,
    amountAnomalyThreshold: 5,
    frequencyAnomalyThreshold: 3,
    blockThreshold: 80,
    limitThreshold: 40,
    delayThreshold: 40,
    defaultDelaySeconds: 300,
  },
};

// ============================================================================
// INITIALIZE
// ============================================================================

const app = express();
const firewall = new X402IntentFirewall(config);

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-sender-address'],
}));
app.use(express.json());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// TYPES
// ============================================================================

interface X402IntentPayload {
  version: string;
  intent: {
    recipient: string;
    amount: string;
    asset: string;
    chain_id: string;
    memo?: string;
    expiry?: number;
  };
  metadata: {
    origin: string;
    priority?: string;
    tags?: string[];
  };
}

interface SimulationResponse {
  intentHash: string;
  decision: string;
  riskScore: number;
  riskLevel: string;
  policyReason: string;
  estimatedGas: string;
  networkLatency: number;
  simulatedAt: number;
  intent: {
    category: string;
    explanation: string;
    confidence: number;
  };
  anomalies: string[];
  factors: string[];
  allowedAmount?: string;
  retryAfter?: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Compute intent hash (matches Solidity implementation)
 */
function computeIntentHash(
  sender: string,
  recipient: string,
  amount: bigint,
  chainId: number,
  expiry: number,
  memo: string
): string {
  const memoHash = ethers.keccak256(ethers.toUtf8Bytes(memo || ""));
  return ethers.solidityPackedKeccak256(
    ["string", "address", "address", "uint256", "uint256", "uint256", "bytes32"],
    ["x402-intent-v1", sender, recipient, amount, chainId, expiry, memoHash]
  );
}

/**
 * Convert frontend intent to internal request format
 */
function convertToRequest(
  payload: X402IntentPayload,
  sender: string
): X402PaymentRequest {
  return {
    requestId: `intent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sender,
    recipient: payload.intent.recipient,
    amount: ethers.parseEther(payload.intent.amount),
    timestamp: Math.floor(Date.now() / 1000),
    metadata: {
      intent: payload.metadata.origin,
      service: payload.intent.memo || "unknown",
      asset: payload.intent.asset,
      chainId: payload.intent.chain_id,
      priority: payload.metadata.priority,
    },
  };
}

/**
 * Estimate gas for the transaction
 */
function estimateGas(amount: bigint): string {
  // Base gas + transfer gas
  const baseGas = 21000n;
  const contractGas = 50000n;
  const totalGas = baseGas + contractGas;
  
  // Assume 5 gwei gas price on Cronos
  const gasPrice = ethers.parseUnits("5", "gwei");
  const gasCost = totalGas * gasPrice;
  
  return ethers.formatEther(gasCost);
}

// ============================================================================
// ENDPOINTS
// ============================================================================

/**
 * POST /api/x402/simulate
 * 
 * Simulate a payment intent without executing on-chain.
 * Returns decision, risk score, and policy reason.
 */
app.post("/api/x402/simulate", async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const payload: X402IntentPayload = req.body;
    
    // Validate required fields
    if (!payload.version || !payload.intent || !payload.metadata) {
      return res.status(400).json({
        error: "Invalid intent format",
        required: ["version", "intent", "metadata"],
      });
    }
    
    if (!payload.intent.recipient || !payload.intent.amount) {
      return res.status(400).json({
        error: "Missing required intent fields",
        required: ["recipient", "amount"],
      });
    }
    
    // Validate recipient address
    if (!ethers.isAddress(payload.intent.recipient)) {
      return res.status(400).json({
        error: "Invalid recipient address",
      });
    }
    
    // Validate chain ID
    const chainId = parseInt(payload.intent.chain_id);
    if (chainId !== 25 && chainId !== 338) {
      return res.status(400).json({
        error: "Invalid chain_id. Must be 25 (Cronos Mainnet) or 338 (Cronos Testnet)",
      });
    }
    
    // For demo, use a mock sender (in production, derive from auth)
    const sender = req.headers["x-sender-address"] as string || 
                   "0x1234567890123456789012345678901234567890";
    
    // Convert to internal format
    const request = convertToRequest(payload, sender);
    
    // Process through firewall
    const response = await firewall.processPaymentRequest(request);
    
    // Compute intent hash
    const expiry = payload.intent.expiry || Math.floor(Date.now() / 1000) + 3600;
    const intentHash = computeIntentHash(
      sender,
      payload.intent.recipient,
      request.amount,
      chainId,
      expiry,
      payload.intent.memo || ""
    );
    
    // Build response matching frontend expectations
    const simulationResponse: SimulationResponse = {
      intentHash,
      decision: response.decision,
      riskScore: response.aiDecision.riskAssessment.score,
      riskLevel: response.aiDecision.riskAssessment.level,
      policyReason: response.aiDecision.reason,
      estimatedGas: estimateGas(request.amount),
      networkLatency: Date.now() - startTime,
      simulatedAt: Date.now(),
      intent: {
        category: response.aiDecision.intent.category,
        explanation: response.aiDecision.intent.explanation,
        confidence: response.aiDecision.intent.confidence,
      },
      anomalies: response.aiDecision.anomalies.detected,
      factors: response.aiDecision.riskAssessment.factors,
    };
    
    // Add decision-specific fields
    if (response.decision === PaymentDecision.LIMIT && response.allowedAmount) {
      simulationResponse.allowedAmount = ethers.formatEther(response.allowedAmount);
    }
    
    if (response.decision === PaymentDecision.DELAY && response.retryAfter) {
      simulationResponse.retryAfter = response.retryAfter;
    }
    
    res.json(simulationResponse);
    
  } catch (error) {
    console.error("Simulation error:", error);
    res.status(500).json({
      error: "Simulation failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/x402/intent/:hash
 * 
 * Get the status of a registered intent.
 */
app.get("/api/x402/intent/:hash", async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    
    if (!hash || !hash.startsWith("0x")) {
      return res.status(400).json({
        error: "Invalid intent hash",
      });
    }
    
    // In production, query the X402IntentRegistry contract
    // For demo, return mock data
    res.json({
      intentHash: hash,
      status: "PENDING",
      message: "Intent registered, awaiting approval",
    });
    
  } catch (error) {
    console.error("Intent query error:", error);
    res.status(500).json({
      error: "Query failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/health
 * 
 * Health check endpoint.
 */
app.get("/api/health", async (req: Request, res: Response) => {
  try {
    const healthy = await firewall.healthCheck();
    
    res.json({
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      network: config.cronos.chainId === 25 ? "cronos-mainnet" : "cronos-testnet",
      rpcUrl: config.cronos.rpcUrl,
    });
    
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/stats
 * 
 * Get firewall statistics.
 */
app.get("/api/stats", async (req: Request, res: Response) => {
  res.json({
    totalSimulations: 0,  // Would track in production
    decisions: {
      ALLOW: 0,
      BLOCK: 0,
      LIMIT: 0,
      DELAY: 0,
    },
    averageRiskScore: 0,
    averageLatency: 0,
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║       x402 Intent Firewall - API Server                        ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Network: ${config.cronos.chainId === 25 ? "Cronos Mainnet" : "Cronos Testnet"}`);
  console.log(`RPC: ${config.cronos.rpcUrl}`);
  console.log("");
  console.log("Endpoints:");
  console.log("  POST /api/x402/simulate  - Simulate payment intent");
  console.log("  GET  /api/x402/intent/:hash - Get intent status");
  console.log("  GET  /api/health         - Health check");
  console.log("  GET  /api/stats          - Statistics");
  console.log("");
});

export default app;
