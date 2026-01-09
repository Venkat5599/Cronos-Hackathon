/**
 * x402 Intent Firewall - Middleware Core
 * 
 * Main entry point for the firewall middleware.
 * Orchestrates payment evaluation: intent analysis → risk assessment → decision.
 */

import {
  X402PaymentRequest,
  X402FirewallResponse,
  AIAgentDecision,
  PaymentDecision,
  FirewallConfig,
  UserContext,
  RecipientPolicyConfig,
} from "./types";
import { AIRiskEngine } from "./ai-engine";
import { PolicyContractClient } from "./policy-contract";

/**
 * X402 Intent Firewall Middleware
 * 
 * Core service that:
 * 1. Receives x402 payment requests
 * 2. Queries user context and policy
 * 3. Calls AI engine for intent/risk evaluation
 * 4. Records decision on-chain
 * 5. Returns structured response
 * 
 * Design principle: Composable, testable, explainable.
 * Each component (AI, contract, cache) is injected and can be mocked.
 */
export class X402IntentFirewall {
  private config: FirewallConfig;
  private aiEngine: AIRiskEngine;
  private policyClient: PolicyContractClient;
  private userContextCache: Map<string, UserContext> = new Map();

  constructor(config: FirewallConfig) {
    this.config = config;
    this.aiEngine = new AIRiskEngine(config.agent);
    this.policyClient = new PolicyContractClient(
      config.cronos.rpcUrl,
      config.cronos.policyEngineAddress,
      config.cronos.chainId
    );
  }

  /**
   * Main entry point: Process an x402 payment request
   * 
   * @param request The payment request to evaluate
   * @returns Promise of firewall response with decision and explanation
   * 
   * Flow:
   * 1. Load user context (recent history, patterns)
   * 2. Load recipient policy from contract
   * 3. Call AI engine to evaluate intent and risk
   * 4. Record decision on-chain
   * 5. Return structured response
   */
  async processPaymentRequest(
    request: X402PaymentRequest
  ): Promise<X402FirewallResponse> {
    const startTime = Date.now();

    // ========================================================================
    // STEP 1: Load User Context
    // ========================================================================
    // This includes recent payment history and behavioral patterns.
    // Used to detect anomalies and build risk assessment.
    const userContext = await this.loadOrCreateUserContext(request.sender);

    // ========================================================================
    // STEP 2: Load Recipient Policy
    // ========================================================================
    // Retrieve on-chain policy to understand hard limits for this recipient.
    const recipientPolicy = await this.policyClient.getRecipientPolicy(
      request.recipient
    );

    // ========================================================================
    // STEP 3: AI Engine Evaluation
    // ========================================================================
    // The AI agent evaluates:
    // - Intent: What is this payment for? (category, explanation, confidence)
    // - Risk: How risky is this? (anomalies, score, factors)
    // - Decision: Should we ALLOW/BLOCK/LIMIT/DELAY?
    const aiDecision = await this.aiEngine.evaluatePayment(
      request,
      userContext,
      recipientPolicy
    );

    // ========================================================================
    // STEP 4: Record Decision On-Chain
    // ========================================================================
    // All decisions are recorded on-chain for auditability and transparency.
    // Even BLOCK decisions are logged.
    let recordingTxHash: string | undefined;
    try {
      recordingTxHash = await this.policyClient.recordDecision(
        request.sender,
        request.recipient,
        request.amount,
        aiDecision.decision,
        aiDecision.reason
      );
    } catch (error) {
      console.error("Failed to record decision on-chain:", error);
      // Don't fail the entire flow if recording fails; log and continue
    }

    // ========================================================================
    // STEP 5: Update User Context
    // ========================================================================
    // If decision is ALLOW or LIMIT, add to user's payment history
    if (
      aiDecision.decision === PaymentDecision.ALLOW ||
      aiDecision.decision === PaymentDecision.LIMIT
    ) {
      this.updateUserContext(request, aiDecision);
    }

    // ========================================================================
    // STEP 6: Build Response
    // ========================================================================
    const response = this.buildResponse(request, aiDecision, recordingTxHash);

    // Log for debugging/monitoring
    console.log(
      `[X402 Firewall] ${aiDecision.decision} (${Date.now() - startTime}ms)`,
      {
        requestId: request.requestId,
        sender: request.sender,
        recipient: request.recipient,
        amount: request.amount.toString(),
        decision: aiDecision.decision,
        confidence: aiDecision.confidence,
      }
    );

    return response;
  }

  /**
   * Load user context from cache or initialize new one
   * 
   * WHY: We need to understand the user's typical behavior to detect anomalies.
   * If they typically send 10 CRO but suddenly try 1000 CRO, that's a red flag.
   * 
   * In production, this would query a database. For MVP, using in-memory cache.
   */
  private async loadOrCreateUserContext(userAddress: string): Promise<UserContext> {
    // Check cache first
    if (this.userContextCache.has(userAddress)) {
      return this.userContextCache.get(userAddress)!;
    }

    // Initialize new context (in production, fetch from DB)
    const context: UserContext = {
      address: userAddress,
      knownRecipients: new Set(),
      typicalAmount: 0n,
      typicalFrequency: 0,
      recentHistory: [],
      lastUpdated: Math.floor(Date.now() / 1000),
    };

    this.userContextCache.set(userAddress, context);
    return context;
  }

  /**
   * Update user context after a successful (or limited) payment
   * 
   * WHY: We track user behavior to improve anomaly detection over time.
   * Each approved payment helps us understand their normal patterns.
   */
  private updateUserContext(
    request: X402PaymentRequest,
    decision: AIAgentDecision
  ): void {
    const context = this.userContextCache.get(request.sender);
    if (!context) return;

    // Add to known recipients
    context.knownRecipients.add(request.recipient);

    // Add to history
    context.recentHistory.push({
      sender: request.sender,
      recipient: request.recipient,
      amount: request.amount,
      timestamp: request.timestamp,
      approved: decision.decision === PaymentDecision.ALLOW,
    });

    // Keep only last N transactions (e.g., 100)
    const maxHistory = 100;
    if (context.recentHistory.length > maxHistory) {
      context.recentHistory = context.recentHistory.slice(-maxHistory);
    }

    // Update typical amount (simple average)
    if (context.recentHistory.length > 0) {
      const total = context.recentHistory.reduce(
        (sum, tx) => sum + tx.amount,
        0n
      );
      context.typicalAmount = total / BigInt(context.recentHistory.length);
    }

    context.lastUpdated = Math.floor(Date.now() / 1000);
  }

  /**
   * Build the response object to return to x402 Facilitator
   * 
   * This response includes:
   * - Clear decision and actionable next steps
   * - Full AI reasoning (for transparency)
   * - On-chain reference (tx hash if recorded)
   */
  private buildResponse(
    request: X402PaymentRequest,
    aiDecision: AIAgentDecision,
    recordingTxHash: string | undefined
  ): X402FirewallResponse {
    // Build user-friendly message based on decision
    const message = this.buildDecisionMessage(request, aiDecision);

    const response: X402FirewallResponse = {
      requestId: request.requestId,
      decision: aiDecision.decision,
      message,
      aiDecision,
      recordingTxHash,
      respondedAt: Math.floor(Date.now() / 1000),
    };

    // Add decision-specific fields
    if (aiDecision.decision === PaymentDecision.LIMIT && aiDecision.adjustedAmount) {
      response.allowedAmount = aiDecision.adjustedAmount;
    }

    if (aiDecision.decision === PaymentDecision.DELAY && aiDecision.delayUntil) {
      response.retryAfter = aiDecision.delayUntil;
    }

    return response;
  }

  /**
   * Build human-readable message explaining the decision
   * 
   * WHY: Users need to understand why their payment was modified or blocked.
   * This message goes to the frontend and potentially to the end user.
   */
  private buildDecisionMessage(
    request: X402PaymentRequest,
    decision: AIAgentDecision
  ): string {
    switch (decision.decision) {
      case PaymentDecision.ALLOW:
        return `✓ Payment approved (Risk: ${decision.riskAssessment.level}). Intent: ${decision.intent.explanation}`;

      case PaymentDecision.BLOCK:
        return `✗ Payment blocked. Risk assessment: ${decision.riskAssessment.explanation}`;

      case PaymentDecision.LIMIT:
        return `⚠ Payment limited to ${decision.adjustedAmount} CRO due to: ${decision.reason}`;

      case PaymentDecision.DELAY:
        const retryDate = new Date((decision.delayUntil || 0) * 1000).toLocaleString();
        return `⏱ Payment delayed. Retry after ${retryDate}. Reason: ${decision.reason}`;

      default:
        return "Payment decision pending.";
    }
  }

  /**
   * Health check: Verify on-chain connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.policyClient.isAgentAuthorized();
      return true;
    } catch (error) {
      console.error("Health check failed:", error);
      return false;
    }
  }
}
