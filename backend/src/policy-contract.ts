/**
 * Policy Contract Client
 * 
 * Interface to the X402PolicyEngine smart contract on Cronos.
 * Handles:
 * - Reading policy configurations
 * - Recording decisions on-chain
 * - Querying payment history
 * - Managing agent authorization
 * 
 * For MVP, using web3.js. Production would use ethers.js or viem.
 */

import {
  PaymentDecision,
  RecipientPolicyConfig,
} from "./types";

/**
 * Mock Contract ABI (excerpt)
 * In production, would import from compiled contract artifacts
 */
const POLICY_ENGINE_ABI = [
  {
    name: "evaluatePayment",
    type: "function",
    inputs: [
      { name: "sender", type: "address" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [
      { name: "decision", type: "uint8" }, // 0=ALLOW, 1=BLOCK, 2=LIMIT, 3=DELAY
      { name: "reason", type: "string" },
    ],
  },
  {
    name: "recordDecision",
    type: "function",
    inputs: [
      { name: "sender", type: "address" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "decision", type: "uint8" },
      { name: "reason", type: "string" },
    ],
  },
  {
    name: "isAgentAuthorized",
    type: "function",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "authorized", type: "bool" }],
  },
];

/**
 * Enum mapping for contract decisions (must match Solidity)
 */
enum ContractDecision {
  ALLOW = 0,
  BLOCK = 1,
  LIMIT = 2,
  DELAY = 3,
}

/**
 * Policy Contract Client
 * 
 * Manages interaction with the X402PolicyEngine contract.
 * Abstracts away Web3 details from the rest of the middleware.
 * 
 * WHY separate class: Makes testing easier, can mock for local development.
 */
export class PolicyContractClient {
  private rpcUrl: string;
  private contractAddress: string;
  private chainId: number;

  // In production, would initialize ethers.Contract or Web3 contract here
  // For MVP, storing config and showing structure

  constructor(
    rpcUrl: string,
    contractAddress: string,
    chainId: number
  ) {
    this.rpcUrl = rpcUrl;
    this.contractAddress = contractAddress;
    this.chainId = chainId;

    // Validate inputs
    if (!this.isValidAddress(contractAddress)) {
      throw new Error(`Invalid contract address: ${contractAddress}`);
    }
  }

  /**
   * Retrieve policy configuration for a recipient
   * 
   * @param recipient Address of recipient to check policy for
   * @returns Policy config or null if not configured
   * 
   * In production:
   * - Call contract.policies(recipient) to read on-chain state
   * - Cache result for performance
   * - Handle contract errors gracefully
   */
  async getRecipientPolicy(
    recipient: string
  ): Promise<RecipientPolicyConfig | null> {
    if (!this.isValidAddress(recipient)) {
      throw new Error(`Invalid recipient address: ${recipient}`);
    }

    // TODO: Implement actual contract call
    // const policy = await contract.policies(recipient);
    // if (!policy.exists) return null;

    // For MVP demo, return null (no policy = no limits)
    // In production, would return:
    // {
    //   recipient,
    //   maxAmountPerTx: BigInt(policy.maxAmountPerTx),
    //   maxAmountPerDay: BigInt(policy.maxAmountPerDay),
    //   minDelayBetweenTx: policy.minDelayBetweenTx,
    //   isBlacklisted: policy.isBlacklisted,
    // }

    return null;
  }

  /**
   * Record a payment decision on-chain
   * 
   * WHY: All decisions are recorded for:
   * - Auditability: Full history of what the AI decided
   * - Accountability: Prove the decision was made with stated reasoning
   * - Learning: Historical data for improving AI models
   * 
   * @param sender User's wallet address
   * @param recipient Service address
   * @param amount Amount in wei
   * @param decision ALLOW/BLOCK/LIMIT/DELAY
   * @param reason Explanation for the decision
   * @returns Transaction hash
   */
  async recordDecision(
    sender: string,
    recipient: string,
    amount: bigint,
    decision: PaymentDecision,
    reason: string
  ): Promise<string> {
    if (!this.isValidAddress(sender) || !this.isValidAddress(recipient)) {
      throw new Error("Invalid sender or recipient address");
    }

    const contractDecision = this.paymentDecisionToContractEnum(decision);

    // TODO: Implement actual contract call
    // const tx = await contract.recordDecision(
    //   sender,
    //   recipient,
    //   amount.toString(),
    //   contractDecision,
    //   reason,
    //   { gasLimit: 200000 }
    // );
    // await tx.wait(); // Wait for confirmation
    // return tx.hash;

    // For MVP demo, return mock tx hash
    const mockTxHash = `0x${Array(64)
      .fill(0)
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join("")}`;

    // Log for demo/testing
    console.log(`[Contract] Recording decision:`, {
      sender,
      recipient,
      amount: amount.toString(),
      decision,
      reason,
      txHash: mockTxHash,
    });

    return mockTxHash;
  }

  /**
   * Check if this middleware is authorized as an agent
   * 
   * WHY: The contract enforces that only authorized agents can record decisions.
   * This prevents unauthorized services from recording fake decisions.
   */
  async isAgentAuthorized(): Promise<boolean> {
    // TODO: Implement actual contract call
    // const authorized = await contract.isAgentAuthorized(this.agentAddress);
    // return authorized;

    // For MVP, assume authorized
    return true;
  }

  /**
   * Query recent payment attempts (for frontend)
   * 
   * @param limit Number of recent attempts to return
   * @returns Array of payment attempts
   */
  async getRecentAttempts(
    limit: number = 10
  ): Promise<Array<Record<string, unknown>>> {
    // TODO: Implement actual contract call
    // const count = await contract.getAttemptCount();
    // const recent = await contract.getRecentAttempts(limit);
    // return recent.map(parseAttempt);

    // For MVP, return empty
    return [];
  }

  /**
   * Helper: Convert PaymentDecision enum to contract enum value
   */
  private paymentDecisionToContractEnum(decision: PaymentDecision): ContractDecision {
    const map: Record<PaymentDecision, ContractDecision> = {
      [PaymentDecision.ALLOW]: ContractDecision.ALLOW,
      [PaymentDecision.BLOCK]: ContractDecision.BLOCK,
      [PaymentDecision.LIMIT]: ContractDecision.LIMIT,
      [PaymentDecision.DELAY]: ContractDecision.DELAY,
    };
    return map[decision];
  }

  /**
   * Helper: Validate Ethereum address format
   */
  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Get contract configuration for debugging
   */
  getConfig() {
    return {
      rpcUrl: this.rpcUrl,
      contractAddress: this.contractAddress,
      chainId: this.chainId,
      network: this.chainId === 25 ? "cronos-mainnet" : "cronos-testnet",
    };
  }
}
