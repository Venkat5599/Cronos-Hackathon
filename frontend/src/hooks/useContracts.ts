import { useState, useCallback } from 'react';
import { BrowserProvider, Contract, formatEther, parseEther, JsonRpcProvider } from 'ethers';

// NEW Deployed contracts on Cronos Testnet
export const CONTRACTS = {
  policyEngine: '0xD0CE6F16969d81997750afE018A34921DeDd04A0',
  firewall: '0xC3C4E069B294C8ED3841c87d527c942F873CFAA9',
  // Legacy (still works)
  router: '0x2ffE191B2086551BA80DabfFC77652BED4a179ee',
};

export const EXPLORER_BASE = 'https://cronos.org/explorer/testnet3';
const CRONOS_TESTNET_RPC = 'https://evm-t3.cronos.org';

// ABIs
const POLICY_ENGINE_ABI = [
  'function evaluateView(address sender, address recipient, uint256 amount) view returns (bool allowed, string reason)',
  'function globalMaxPayment() view returns (uint256)',
  'function globalDailyLimit() view returns (uint256)',
  'function globalWhitelistEnabled() view returns (bool)',
  'function senderBlocked(address) view returns (bool)',
  'function recipientBlacklist(address) view returns (bool)',
  'function getDailySpent(address sender) view returns (uint256)',
  'function getDailyRemaining(address sender) view returns (uint256)',
  'function owner() view returns (address)',
];

const FIREWALL_ABI = [
  // Intent functions
  'function registerIntent(address recipient, uint256 amount, uint256 validFor) returns (bytes32)',
  'function approveIntent(bytes32 intentHash, uint256 riskScore, string reason)',
  'function rejectIntent(bytes32 intentHash, uint256 riskScore, string reason)',
  'function executeIntent(bytes32 intentHash) payable',
  // Direct execution
  'function executePayment(address recipient) payable',
  // View functions
  'function getIntent(bytes32 intentHash) view returns (tuple(bytes32,address,address,uint256,uint256,uint8,uint256,string,uint256))',
  'function getStats() view returns (uint256,uint256,uint256,uint256,uint256,uint256)',
  'function simulatePayment(address sender, address recipient, uint256 amount) view returns (bool allowed, string reason)',
  'function paused() view returns (bool)',
  'function authorizedAgents(address) view returns (bool)',
  'function owner() view returns (address)',
  'function minPaymentInterval() view returns (uint256)',
  // Admin functions
  'function pause()',
  'function unpause()',
  'function setMinPaymentInterval(uint256 interval)',
  // Events
  'event IntentRegistered(bytes32 indexed intentHash, address indexed sender, address indexed recipient, uint256 amount, uint256 expiry)',
  'event PaymentExecuted(bytes32 indexed intentHash, address indexed sender, address indexed recipient, uint256 amount, uint256 timestamp)',
  'event PaymentBlocked(bytes32 indexed intentHash, address indexed sender, address indexed recipient, uint256 amount, string reason)',
];

const POLICY_ENGINE_ADMIN_ABI = [
  ...POLICY_ENGINE_ABI,
  'function blockSender(address sender, bool blocked)',
  'function blacklistRecipient(address recipient, bool blacklisted)',
  'function whitelistRecipient(address recipient, bool whitelisted)',
  'function setGlobalWhitelistEnabled(bool enabled)',
];


export interface PolicyState {
  globalMaxPayment: string;
  globalDailyLimit: string;
  whitelistEnabled: boolean;
  ownerAddress: string;
  isPaused: boolean;
  rateLimit: number;
}

export interface FirewallStats {
  totalIntents: number;
  totalApproved: number;
  totalRejected: number;
  totalExecuted: number;
  totalBlocked: number;
  totalVolume: string;
}

export interface EvaluationResult {
  allowed: boolean;
  reason: string;
  senderBlocked: boolean;
  recipientBlacklisted: boolean;
  dailySpent: string;
  dailyRemaining: string;
  timestamp: number;
}

export interface ExecutionResult {
  success: boolean;
  txHash: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
  revertReason?: string;
  intentHash?: string;
}

function getReadOnlyProvider() {
  return new JsonRpcProvider(CRONOS_TESTNET_RPC);
}

function getWalletProvider() {
  let provider = null;
  if (typeof window.ethereum !== 'undefined') {
    if (window.ethereum.providers?.length) {
      provider = window.ethereum.providers.find(
        (p: { isMetaMask?: boolean; isPhantom?: boolean }) => p.isMetaMask && !p.isPhantom
      );
    }
    if (!provider && window.ethereum.isMetaMask && !window.ethereum.isPhantom) {
      provider = window.ethereum;
    }
    if (!provider) provider = window.ethereum;
  }
  if (!provider) throw new Error('No wallet connected');
  return new BrowserProvider(provider);
}


export function useContracts() {
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch policy state
  const fetchPolicyState = useCallback(async (): Promise<PolicyState> => {
    const provider = getReadOnlyProvider();
    const policyEngine = new Contract(CONTRACTS.policyEngine, POLICY_ENGINE_ABI, provider);
    const firewall = new Contract(CONTRACTS.firewall, FIREWALL_ABI, provider);
    const [maxPayment, dailyLimit, whitelistEnabled, owner, isPaused, rateLimit] = await Promise.all([
      policyEngine.globalMaxPayment(),
      policyEngine.globalDailyLimit(),
      policyEngine.globalWhitelistEnabled(),
      policyEngine.owner(),
      firewall.paused(),
      firewall.minPaymentInterval(),
    ]);
    return {
      globalMaxPayment: formatEther(maxPayment),
      globalDailyLimit: formatEther(dailyLimit),
      whitelistEnabled,
      ownerAddress: owner,
      isPaused,
      rateLimit: Number(rateLimit),
    };
  }, []);

  // Fetch firewall stats
  const fetchFirewallStats = useCallback(async (): Promise<FirewallStats> => {
    const provider = getReadOnlyProvider();
    const firewall = new Contract(CONTRACTS.firewall, FIREWALL_ABI, provider);
    const stats = await firewall.getStats();
    return {
      totalIntents: Number(stats[0]),
      totalApproved: Number(stats[1]),
      totalRejected: Number(stats[2]),
      totalExecuted: Number(stats[3]),
      totalBlocked: Number(stats[4]),
      totalVolume: formatEther(stats[5]),
    };
  }, []);

  // Pre-check payment
  const evaluatePayment = useCallback(async (
    sender: string, recipient: string, amountInCRO: string
  ): Promise<EvaluationResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = getReadOnlyProvider();
      const policyEngine = new Contract(CONTRACTS.policyEngine, POLICY_ENGINE_ABI, provider);
      const amountWei = parseEther(amountInCRO);
      const [evaluateResult, senderBlocked, recipientBlacklisted, dailySpent, dailyRemaining] = await Promise.all([
        policyEngine.evaluateView(sender, recipient, amountWei),
        policyEngine.senderBlocked(sender),
        policyEngine.recipientBlacklist(recipient),
        policyEngine.getDailySpent(sender),
        policyEngine.getDailyRemaining(sender),
      ]);
      setIsLoading(false);
      return {
        allowed: evaluateResult[0],
        reason: evaluateResult[1],
        senderBlocked,
        recipientBlacklisted,
        dailySpent: formatEther(dailySpent),
        dailyRemaining: formatEther(dailyRemaining),
        timestamp: Date.now(),
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
      setIsLoading(false);
      throw err;
    }
  }, []);


  // Execute REAL payment through firewall
  const executeRealPayment = useCallback(async (
    recipient: string, amountInCRO: string
  ): Promise<ExecutionResult> => {
    setIsExecuting(true);
    setError(null);
    try {
      const provider = getWalletProvider();
      const signer = await provider.getSigner();
      const firewall = new Contract(CONTRACTS.firewall, FIREWALL_ABI, signer);
      const amountWei = parseEther(amountInCRO);

      console.log('Executing payment through x402 Firewall...');
      console.log('  Recipient:', recipient);
      console.log('  Amount:', amountInCRO, 'CRO');
      console.log('  Firewall:', CONTRACTS.firewall);

      const tx = await firewall.executePayment(recipient, { 
        value: amountWei,
        gasLimit: 300000,
      });
      
      console.log('TX submitted:', tx.hash);
      const receipt = await tx.wait();
      console.log('Confirmed in block:', receipt.blockNumber);

      setIsExecuting(false);
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (err: unknown) {
      console.error('Execution error:', err);
      let errorMessage = 'Transaction failed';
      let revertReason = '';
      if (err instanceof Error) {
        errorMessage = err.message;
        if (errorMessage.includes('X402Firewall:')) {
          const match = errorMessage.match(/X402Firewall: (.+?)(?:"|$)/);
          if (match) revertReason = match[1];
        }
        if (errorMessage.includes('user rejected')) errorMessage = 'Transaction rejected';
      }
      setError(errorMessage);
      setIsExecuting(false);
      return { success: false, txHash: '', error: errorMessage, revertReason: revertReason || undefined };
    }
  }, []);

  // Get wallet balance
  const getWalletBalance = useCallback(async (address: string): Promise<string> => {
    const provider = getReadOnlyProvider();
    const balance = await provider.getBalance(address);
    return formatEther(balance);
  }, []);

  // Admin: Pause firewall
  const pauseFirewall = useCallback(async (): Promise<boolean> => {
    try {
      const provider = getWalletProvider();
      const signer = await provider.getSigner();
      const firewall = new Contract(CONTRACTS.firewall, FIREWALL_ABI, signer);
      const tx = await firewall.pause();
      await tx.wait();
      return true;
    } catch (err) {
      console.error('Pause failed:', err);
      return false;
    }
  }, []);

  // Admin: Unpause firewall
  const unpauseFirewall = useCallback(async (): Promise<boolean> => {
    try {
      const provider = getWalletProvider();
      const signer = await provider.getSigner();
      const firewall = new Contract(CONTRACTS.firewall, FIREWALL_ABI, signer);
      const tx = await firewall.unpause();
      await tx.wait();
      return true;
    } catch (err) {
      console.error('Unpause failed:', err);
      return false;
    }
  }, []);

  // Admin: Set rate limit
  const setRateLimit = useCallback(async (intervalSeconds: number): Promise<boolean> => {
    try {
      const provider = getWalletProvider();
      const signer = await provider.getSigner();
      const firewall = new Contract(CONTRACTS.firewall, FIREWALL_ABI, signer);
      const tx = await firewall.setMinPaymentInterval(intervalSeconds);
      await tx.wait();
      return true;
    } catch (err) {
      console.error('Set rate limit failed:', err);
      return false;
    }
  }, []);

  // Admin: Block sender
  const blockSender = useCallback(async (sender: string, blocked: boolean): Promise<boolean> => {
    try {
      const provider = getWalletProvider();
      const signer = await provider.getSigner();
      const policyEngine = new Contract(CONTRACTS.policyEngine, POLICY_ENGINE_ADMIN_ABI, signer);
      const tx = await policyEngine.blockSender(sender, blocked);
      await tx.wait();
      return true;
    } catch (err) {
      console.error('Block sender failed:', err);
      return false;
    }
  }, []);

  // Admin: Blacklist recipient
  const blacklistRecipient = useCallback(async (recipient: string, blacklisted: boolean): Promise<boolean> => {
    try {
      const provider = getWalletProvider();
      const signer = await provider.getSigner();
      const policyEngine = new Contract(CONTRACTS.policyEngine, POLICY_ENGINE_ADMIN_ABI, signer);
      const tx = await policyEngine.blacklistRecipient(recipient, blacklisted);
      await tx.wait();
      return true;
    } catch (err) {
      console.error('Blacklist recipient failed:', err);
      return false;
    }
  }, []);

  // Check if address is owner
  const checkIsOwner = useCallback(async (address: string): Promise<boolean> => {
    try {
      const provider = getReadOnlyProvider();
      const policyEngine = new Contract(CONTRACTS.policyEngine, POLICY_ENGINE_ABI, provider);
      const owner = await policyEngine.owner();
      return owner.toLowerCase() === address.toLowerCase();
    } catch {
      return false;
    }
  }, []);

  // Check if firewall is paused
  const checkPaused = useCallback(async (): Promise<boolean> => {
    try {
      const provider = getReadOnlyProvider();
      const firewall = new Contract(CONTRACTS.firewall, FIREWALL_ABI, provider);
      return await firewall.paused();
    } catch {
      return false;
    }
  }, []);

  return {
    isLoading,
    isExecuting,
    error,
    fetchPolicyState,
    fetchFirewallStats,
    evaluatePayment,
    executeRealPayment,
    getWalletBalance,
    // Admin functions
    pauseFirewall,
    unpauseFirewall,
    setRateLimit,
    blockSender,
    blacklistRecipient,
    checkIsOwner,
    checkPaused,
    contracts: CONTRACTS,
  };
}