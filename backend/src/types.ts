/**
 * x402 Intent Firewall - Core Type Definitions
 * 
 * Defines the contract between the middleware, AI agent, and policy engine.
 * All types are explicit and enforced at compile time.
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Payment decision outcomes from the AI agent.
 * - ALLOW: Proceed with payment as requested
 * - BLOCK: Reject the payment entirely
 * - LIMIT: Reduce amount to a safe level
 * - DELAY: Postpone payment until a future time
 */
export enum PaymentDecision {
  ALLOW = "ALLOW",
  BLOCK = "BLOCK",
  LIMIT = "LIMIT",
  DELAY = "DELAY",
}

/**
 * Risk level classifications from the AI engine.
 * Used to guide decision-making and provide explainability.
 */
export enum RiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * X402 Payment Request
 * 
 * Incoming payment request before any processing.
 * Assumed to come from the x402 Facilitator or compatible source.
 */
export interface X402PaymentRequest {
  /**
   * Unique identifier for this payment intent
   * Format: uuid or txid from x402 facilitator
   */
  requestId: string;

  /**
   * Wallet address sending the payment (user)
   */
  sender: string;

  /**
   * Service/contract address receiving the payment
   */
  recipient: string;

  /**
   * Amount in the smallest unit (wei equivalent for Cronos)
   * Typically CRO in wei
   */
  amount: bigint;

  /**
   * Timestamp when this request was created (seconds)
   */
  timestamp: number;

  /**
   * Optional metadata for additional context
   * Examples: { intent: "api_call", service: "data_query" }
   */
  metadata?: Record<string, unknown>;
}

/**
 * Anomaly Detection Result
 * 
 * Captured anomalies that may indicate suspicious activity.
 * Used by the AI engine to inform risk assessment.
 */
export interface AnomalyDetection {
  /**
   * Array of detected anomalies
   * Examples: "new_sender", "amount_spike", "frequency_spike", "known_fraud"
   */
  detected: string[];

  /**
   * Confidence score for anomaly detection (0-100)
   * Higher = more confident an anomaly exists
   */
  confidence: number;

  /**
   * Historical context for comparison
   * Example: "Typical spend: 10 CRO, current: 500 CRO (50x increase)"
   */
  context: string;
}

/**
 * Intent Analysis Result
 * 
 * AI agent's understanding of the payment's purpose.
 * Helps categorize and explain decisions.
 */
export interface IntentAnalysis {
  /**
   * Inferred intent category
   * Examples: "normal_api_call", "bulk_service", "automated_subscription"
   */
  category: string;

  /**
   * Natural language explanation of what the payment appears to be for
   */
  explanation: string;

  /**
   * Confidence in the intent classification (0-100)
   */
  confidence: number;
}

/**
 * Risk Assessment from AI Engine
 * 
 * Comprehensive evaluation combining anomalies, intent, and historical data.
 */
export interface RiskAssessment {
  /**
   * Overall risk level
   */
  level: RiskLevel;

  /**
   * Risk score (0-100 where 100 is maximum risk)
   */
  score: number;

  /**
   * Key factors that contributed to the risk assessment
   * Examples: "new_sender", "amount_exceeds_normal", "frequency_spike"
   */
  factors: string[];

  /**
   * Human-readable explanation of the risk
   */
  explanation: string;
}

/**
 * AI Agent Decision
 * 
 * Output from the AI engine with full context for explainability.
 */
export interface AIAgentDecision {
  /**
   * Final decision on the payment
   */
  decision: PaymentDecision;

  /**
   * Why the decision was made (for UI, logging, transparency)
   */
  reason: string;

  /**
   * If decision is LIMIT, the recommended maximum amount
   */
  adjustedAmount?: bigint;

  /**
   * If decision is DELAY, timestamp when payment can be retried
   */
  delayUntil?: number;

  /**
   * Risk assessment that informed this decision
   */
  riskAssessment: RiskAssessment;

  /**
   * Intent analysis
   */
  intent: IntentAnalysis;

  /**
   * Anomalies detected in this request
   */
  anomalies: AnomalyDetection;

  /**
   * Confidence in this decision (0-100)
   */
  confidence: number;

  /**
   * Timestamp when decision was made
   */
  decidedAt: number;
}

/**
 * Middleware Response to x402 Facilitator
 * 
 * This is what the firewall returns after evaluating and deciding on a payment.
 */
export interface X402FirewallResponse {
  /**
   * Reference to the original request
   */
  requestId: string;

  /**
   * The final decision
   */
  decision: PaymentDecision;

  /**
   * User-friendly explanation
   */
  message: string;

  /**
   * If LIMIT, the adjusted amount allowed
   */
  allowedAmount?: bigint;

  /**
   * If DELAY, when to retry (Unix timestamp)
   */
  retryAfter?: number;

  /**
   * Full AI decision data (for transparency/logging)
   * Can be exposed to frontend for explainability
   */
  aiDecision: AIAgentDecision;

  /**
   * On-chain transaction hash if decision was recorded
   * (empty until tx is confirmed)
   */
  recordingTxHash?: string;

  /**
   * Timestamp of response
   */
  respondedAt: number;
}

/**
 * Payment History Entry
 * 
 * Stored record of a user's past payments to a recipient.
 * Used to detect patterns and anomalies.
 */
export interface PaymentHistoryEntry {
  /**
   * Address of sender
   */
  sender: string;

  /**
   * Address of recipient
   */
  recipient: string;

  /**
   * Amount in smallest unit
   */
  amount: bigint;

  /**
   * Timestamp of payment (Unix seconds)
   */
  timestamp: number;

  /**
   * Was this payment approved?
   */
  approved: boolean;
}

/**
 * Recipient Policy Configuration
 * 
 * On-chain policy for a specific recipient.
 * Defines hard limits that the contract enforces.
 */
export interface RecipientPolicyConfig {
  /**
   * Address of the recipient
   */
  recipient: string;

  /**
   * Maximum CRO per single transaction (in wei)
   */
  maxAmountPerTx: bigint;

  /**
   * Maximum CRO per calendar day (in wei)
   */
  maxAmountPerDay: bigint;

  /**
   * Minimum delay required between payments to this recipient (seconds)
   */
  minDelayBetweenTx: number;

  /**
   * Is this recipient blacklisted?
   */
  isBlacklisted: boolean;
}

/**
 * User Session Context
 * 
 * Tracks user behavior for anomaly detection.
 * Maintained in backend cache/database.
 */
export interface UserContext {
  /**
   * User's wallet address
   */
  address: string;

  /**
   * List of recipients they frequently interact with
   */
  knownRecipients: Set<string>;

  /**
   * Typical transaction amount (average) in wei
   */
  typicalAmount: bigint;

  /**
   * Typical transaction frequency (avg tx per day)
   */
  typicalFrequency: number;

  /**
   * Payment history (last N transactions)
   */
  recentHistory: PaymentHistoryEntry[];

  /**
   * Timestamp of last update
   */
  lastUpdated: number;
}

/**
 * Agent Configuration
 * 
 * Settings for the AI agent evaluator.
 */
export interface AgentConfig {
  /**
   * How many recent transactions to analyze for patterns
   */
  historyWindow: number;

  /**
   * Threshold for flagging amount as anomaly
   * (multiplier of typical amount, e.g., 5x = threshold at 5x normal)
   */
  amountAnomalyThreshold: number;

  /**
   * Threshold for flagging frequency spike
   * (multiplier of typical frequency)
   */
  frequencyAnomalyThreshold: number;

  /**
   * Risk score threshold to BLOCK (0-100)
   */
  blockThreshold: number;

  /**
   * Risk score threshold to LIMIT (0-100)
   */
  limitThreshold: number;

  /**
   * Risk score threshold to DELAY (0-100)
   * Below this is ALLOW
   */
  delayThreshold: number;

  /**
   * Default delay duration if decision is DELAY (seconds)
   */
  defaultDelaySeconds: number;
}

/**
 * Middleware Configuration
 * 
 * All settings for the x402 firewall middleware.
 */
export interface FirewallConfig {
  /**
   * Connection to Cronos EVM network
   */
  cronos: {
    rpcUrl: string;
    chainId: number;
    policyEngineAddress: string;
    gasLimit: number;
  };

  /**
   * AI Agent configuration
   */
  agent: AgentConfig;

  /**
   * Optional: Crypto.com AI Agent SDK integration
   */
  aiSDK?: {
    apiKey: string;
    endpoint: string;
  };

  /**
   * Optional: x402 Facilitator connection
   */
  x402Facilitator?: {
    url: string;
    apiKey: string;
  };
}
