export interface PaymentIntent {
  version: string;
  intent: {
    recipient: string;
    amount: string;
    asset: string;
    chain_id: string;
    memo?: string;
  };
  metadata: {
    origin: string;
    priority?: string;
  };
}

export interface SimulationResponse {
  intentHash: string;
  decision: 'ALLOW' | 'BLOCK' | 'LIMIT' | 'DELAY';
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

// Real on-chain evaluation result
export interface OnChainResult {
  allowed: boolean;
  reason: string;
  senderBlocked: boolean;
  recipientBlacklisted: boolean;
  dailySpent: string;
  dailyRemaining: string;
  timestamp: number;
  txHash?: string;
  sender: string;
  recipient: string;
  amount: string;
}

export type DecisionStatus = 'idle' | 'loading' | 'success' | 'error';
