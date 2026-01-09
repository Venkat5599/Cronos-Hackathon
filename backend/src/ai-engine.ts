/**
 * AI Risk & Intent Engine
 * 
 * Evaluates x402 payments for:
 * 1. Intent: What is this payment for?
 * 2. Anomalies: Does this break user patterns?
 * 3. Risk: How suspicious is this?
 * 4. Decision: ALLOW, BLOCK, LIMIT, or DELAY?
 * 
 * This is where "AI" happens. For MVP/hackathon, we use deterministic
 * heuristics that behave like ML but are fully auditable and reproducible.
 */

import {
  X402PaymentRequest,
  AIAgentDecision,
  IntentAnalysis,
  RiskAssessment,
  RiskLevel,
  AnomalyDetection,
  PaymentDecision,
  UserContext,
  RecipientPolicyConfig,
  AgentConfig,
} from "./types";

/**
 * AI Risk Engine
 * 
 * Core decision logic. Receives request + context, returns decision with reasoning.
 * All logic is deterministic and explainable (no opaque neural networks).
 */
export class AIRiskEngine {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Main evaluation function
   * 
   * @param request The payment request
   * @param userContext User's behavior history
   * @param policy On-chain policy limits
   * @returns AI decision with full reasoning
   * 
   * Process:
   * 1. Analyze intent (what is this payment for?)
   * 2. Detect anomalies (new recipient, amount spike, frequency spike)
   * 3. Calculate risk score (combination of anomalies)
   * 4. Decide: ALLOW / BLOCK / LIMIT / DELAY
   * 5. Return decision with explanation
   */
  async evaluatePayment(
    request: X402PaymentRequest,
    userContext: UserContext,
    policy: RecipientPolicyConfig | null
  ): Promise<AIAgentDecision> {
    const now = Math.floor(Date.now() / 1000);

    // ========================================================================
    // STEP 1: Intent Analysis
    // ========================================================================
    // WHY: Intent helps us categorize the payment and understand context.
    // Example: A user sending to a known DeFi protocol has higher trust.
    const intent = this.analyzeIntent(request, userContext);

    // ========================================================================
    // STEP 2: Anomaly Detection
    // ========================================================================
    // WHY: Anomalies are the primary signal for fraud/hacks.
    // If a user typically sends 10 CRO but suddenly tries 1000, investigate.
    const anomalies = this.detectAnomalies(request, userContext);

    // ========================================================================
    // STEP 3: Risk Assessment
    // ========================================================================
    // WHY: Combine anomalies, intent, and policy into a single risk score.
    // This score drives the decision.
    const riskAssessment = this.assessRisk(
      request,
      anomalies,
      intent,
      userContext,
      policy
    );

    // ========================================================================
    // STEP 4: Make Decision
    // ========================================================================
    // WHY: Risk score maps to actions.
    // High risk → BLOCK, Medium → LIMIT, Low → ALLOW, etc.
    const decision = this.makeDecision(
      request,
      riskAssessment,
      userContext,
      policy
    );

    // ========================================================================
    // STEP 5: Build Full Decision Object
    // ========================================================================
    const aiDecision: AIAgentDecision = {
      decision: decision.decision,
      reason: decision.reason,
      adjustedAmount: decision.adjustedAmount,
      delayUntil: decision.delayUntil,
      riskAssessment,
      intent,
      anomalies,
      confidence: this.calculateConfidence(anomalies, intent, riskAssessment),
      decidedAt: now,
    };

    return aiDecision;
  }

  /**
   * Analyze payment intent
   * 
   * WHY: Understanding what a payment is for helps us trust it.
   * A payment to a user's known DeFi protocol is different from payment to random address.
   */
  private analyzeIntent(
    request: X402PaymentRequest,
    userContext: UserContext
  ): IntentAnalysis {
    // Is recipient in user's known list?
    const isKnownRecipient = userContext.knownRecipients.has(request.recipient);

    // Is there metadata that hints at intent?
    const metadata = request.metadata as Record<string, unknown> || {};
    const hintedIntent = (metadata.intent as string) || null;
    const hintedService = (metadata.service as string) || null;

    // ====== Build intent category ======
    let category = "unknown_payment";
    let explanation = "Payment to unknown recipient";
    let confidence = 30; // Low confidence without known recipient

    if (isKnownRecipient) {
      category = "recurring_payment";
      explanation = "Payment to known recipient with previous history";
      confidence = 75;
    }

    if (hintedIntent === "api_call") {
      category = "api_service";
      explanation = `API call to ${hintedService || "service"}`;
      confidence = 80;
    } else if (hintedIntent === "bulk_purchase") {
      category = "bulk_service";
      explanation = "Bulk service purchase or batch operation";
      confidence = 70;
    }

    return { category, explanation, confidence };
  }

  /**
   * Detect anomalies in the payment request
   * 
   * WHY: Anomalies are red flags. If something breaks normal patterns,
   * we should investigate further.
   * 
   * Anomalies checked:
   * - New sender (never seen before) - Only for shared state, in MVP each user is unique
   * - New recipient (user never paid to before)
   * - Amount spike (much larger than typical)
   * - Frequency spike (too many payments in short time)
   * - Known suspicious patterns
   */
  private detectAnomalies(
    request: X402PaymentRequest,
    userContext: UserContext
  ): AnomalyDetection {
    const detected: string[] = [];
    let confidence = 0;
    let context = "Normal payment patterns detected.";

    // ====== Check: New recipient ======
    const isNewRecipient = !userContext.knownRecipients.has(request.recipient);
    if (isNewRecipient && userContext.recentHistory.length > 0) {
      detected.push("new_recipient");
      confidence += 20;
      context = "Payment to previously unknown recipient.";
    }

    // ====== Check: Amount spike ======
    if (userContext.typicalAmount > 0n) {
      const amountRatio = Number(request.amount) / Number(userContext.typicalAmount);
      if (amountRatio > this.config.amountAnomalyThreshold) {
        detected.push("amount_spike");
        confidence += 30;
        context += ` Amount ${amountRatio.toFixed(1)}x typical (normal: ${userContext.typicalAmount}).`;
      }
    }

    // ====== Check: Frequency spike ======
    // Count transactions in last hour
    const oneHourAgo = request.timestamp - 3600;
    const recentCount = userContext.recentHistory.filter(
      (tx) => tx.timestamp > oneHourAgo
    ).length;

    if (
      userContext.typicalFrequency > 0 &&
      recentCount > userContext.typicalFrequency * this.config.frequencyAnomalyThreshold
    ) {
      detected.push("frequency_spike");
      confidence += 25;
      context += ` ${recentCount} transactions in last hour (unusual frequency).`;
    }

    // ====== Check: Round or suspicious amounts ======
    // Amounts like 999.99 or 1000000 might be automation or attack
    if (request.amount > 0n && request.amount % BigInt(1000) === 0n) {
      detected.push("round_amount");
      confidence += 10;
      context += " Round amount (potential automation or attack).";
    }

    return {
      detected,
      confidence: Math.min(confidence, 100),
      context,
    };
  }

  /**
   * Assess overall risk
   * 
   * Combines:
   * - Anomalies (most important)
   * - Intent confidence (if low intent confidence, increase risk)
   * - Policy violations (if amount exceeds policy max)
   * - User history length (more history = more confidence)
   * 
   * Result: Risk score 0-100 where 100 is maximum risk
   */
  private assessRisk(
    request: X402PaymentRequest,
    anomalies: AnomalyDetection,
    intent: IntentAnalysis,
    userContext: UserContext,
    policy: RecipientPolicyConfig | null
  ): RiskAssessment {
    let score = anomalies.confidence; // Start with anomaly confidence
    const factors: string[] = [...anomalies.detected];

    // ====== Adjust for intent confidence ======
    // Low intent confidence = higher risk
    if (intent.confidence < 50) {
      score += 15;
      factors.push("low_intent_confidence");
    }

    // ====== Adjust for user history length ======
    // New users are riskier
    const isNewUser = userContext.recentHistory.length === 0;
    if (isNewUser) {
      score += 20;
      factors.push("new_user");
    } else if (userContext.recentHistory.length < 5) {
      score += 10;
      factors.push("limited_history");
    }

    // ====== DEFENSIVE RULE: New user + Unknown recipient + Large amount ======
    // This is a high-risk pattern that warrants extra scrutiny
    const LARGE_AMOUNT_THRESHOLD = BigInt(10000); // 10,000 CRO
    const isUnknownRecipient = !userContext.recentHistory.some(
      (tx) => tx.recipient === request.recipient
    );
    const isLargeAmount = request.amount > LARGE_AMOUNT_THRESHOLD;

    if (isNewUser && isUnknownRecipient && isLargeAmount) {
      score += 18; // Significant increase to push into LIMIT range
      factors.push("new_user_large_unknown_payment");
    }

    // ====== Adjust for policy violations ======
    if (policy) {
      if (request.amount > policy.maxAmountPerTx) {
        score += 25;
        factors.push("exceeds_max_per_tx");
      }
      if (request.amount > policy.maxAmountPerDay / BigInt(3)) {
        score += 10;
        factors.push("high_fraction_of_daily_limit");
      }
      if (policy.isBlacklisted) {
        score = 100; // Definite block
        factors.push("recipient_blacklisted");
      }
    }

    // ====== Cap score ======
    score = Math.min(score, 100);

    // ====== Determine risk level ======
    let level: RiskLevel;
    if (score >= 80) {
      level = RiskLevel.CRITICAL;
    } else if (score >= 60) {
      level = RiskLevel.HIGH;
    } else if (score >= 40) {
      level = RiskLevel.MEDIUM;
    } else {
      level = RiskLevel.LOW;
    }

    // ====== Build explanation ======
    const explanation = this.buildRiskExplanation(score, factors, intent);

    return {
      level,
      score,
      factors,
      explanation,
    };
  }

  /**
   * Make decision: ALLOW, BLOCK, LIMIT, or DELAY
   * 
   * Maps risk score to action:
   * - CRITICAL (80+): BLOCK
   * - HIGH (60-79): LIMIT or DELAY
   * - MEDIUM (40-59): LIMIT
   * - LOW (0-39): ALLOW
   */
  private makeDecision(
    request: X402PaymentRequest,
    riskAssessment: RiskAssessment,
    userContext: UserContext,
    policy: RecipientPolicyConfig | null
  ): {
    decision: PaymentDecision;
    reason: string;
    adjustedAmount?: bigint;
    delayUntil?: number;
  } {
    const score = riskAssessment.score;

    // ====== CRITICAL RISK: BLOCK ======
    if (score >= this.config.blockThreshold) {
      return {
        decision: PaymentDecision.BLOCK,
        reason: `High-risk transaction detected (risk score: ${score}). Blocked for security. ${riskAssessment.explanation}`,
      };
    }

    // ====== HIGH RISK: LIMIT or DELAY ======
    if (score >= this.config.limitThreshold) {
      // Option 1: Limit amount
      const adjustedAmount = this.calculateAdjustedAmount(
        request.amount,
        userContext,
        policy
      );

      // Option 2: Delay payment
      // Use LIMIT for demo purposes (more transparent)
      return {
        decision: PaymentDecision.LIMIT,
        reason: `Anomaly detected (risk score: ${score}). Amount limited to ${adjustedAmount}. ${riskAssessment.explanation}`,
        adjustedAmount,
      };
    }

    // ====== MEDIUM RISK: LIMIT ======
    if (score >= this.config.delayThreshold) {
      const adjustedAmount = this.calculateAdjustedAmount(
        request.amount,
        userContext,
        policy
      );

      return {
        decision: PaymentDecision.LIMIT,
        reason: `Unusual request (risk score: ${score}). Limited to ${adjustedAmount} CRO as precaution.`,
        adjustedAmount,
      };
    }

    // ====== LOW RISK: ALLOW ======
    return {
      decision: PaymentDecision.ALLOW,
      reason: `Payment approved. Risk assessment: ${riskAssessment.level} (score: ${score}).`,
    };
  }

  /**
   * Calculate adjusted amount for LIMIT decisions
   * 
   * Strategy: Use the smaller of:
   * 1. User's typical amount (familiar)
   * 2. Policy max per transaction (enforced)
   * 3. Half of requested (conservative)
   */
  private calculateAdjustedAmount(
    requestedAmount: bigint,
    userContext: UserContext,
    policy: RecipientPolicyConfig | null
  ): bigint {
    let adjusted = requestedAmount;

    // Conservative: limit to half of requested
    adjusted = adjusted / BigInt(2);

    // Respect user's typical amount if lower
    if (userContext.typicalAmount > 0n && userContext.typicalAmount < adjusted) {
      adjusted = userContext.typicalAmount * BigInt(2); // Allow 2x typical
    }

    // Respect policy if stricter
    if (policy && policy.maxAmountPerTx < adjusted) {
      adjusted = policy.maxAmountPerTx;
    }

    return adjusted;
  }

  /**
   * Build human-readable risk explanation
   * 
   * WHY: Users need to understand why we're limiting their payment.
   */
  private buildRiskExplanation(
    score: number,
    factors: string[],
    intent: IntentAnalysis
  ): string {
    const factorStrings = factors
      .slice(0, 3) // Top 3 factors
      .map((f) => this.factorToString(f))
      .join(", ");

    return `Risk score: ${score}/100. Factors: ${factorStrings}. Intent: ${intent.category}.`;
  }

  /**
   * Convert factor code to human-readable string
   */
  private factorToString(factor: string): string {
    const map: Record<string, string> = {
      new_recipient: "new recipient",
      amount_spike: "amount spike",
      frequency_spike: "frequency spike",
      round_amount: "round amount",
      low_intent_confidence: "unclear intent",
      new_user: "new user",
      limited_history: "limited history",
      exceeds_max_per_tx: "exceeds limit",
      high_fraction_of_daily_limit: "high daily spend",
      recipient_blacklisted: "blacklisted recipient",
    };
    return map[factor] || factor;
  }

  /**
   * Calculate overall confidence in the decision
   * 
   * Factors:
   * - Anomaly confidence (higher = more certain anomalies exist)
   * - Intent confidence (higher = clearer intent)
   * - History length (more = more confident in patterns)
   */
  private calculateConfidence(
    anomalies: AnomalyDetection,
    intent: IntentAnalysis,
    risk: RiskAssessment
  ): number {
    // Average of anomaly, intent, and risk confidence
    const avg = (anomalies.confidence + intent.confidence + 50) / 3; // 50 = baseline
    return Math.round(Math.min(avg, 100));
  }
}
