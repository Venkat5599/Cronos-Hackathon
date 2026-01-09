/**
 * x402 Intent Firewall - Developer SDK
 * 
 * Single-function integration for any Cronos dApp.
 * One import, one call, full payment protection.
 */

import type {
  X402PaymentRequest,
  X402FirewallResponse,
  FirewallConfig,
} from "../backend/src/types";

/**
 * Global firewall instance
 * Initialized once on first use
 */
let firewallInstance: any | null = null;

/**
 * Initialize the firewall
 * 
 * Call this once at application startup.
 * 
 * @param config Firewall configuration
 * 
 * Example:
 * ```typescript
 * initializeFirewall({
 *   cronos: {
 *     rpcUrl: "https://evm.cronos.org",
 *     chainId: 25,
 *     policyEngineAddress: "0x...",
 *     gasLimit: 300000,
 *   },
 *   agent: {
 *     historyWindow: 100,
 *     amountAnomalyThreshold: 5,
 *     frequencyAnomalyThreshold: 3,
 *     blockThreshold: 80,
 *     limitThreshold: 60,
 *     delayThreshold: 40,
 *     defaultDelaySeconds: 300,
 *   },
 * });
 * ```
 */
export function initializeFirewall(config: FirewallConfig): void {
  // Dynamic require to avoid circular dependencies
  // In production, use proper module resolution
  const { X402IntentFirewall } = require("../backend/src/middleware");
  firewallInstance = new X402IntentFirewall(config);
  console.log("[x402 Firewall] Initialized successfully");
}

/**
 * THE main function developers use
 * 
 * Wrap any x402 payment request with this function.
 * Returns a decision (ALLOW/BLOCK/LIMIT/DELAY) with reasoning.
 * 
 * @param request The x402 payment request to evaluate
 * @returns Firewall response with decision
 * @throws Error if firewall not initialized
 * 
 * Example usage:
 * ```typescript
 * // User tries to pay for an API call
 * const paymentRequest: X402PaymentRequest = {
 *   requestId: "uuid-123",
 *   sender: "0x...",
 *   recipient: "0x...",
 *   amount: 1000n,
 *   timestamp: Math.floor(Date.now() / 1000),
 *   metadata: { intent: "api_call", service: "data_oracle" },
 * };
 * 
 * // Pass through firewall
 * const decision = await withX402Firewall(paymentRequest);
 * 
 * // Decision will be one of:
 * // {
 * //   decision: "ALLOW",
 * //   message: "✓ Payment approved (Risk: LOW)",
 * //   aiDecision: { ... full AI reasoning ... },
 * // }
 * // 
 * // OR
 * // {
 * //   decision: "LIMIT",
 * //   message: "⚠ Payment limited to 500 CRO due to: new recipient",
 * //   allowedAmount: 500n,
 * //   aiDecision: { ... full AI reasoning ... },
 * // }
 * ```
 */
export async function withX402Firewall(
  request: X402PaymentRequest
): Promise<X402FirewallResponse> {
  if (!firewallInstance) {
    throw new Error(
      "Firewall not initialized. Call initializeFirewall() first."
    );
  }

  return firewallInstance.processPaymentRequest(request);
}

/**
 * Check firewall health (on-chain connectivity)
 * 
 * @returns True if firewall is healthy
 * 
 * Use this in startup or periodic health checks.
 */
export async function checkFirewallHealth(): Promise<boolean> {
  if (!firewallInstance) {
    return false;
  }
  return firewallInstance.healthCheck();
}

/**
 * Get default configuration
 * 
 * Useful for quick setup. Customize before passing to initializeFirewall().
 * 
 * @returns Default FirewallConfig
 */
export function getDefaultConfig(): FirewallConfig {
  return {
    cronos: {
      rpcUrl: "https://evm-cn.cronos.org", // Cronos mainnet RPC
      chainId: 25,
      policyEngineAddress: "0x0000000000000000000000000000000000000000", // TODO: Deploy and set
      gasLimit: 300000,
    },
    agent: {
      // AI Engine parameters
      historyWindow: 100, // Analyze last 100 transactions
      amountAnomalyThreshold: 5, // Amount > 5x typical = anomaly
      frequencyAnomalyThreshold: 3, // Frequency > 3x typical = anomaly
      blockThreshold: 80, // Risk score >= 80 = BLOCK
      limitThreshold: 60, // Risk score >= 60 = LIMIT
      delayThreshold: 40, // Risk score >= 40 = DELAY, else ALLOW
      defaultDelaySeconds: 300, // 5 minutes default delay
    },
  };
}

/**
 * Developer-friendly factory function
 * 
 * One-liner setup for demos/hackathons.
 * 
 * @param contractAddress Address of deployed X402PolicyEngine
 * @param rpcUrl Optional custom RPC URL
 * 
 * Example:
 * ```typescript
 * await setupX402Firewall("0x...", "https://evm-cn.cronos.org");
 * // Now ready to use withX402Firewall()
 * ```
 */
export async function setupX402Firewall(
  contractAddress: string,
  rpcUrl?: string
): Promise<void> {
  const config = getDefaultConfig();
  config.cronos.policyEngineAddress = contractAddress;
  if (rpcUrl) {
    config.cronos.rpcUrl = rpcUrl;
  }

  initializeFirewall(config);

  // Verify health
  const healthy = await checkFirewallHealth();
  if (!healthy) {
    console.warn("[x402 Firewall] Warning: Health check failed");
  }
}

/**
 * Export types for type safety
 * 
 * Developers can import these for proper typing:
 * ```typescript
 * import {
 *   X402PaymentRequest,
 *   X402FirewallResponse,
 *   PaymentDecision,
 *   RiskLevel,
 * } from "x402-firewall/sdk";
 * ```
 */
export type {
  X402PaymentRequest,
  X402FirewallResponse,
  PaymentDecision,
  RiskLevel,
  AIAgentDecision,
  FirewallConfig,
} from "../backend/src/types";
