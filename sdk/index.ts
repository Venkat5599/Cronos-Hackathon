/**
 * x402 Payment Firewall SDK
 * 
 * Drop-in security layer for autonomous agent payments on Cronos
 * 
 * @example
 * ```typescript
 * import { X402Firewall } from '@x402/firewall-sdk';
 * 
 * const firewall = new X402Firewall(signer);
 * 
 * // Simple payment (policy enforced)
 * await firewall.pay(recipient, '100'); // 100 CRO
 * 
 * // With intent flow (for high-value)
 * const intent = await firewall.registerIntent(recipient, '5000');
 * await firewall.approveIntent(intent.hash, 25, 'Low risk');
 * await firewall.executeIntent(intent.hash);
 * ```
 */

import { 
  Contract, 
  Signer, 
  Provider, 
  parseEther, 
  formatEther,
  JsonRpcProvider,
  BrowserProvider,
  ContractTransactionResponse,
  ContractTransactionReceipt
} from 'ethers';

// ============================================================================
// CONSTANTS
// ============================================================================

export const CRONOS_TESTNET = {
  chainId: 338,
  name: 'Cronos Testnet',
  rpc: 'https://evm-t3.cronos.org',
  explorer: 'https://cronos.org/explorer/testnet3',
};

export const CRONOS_MAINNET = {
  chainId: 25,
  name: 'Cronos Mainnet',
  rpc: 'https://evm.cronos.org',
  explorer: 'https://cronos.org/explorer',
};

export const DEPLOYED_CONTRACTS = {
  testnet: {
    firewall: '0xC3C4E069B294C8ED3841c87d527c942F873CFAA9',
    policyEngine: '0xD0CE6F16969d81997750afE018A34921DeDd04A0',
  },
  mainnet: {
    firewall: '', // Not deployed yet
    policyEngine: '',
  },
};

// ============================================================================
// ABIs
// ============================================================================

const FIREWALL_ABI = [
  // Intent functions
  'function registerIntent(address recipient, uint256 amount, uint256 validFor) returns (bytes32)',
  'function approveIntent(bytes32 intentHash, uint256 riskScore, string reason)',
  'function rejectIntent(bytes32 intentHash, uint256 riskScore, string reason)',
  'function executeIntent(bytes32 intentHash) payable',
  // Direct execution
  'function executePayment(address recipient) payable',
  // View functions
  'function getIntent(bytes32 intentHash) view returns (tuple(bytes32 intentHash, address sender, address recipient, uint256 amount, uint256 expiry, uint8 status, uint256 riskScore, string reason, uint256 createdAt))',
  'function getSenderIntents(address sender) view returns (bytes32[])',
  'function getStats() view returns (uint256, uint256, uint256, uint256, uint256, uint256)',
  'function simulatePayment(address sender, address recipient, uint256 amount) view returns (bool allowed, string reason)',
  'function paused() view returns (bool)',
  'function authorizedAgents(address) view returns (bool)',
  'function owner() view returns (address)',
  // Admin
  'function pause()',
  'function unpause()',
  'function addAgent(address agent)',
  'function removeAgent(address agent)',
  'function setMinPaymentInterval(uint256 interval)',
  // Events
  'event IntentRegistered(bytes32 indexed intentHash, address indexed sender, address indexed recipient, uint256 amount, uint256 expiry)',
  'event IntentApproved(bytes32 indexed intentHash, address indexed agent, uint256 riskScore, string reason)',
  'event IntentRejected(bytes32 indexed intentHash, address indexed agent, uint256 riskScore, string reason)',
  'event PaymentExecuted(bytes32 indexed intentHash, address indexed sender, address indexed recipient, uint256 amount, uint256 timestamp)',
  'event PaymentBlocked(bytes32 indexed intentHash, address indexed sender, address indexed recipient, uint256 amount, string reason)',
  'event EmergencyPause(address indexed by, uint256 timestamp)',
  'event EmergencyUnpause(address indexed by, uint256 timestamp)',
];

const POLICY_ENGINE_ABI = [
  'function evaluate(address sender, address recipient, uint256 amount) returns (bool allowed, string reason)',
  'function evaluateView(address sender, address recipient, uint256 amount) view returns (bool allowed, string reason)',
  'function globalMaxPayment() view returns (uint256)',
  'function globalDailyLimit() view returns (uint256)',
  'function globalWhitelistEnabled() view returns (bool)',
  'function senderBlocked(address) view returns (bool)',
  'function recipientBlacklist(address) view returns (bool)',
  'function recipientWhitelist(address) view returns (bool)',
  'function getDailySpent(address sender) view returns (uint256)',
  'function getDailyRemaining(address sender) view returns (uint256)',
  // Admin
  'function setGlobalMaxPayment(uint256 max)',
  'function setGlobalDailyLimit(uint256 limit)',
  'function setGlobalWhitelistEnabled(bool enabled)',
  'function blockSender(address sender, bool blocked)',
  'function blacklistRecipient(address recipient, bool blacklisted)',
  'function whitelistRecipient(address recipient, bool whitelisted)',
  'function owner() view returns (address)',
];

// ============================================================================
// TYPES
// ============================================================================

export enum IntentStatus {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2,
  EXECUTED = 3,
  EXPIRED = 4,
  CANCELLED = 5,
}

export interface PaymentIntent {
  intentHash: string;
  sender: string;
  recipient: string;
  amount: string; // in CRO
  expiry: number;
  status: IntentStatus;
  riskScore: number;
  reason: string;
  createdAt: number;
}

export interface FirewallStats {
  totalIntents: number;
  totalApproved: number;
  totalRejected: number;
  totalExecuted: number;
  totalBlocked: number;
  totalVolume: string; // in CRO
}

export interface PolicyState {
  maxPayment: string; // in CRO
  dailyLimit: string; // in CRO
  whitelistEnabled: boolean;
}

export interface PaymentResult {
  success: boolean;
  txHash: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
  revertReason?: string;
}

export interface SimulationResult {
  allowed: boolean;
  reason: string;
}

// ============================================================================
// MAIN SDK CLASS
// ============================================================================

export class X402Firewall {
  private firewall: Contract;
  private policyEngine: Contract;
  private signer: Signer | null;
  private provider: Provider;
  
  constructor(
    signerOrProvider: Signer | Provider,
    options?: {
      firewallAddress?: string;
      policyEngineAddress?: string;
      network?: 'testnet' | 'mainnet';
    }
  ) {
    const network = options?.network || 'testnet';
    const addresses = DEPLOYED_CONTRACTS[network];
    
    const firewallAddress = options?.firewallAddress || addresses.firewall;
    const policyEngineAddress = options?.policyEngineAddress || addresses.policyEngine;
    
    if (!firewallAddress || !policyEngineAddress) {
      throw new Error(`Contracts not deployed on ${network}`);
    }
    
    if ('getAddress' in signerOrProvider) {
      this.signer = signerOrProvider as Signer;
      this.provider = (signerOrProvider as Signer).provider!;
    } else {
      this.signer = null;
      this.provider = signerOrProvider as Provider;
    }
    
    this.firewall = new Contract(
      firewallAddress,
      FIREWALL_ABI,
      this.signer || this.provider
    );
    
    this.policyEngine = new Contract(
      policyEngineAddress,
      POLICY_ENGINE_ABI,
      this.signer || this.provider
    );
  }

  // ==========================================================================
  // STATIC FACTORY METHODS
  // ==========================================================================

  /**
   * Create SDK instance from browser wallet (MetaMask)
   */
  static async fromBrowserWallet(options?: { network?: 'testnet' | 'mainnet' }): Promise<X402Firewall> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No browser wallet found');
    }
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new X402Firewall(signer, options);
  }

  /**
   * Create read-only SDK instance
   */
  static readOnly(options?: { network?: 'testnet' | 'mainnet' }): X402Firewall {
    const network = options?.network || 'testnet';
    const rpc = network === 'mainnet' ? CRONOS_MAINNET.rpc : CRONOS_TESTNET.rpc;
    const provider = new JsonRpcProvider(rpc);
    return new X402Firewall(provider, options);
  }

  // ==========================================================================
  // SIMPLE PAYMENT (Most Common Use Case)
  // ==========================================================================

  /**
   * Execute a payment through the firewall
   * Policy is automatically enforced on-chain
   * 
   * @param recipient Address to pay
   * @param amountInCRO Amount in CRO (e.g., "100" for 100 CRO)
   * @returns Payment result with transaction hash
   * 
   * @example
   * ```typescript
   * const result = await firewall.pay('0x...', '100');
   * if (result.success) {
   *   console.log('Paid!', result.txHash);
   * } else {
   *   console.log('Blocked:', result.revertReason);
   * }
   * ```
   */
  async pay(recipient: string, amountInCRO: string): Promise<PaymentResult> {
    if (!this.signer) throw new Error('Signer required for transactions');
    
    try {
      const tx: ContractTransactionResponse = await this.firewall.executePayment(
        recipient,
        { value: parseEther(amountInCRO), gasLimit: 300000 }
      );
      
      const receipt: ContractTransactionReceipt | null = await tx.wait();
      
      return {
        success: true,
        txHash: receipt!.hash,
        blockNumber: receipt!.blockNumber,
        gasUsed: receipt!.gasUsed.toString(),
      };
    } catch (err: unknown) {
      const error = err as Error & { reason?: string };
      let revertReason = '';
      if (error.message?.includes('X402Firewall:')) {
        const match = error.message.match(/X402Firewall: (.+?)(?:"|$)/);
        if (match) revertReason = match[1];
      }
      
      return {
        success: false,
        txHash: '',
        error: error.message,
        revertReason: revertReason || undefined,
      };
    }
  }

  /**
   * Simulate a payment without executing
   * Use this to check if a payment would be allowed
   */
  async simulate(sender: string, recipient: string, amountInCRO: string): Promise<SimulationResult> {
    const result = await this.firewall.simulatePayment(
      sender,
      recipient,
      parseEther(amountInCRO)
    );
    return { allowed: result[0], reason: result[1] };
  }

  // ==========================================================================
  // INTENT FLOW (For High-Value or Audited Payments)
  // ==========================================================================

  /**
   * Register a payment intent for approval
   * Use this for high-value payments that need review
   */
  async registerIntent(
    recipient: string,
    amountInCRO: string,
    validForSeconds: number = 3600
  ): Promise<{ hash: string; tx: ContractTransactionReceipt }> {
    if (!this.signer) throw new Error('Signer required');
    
    const tx = await this.firewall.registerIntent(
      recipient,
      parseEther(amountInCRO),
      validForSeconds
    );
    const receipt = await tx.wait();
    
    // Extract intent hash from event
    const event = receipt.logs.find(
      (log: { fragment?: { name: string } }) => log.fragment?.name === 'IntentRegistered'
    );
    const intentHash = event?.args?.[0] || '';
    
    return { hash: intentHash, tx: receipt };
  }

  /**
   * Approve a pending intent (agent/admin only)
   */
  async approveIntent(intentHash: string, riskScore: number, reason: string): Promise<ContractTransactionReceipt> {
    if (!this.signer) throw new Error('Signer required');
    const tx = await this.firewall.approveIntent(intentHash, riskScore, reason);
    return tx.wait();
  }

  /**
   * Reject a pending intent (agent/admin only)
   */
  async rejectIntent(intentHash: string, riskScore: number, reason: string): Promise<ContractTransactionReceipt> {
    if (!this.signer) throw new Error('Signer required');
    const tx = await this.firewall.rejectIntent(intentHash, riskScore, reason);
    return tx.wait();
  }

  /**
   * Execute an approved intent
   */
  async executeIntent(intentHash: string): Promise<PaymentResult> {
    if (!this.signer) throw new Error('Signer required');
    
    const intent = await this.getIntent(intentHash);
    if (!intent) throw new Error('Intent not found');
    
    try {
      const tx = await this.firewall.executeIntent(intentHash, {
        value: parseEther(intent.amount),
        gasLimit: 300000,
      });
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        txHash: '',
        error: error.message,
      };
    }
  }

  /**
   * Get intent details
   */
  async getIntent(intentHash: string): Promise<PaymentIntent | null> {
    try {
      const intent = await this.firewall.getIntent(intentHash);
      if (intent.createdAt === 0n) return null;
      
      return {
        intentHash: intent.intentHash,
        sender: intent.sender,
        recipient: intent.recipient,
        amount: formatEther(intent.amount),
        expiry: Number(intent.expiry),
        status: Number(intent.status) as IntentStatus,
        riskScore: Number(intent.riskScore),
        reason: intent.reason,
        createdAt: Number(intent.createdAt),
      };
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // VIEW FUNCTIONS
  // ==========================================================================

  async getStats(): Promise<FirewallStats> {
    const stats = await this.firewall.getStats();
    return {
      totalIntents: Number(stats[0]),
      totalApproved: Number(stats[1]),
      totalRejected: Number(stats[2]),
      totalExecuted: Number(stats[3]),
      totalBlocked: Number(stats[4]),
      totalVolume: formatEther(stats[5]),
    };
  }

  async getPolicyState(): Promise<PolicyState> {
    const [maxPayment, dailyLimit, whitelistEnabled] = await Promise.all([
      this.policyEngine.globalMaxPayment(),
      this.policyEngine.globalDailyLimit(),
      this.policyEngine.globalWhitelistEnabled(),
    ]);
    
    return {
      maxPayment: formatEther(maxPayment),
      dailyLimit: formatEther(dailyLimit),
      whitelistEnabled,
    };
  }

  async getDailyRemaining(sender: string): Promise<string> {
    const remaining = await this.policyEngine.getDailyRemaining(sender);
    return formatEther(remaining);
  }

  async isPaused(): Promise<boolean> {
    return this.firewall.paused();
  }

  async isAgent(address: string): Promise<boolean> {
    return this.firewall.authorizedAgents(address);
  }

  async isSenderBlocked(sender: string): Promise<boolean> {
    return this.policyEngine.senderBlocked(sender);
  }

  async isRecipientBlacklisted(recipient: string): Promise<boolean> {
    return this.policyEngine.recipientBlacklist(recipient);
  }

  // ==========================================================================
  // ADMIN FUNCTIONS (Owner Only)
  // ==========================================================================

  async pause(): Promise<ContractTransactionReceipt> {
    if (!this.signer) throw new Error('Signer required');
    const tx = await this.firewall.pause();
    return tx.wait();
  }

  async unpause(): Promise<ContractTransactionReceipt> {
    if (!this.signer) throw new Error('Signer required');
    const tx = await this.firewall.unpause();
    return tx.wait();
  }

  async addAgent(agent: string): Promise<ContractTransactionReceipt> {
    if (!this.signer) throw new Error('Signer required');
    const tx = await this.firewall.addAgent(agent);
    return tx.wait();
  }

  async setRateLimit(intervalSeconds: number): Promise<ContractTransactionReceipt> {
    if (!this.signer) throw new Error('Signer required');
    const tx = await this.firewall.setMinPaymentInterval(intervalSeconds);
    return tx.wait();
  }

  async blockSender(sender: string, blocked: boolean): Promise<ContractTransactionReceipt> {
    if (!this.signer) throw new Error('Signer required');
    const tx = await this.policyEngine.blockSender(sender, blocked);
    return tx.wait();
  }

  async blacklistRecipient(recipient: string, blacklisted: boolean): Promise<ContractTransactionReceipt> {
    if (!this.signer) throw new Error('Signer required');
    const tx = await this.policyEngine.blacklistRecipient(recipient, blacklisted);
    return tx.wait();
  }

  // ==========================================================================
  // UTILITY
  // ==========================================================================

  get addresses() {
    return {
      firewall: this.firewall.target,
      policyEngine: this.policyEngine.target,
    };
  }
}

// ============================================================================
// x402 INTEGRATION HELPERS
// ============================================================================

/**
 * x402 Payment Handler with Firewall Protection
 * 
 * Drop-in replacement for x402 payment processing
 */
export class X402ProtectedPaymentHandler {
  private firewall: X402Firewall;
  
  constructor(firewall: X402Firewall) {
    this.firewall = firewall;
  }

  /**
   * Process an x402 payment request with firewall protection
   * 
   * @example
   * ```typescript
   * // In your x402 payment endpoint
   * app.post('/x402/pay', async (req, res) => {
   *   const { recipient, amount } = req.body;
   *   const result = await handler.processPayment(recipient, amount);
   *   res.json(result);
   * });
   * ```
   */
  async processPayment(recipient: string, amountInCRO: string): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
    policyReason?: string;
  }> {
    // Step 1: Pre-check policy
    const sender = await (this.firewall as unknown as { signer: Signer }).signer.getAddress();
    const simulation = await this.firewall.simulate(sender, recipient, amountInCRO);
    
    if (!simulation.allowed) {
      return {
        success: false,
        error: 'Policy check failed',
        policyReason: simulation.reason,
      };
    }
    
    // Step 2: Execute through firewall
    const result = await this.firewall.pay(recipient, amountInCRO);
    
    return {
      success: result.success,
      txHash: result.txHash || undefined,
      error: result.error,
      policyReason: result.revertReason,
    };
  }

  /**
   * Process high-value payment with intent flow
   */
  async processHighValuePayment(
    recipient: string,
    amountInCRO: string,
    riskAssessment: { score: number; reason: string }
  ): Promise<{
    success: boolean;
    intentHash?: string;
    txHash?: string;
    error?: string;
  }> {
    try {
      // Step 1: Register intent
      const { hash } = await this.firewall.registerIntent(recipient, amountInCRO);
      
      // Step 2: Auto-approve based on risk assessment
      if (riskAssessment.score < 50) {
        await this.firewall.approveIntent(hash, riskAssessment.score, riskAssessment.reason);
        
        // Step 3: Execute
        const result = await this.firewall.executeIntent(hash);
        
        return {
          success: result.success,
          intentHash: hash,
          txHash: result.txHash || undefined,
          error: result.error,
        };
      } else {
        // High risk - reject
        await this.firewall.rejectIntent(hash, riskAssessment.score, riskAssessment.reason);
        return {
          success: false,
          intentHash: hash,
          error: `High risk payment rejected: ${riskAssessment.reason}`,
        };
      }
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default X402Firewall;

// Type augmentation for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}
