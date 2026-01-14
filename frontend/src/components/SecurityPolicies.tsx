import { useState, useEffect } from 'react';
import { useContracts, PolicyState, FirewallStats, CONTRACTS, EXPLORER_BASE } from '../hooks/useContracts';

const EXPLORER = EXPLORER_BASE;

interface SecurityPoliciesProps {
  walletConnected?: boolean;
}

function SecurityPolicies(_props: SecurityPoliciesProps) {
  const contracts = useContracts();
  const [policyState, setPolicyState] = useState<PolicyState | null>(null);
  const [firewallStats, setFirewallStats] = useState<FirewallStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch on-chain data when component mounts
  useEffect(() => {
    const fetchData = async () => {
      if (typeof window.ethereum === 'undefined') return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const [policy, stats] = await Promise.all([
          contracts.fetchPolicyState(),
          contracts.fetchFirewallStats(),
        ]);
        setPolicyState(policy);
        setFirewallStats(stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch on-chain data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCRO = (value: string) => {
    const num = parseFloat(value);
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M CRO`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K CRO`;
    return `${num.toFixed(0)} CRO`;
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-white text-4xl font-black leading-tight tracking-[-0.033em]">
          Security Policies
        </h2>
        <p className="text-[#8dc0ce] text-lg font-normal leading-normal max-w-2xl mt-2">
          Live on-chain policy configuration from the deployed X402PolicyEngine contract.
        </p>
      </div>

      {/* Live Data Indicator */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
        <span className="size-2 rounded-full bg-primary animate-pulse" />
        <span className="text-primary text-sm font-bold">LIVE DATA</span>
        <span className="text-[#8dc0ce] text-sm">
          Fetched from Cronos Testnet • Chain ID: 338
        </span>
        {isLoading && (
          <span className="material-symbols-outlined text-primary text-sm animate-spin ml-auto">
            progress_activity
          </span>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-danger-red/10 border border-danger-red/30">
          <p className="text-danger-red text-sm">{error}</p>
          <p className="text-[#8dc0ce] text-xs mt-1">
            Make sure you have a wallet connected to view on-chain data.
          </p>
        </div>
      )}

      {/* Contract Info */}
      <div className="p-4 rounded-xl bg-card-dark border border-border-dark">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[#8dc0ce] text-xs uppercase font-bold">PolicyEngine Contract</span>
            <p className="text-primary font-mono text-sm mt-1">{CONTRACTS.policyEngine}</p>
            {policyState && (
              <p className="text-[#8dc0ce] text-xs mt-1">
                Owner: {policyState.ownerAddress.slice(0, 10)}...{policyState.ownerAddress.slice(-8)}
              </p>
            )}
          </div>
          <a
            href={`${EXPLORER}/address/${CONTRACTS.policyEngine}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors"
          >
            <span className="text-primary text-xs font-bold">View on Explorer</span>
            <span className="material-symbols-outlined text-primary text-sm">open_in_new</span>
          </a>
        </div>
      </div>

      {/* Firewall Stats */}
      {firewallStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-card-dark border border-border-dark">
            <span className="text-[#8dc0ce] text-xs uppercase font-bold">Total Intents</span>
            <p className="text-3xl font-black text-white mt-1">{firewallStats.totalIntents}</p>
          </div>
          <div className="p-4 rounded-xl bg-card-dark border border-success-green/30">
            <span className="text-success-green text-xs uppercase font-bold">Executed</span>
            <p className="text-3xl font-black text-success-green mt-1">
              {firewallStats.totalExecuted}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-card-dark border border-danger-red/30">
            <span className="text-danger-red text-xs uppercase font-bold">Blocked</span>
            <p className="text-3xl font-black text-danger-red mt-1">{firewallStats.totalBlocked}</p>
          </div>
          <div className="p-4 rounded-xl bg-card-dark border border-primary/30">
            <span className="text-primary text-xs uppercase font-bold">Volume</span>
            <p className="text-xl font-black text-primary mt-1">
              {formatCRO(firewallStats.totalVolume)}
            </p>
          </div>
        </div>
      )}

      {/* Active Policies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Max Payment Cap */}
        <div className="p-6 rounded-xl bg-card-dark border border-border-dark">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-lg bg-yellow-400/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-yellow-400">payments</span>
            </div>
            <div>
              <h3 className="text-white font-bold">Max Payment Cap</h3>
              <p className="text-[#8dc0ce] text-xs">Per-transaction limit</p>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-background-dark">
            <span className="text-3xl font-black text-white">
              {policyState ? formatCRO(policyState.globalMaxPayment) : '...'}
            </span>
            <p className="text-[#8dc0ce] text-xs mt-2">
              Transactions exceeding this amount will be reverted.
            </p>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-yellow-400/5 border border-yellow-400/20">
            <code className="text-yellow-400 text-xs font-mono">
              globalMaxPayment = {policyState?.globalMaxPayment || '...'} wei
            </code>
          </div>
        </div>

        {/* Daily Limit */}
        <div className="p-6 rounded-xl bg-card-dark border border-border-dark">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">today</span>
            </div>
            <div>
              <h3 className="text-white font-bold">Daily Spending Limit</h3>
              <p className="text-[#8dc0ce] text-xs">24-hour rolling window</p>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-background-dark">
            <span className="text-3xl font-black text-white">
              {policyState ? formatCRO(policyState.globalDailyLimit) : '...'}
            </span>
            <p className="text-[#8dc0ce] text-xs mt-2">
              Cumulative daily spending tracked per sender.
            </p>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <code className="text-primary text-xs font-mono">
              globalDailyLimit = {policyState?.globalDailyLimit || '...'} wei
            </code>
          </div>
        </div>

        {/* Whitelist Status */}
        <div className="p-6 rounded-xl bg-card-dark border border-border-dark">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-lg bg-success-green/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-success-green">checklist</span>
            </div>
            <div>
              <h3 className="text-white font-bold">Whitelist Mode</h3>
              <p className="text-[#8dc0ce] text-xs">Recipient restrictions</p>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-background-dark">
            <span className={`text-2xl font-black ${policyState?.whitelistEnabled ? 'text-success-green' : 'text-[#8dc0ce]'}`}>
              {policyState?.whitelistEnabled ? 'ENABLED' : 'DISABLED'}
            </span>
            <p className="text-[#8dc0ce] text-xs mt-2">
              {policyState?.whitelistEnabled 
                ? 'Only whitelisted recipients can receive payments.'
                : 'All recipients allowed (unless blacklisted).'}
            </p>
          </div>
        </div>

        {/* Policy Checks */}
        <div className="p-6 rounded-xl bg-card-dark border border-border-dark">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-lg bg-danger-red/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-danger-red">shield</span>
            </div>
            <div>
              <h3 className="text-white font-bold">Policy Checks</h3>
              <p className="text-[#8dc0ce] text-xs">Enforcement rules</p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              'Sender not blocked',
              'Recipient not blacklisted',
              'Whitelist check (if enabled)',
              'Amount ≤ max payment cap',
              'Per-recipient cap check',
              'Daily limit check',
              'Sender-recipient allowlist',
            ].map((check, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded bg-background-dark">
                <span className="text-success-green text-xs">✓</span>
                <span className="text-white text-xs">{check}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Policy Enforcement Flow */}
      <div className="p-6 rounded-xl bg-card-dark border border-border-dark">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">account_tree</span>
          On-Chain Enforcement Flow
        </h3>
        <div className="flex items-center gap-4 overflow-x-auto pb-2">
          <div className="flex-shrink-0 p-3 rounded-lg bg-primary/10 border border-primary/30 text-center min-w-[140px]">
            <span className="text-primary text-xs font-bold">1. executePayment()</span>
            <p className="text-[10px] text-[#8dc0ce] mt-1">Router receives call</p>
          </div>
          <span className="material-symbols-outlined text-[#8dc0ce]">arrow_forward</span>
          <div className="flex-shrink-0 p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/30 text-center min-w-[140px]">
            <span className="text-yellow-400 text-xs font-bold">2. evaluate()</span>
            <p className="text-[10px] text-[#8dc0ce] mt-1">PolicyEngine checks</p>
          </div>
          <span className="material-symbols-outlined text-[#8dc0ce]">arrow_forward</span>
          <div className="flex-shrink-0 p-3 rounded-lg bg-success-green/10 border border-success-green/30 text-center min-w-[140px]">
            <span className="text-success-green text-xs font-bold">3a. ALLOW</span>
            <p className="text-[10px] text-[#8dc0ce] mt-1">Transfer executes</p>
          </div>
          <span className="text-[#8dc0ce] text-xs">OR</span>
          <div className="flex-shrink-0 p-3 rounded-lg bg-danger-red/10 border border-danger-red/30 text-center min-w-[140px]">
            <span className="text-danger-red text-xs font-bold">3b. REVERT</span>
            <p className="text-[10px] text-[#8dc0ce] mt-1">Transaction fails</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SecurityPolicies;
