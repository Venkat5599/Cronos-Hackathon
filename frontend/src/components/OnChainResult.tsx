import { OnChainResult } from '../types';
import { CONTRACTS } from '../hooks/useContracts';

const EXPLORER_BASE = 'https://cronos.org/explorer/testnet3';

interface OnChainResultProps {
  result: OnChainResult | null;
  isLoading: boolean;
  error: string | null;
  walletConnected: boolean;
}

function OnChainResultComponent({ result, isLoading, error, walletConnected }: OnChainResultProps) {
  return (
    <>
      <div className="px-2">
        <h3 className="text-white text-sm font-bold uppercase tracking-wider flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-sm">link</span>
          Live On-Chain Result
        </h3>
        <p className="text-[10px] text-[#8dc0ce] mt-1">
          Real-time query to deployed contracts on Cronos Testnet
        </p>
      </div>

      {/* Main Result Card */}
      <div className={`rounded-xl bg-card-dark border-2 p-6 shadow-2xl relative overflow-hidden ${
        result 
          ? result.allowed 
            ? 'border-success-green/30' 
            : 'border-danger-red/30'
          : 'border-border-dark'
      }`}>
        {result && (
          <div className={`absolute -right-8 -top-8 size-32 rounded-full blur-3xl ${
            result.allowed ? 'bg-success-green/10' : 'bg-danger-red/10'
          }`} />
        )}
        
        <div className="relative z-10">
          {!walletConnected && (
            <div className="text-center py-10">
              <span className="material-symbols-outlined text-5xl text-yellow-400/30 mb-4">
                account_balance_wallet
              </span>
              <p className="text-yellow-400 text-sm font-bold">
                Connect wallet to query on-chain
              </p>
              <p className="text-[#8dc0ce] text-xs mt-2">
                Your wallet address will be used as the sender
              </p>
            </div>
          )}

          {walletConnected && !result && !isLoading && !error && (
            <div className="text-center py-10">
              <span className="material-symbols-outlined text-5xl text-[#8dc0ce]/30 mb-4">
                query_stats
              </span>
              <p className="text-[#8dc0ce] text-sm">
                Click "Check On-Chain" to query the deployed PolicyEngine
              </p>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-10">
              <span className="material-symbols-outlined text-5xl text-primary animate-spin mb-4">
                progress_activity
              </span>
              <p className="text-primary text-sm font-bold">
                Querying Cronos Testnet...
              </p>
              <p className="text-[#8dc0ce] text-xs mt-2">
                Calling PolicyEngine.evaluateView()
              </p>
            </div>
          )}

          {error && (
            <div className="text-center py-10">
              <span className="material-symbols-outlined text-5xl text-danger-red mb-4">
                error
              </span>
              <p className="text-danger-red text-sm">{error}</p>
            </div>
          )}

          {result && !isLoading && (
            <div className="space-y-4">
              {/* Decision Badge */}
              <div className="text-center">
                <span className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-xl font-black ${
                  result.allowed 
                    ? 'bg-success-green/10 text-success-green' 
                    : 'bg-danger-red/10 text-danger-red'
                }`}>
                  <span className="material-symbols-outlined text-2xl">
                    {result.allowed ? 'check_circle' : 'cancel'}
                  </span>
                  {result.allowed ? 'ALLOWED' : 'BLOCKED'}
                </span>
              </div>

              {/* On-Chain Badge */}
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold">
                  <span className="material-symbols-outlined text-xs">verified</span>
                  VERIFIED ON-CHAIN
                </span>
              </div>

              {/* Reason */}
              <div className={`text-center py-3 px-4 rounded-lg ${
                result.allowed ? 'bg-success-green/10' : 'bg-danger-red/10'
              }`}>
                <p className={`text-sm font-bold ${
                  result.allowed ? 'text-success-green' : 'text-danger-red'
                }`}>
                  {result.allowed ? 'Transaction would EXECUTE' : 'Transaction would REVERT'}
                </p>
                <p className="text-white text-xs mt-1 font-mono">
                  "{result.reason}"
                </p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-background-dark">
                  <span className="text-[#8dc0ce] text-[10px] uppercase font-bold">Sender Blocked</span>
                  <p className={`text-sm font-bold ${result.senderBlocked ? 'text-danger-red' : 'text-success-green'}`}>
                    {result.senderBlocked ? 'YES' : 'NO'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-background-dark">
                  <span className="text-[#8dc0ce] text-[10px] uppercase font-bold">Recipient Blacklisted</span>
                  <p className={`text-sm font-bold ${result.recipientBlacklisted ? 'text-danger-red' : 'text-success-green'}`}>
                    {result.recipientBlacklisted ? 'YES' : 'NO'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-background-dark">
                  <span className="text-[#8dc0ce] text-[10px] uppercase font-bold">Daily Spent</span>
                  <p className="text-white text-sm font-mono">{parseFloat(result.dailySpent).toFixed(2)} CRO</p>
                </div>
                <div className="p-3 rounded-lg bg-background-dark">
                  <span className="text-[#8dc0ce] text-[10px] uppercase font-bold">Daily Remaining</span>
                  <p className="text-white text-sm font-mono">{parseFloat(result.dailyRemaining).toFixed(2)} CRO</p>
                </div>
              </div>

              {/* Transaction Details */}
              <div className="p-3 rounded-lg bg-background-dark border border-border-dark">
                <span className="text-[#8dc0ce] text-[10px] uppercase font-bold block mb-2">Query Details</span>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-[#8dc0ce]">Sender:</span>
                    <span className="text-primary">{result.sender.slice(0, 10)}...{result.sender.slice(-8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8dc0ce]">Recipient:</span>
                    <span className="text-white">{result.recipient.slice(0, 10)}...{result.recipient.slice(-8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8dc0ce]">Amount:</span>
                    <span className="text-yellow-400">{result.amount} CRO</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8dc0ce]">Timestamp:</span>
                    <span className="text-slate-400">{new Date(result.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              {/* TX Hash if executed */}
              {result.txHash && (
                <a
                  href={`${EXPLORER_BASE}/tx/${result.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-3 rounded-lg bg-success-green/10 border border-success-green/30 hover:bg-success-green/20 transition-colors"
                >
                  <span className="text-success-green text-xs font-bold">View Transaction</span>
                  <span className="material-symbols-outlined text-success-green text-sm">open_in_new</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contract Links */}
      <div className="rounded-xl bg-card-dark border border-border-dark p-4">
        <h4 className="text-[#8dc0ce] text-xs uppercase font-bold mb-3 flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">verified</span>
          Verified Contracts
        </h4>
        <div className="space-y-2">
          <a 
            href={`${EXPLORER_BASE}/address/${CONTRACTS.router}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-2 rounded-lg bg-background-dark hover:bg-primary/10 transition-colors group"
          >
            <div>
              <span className="text-white text-xs font-bold">ExecutionRouter</span>
              <span className="text-slate-500 text-[10px] font-mono block">
                {CONTRACTS.router.slice(0, 10)}...{CONTRACTS.router.slice(-8)}
              </span>
            </div>
            <span className="material-symbols-outlined text-primary text-sm group-hover:translate-x-0.5 transition-transform">
              open_in_new
            </span>
          </a>
          <a 
            href={`${EXPLORER_BASE}/address/${CONTRACTS.policyEngine}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-2 rounded-lg bg-background-dark hover:bg-primary/10 transition-colors group"
          >
            <div>
              <span className="text-white text-xs font-bold">PolicyEngine</span>
              <span className="text-slate-500 text-[10px] font-mono block">
                {CONTRACTS.policyEngine.slice(0, 10)}...{CONTRACTS.policyEngine.slice(-8)}
              </span>
            </div>
            <span className="material-symbols-outlined text-primary text-sm group-hover:translate-x-0.5 transition-transform">
              open_in_new
            </span>
          </a>
        </div>
      </div>
    </>
  );
}

export default OnChainResultComponent;
