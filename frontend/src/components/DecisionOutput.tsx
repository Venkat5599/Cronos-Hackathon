import { SimulationResponse, DecisionStatus } from '../types';

// Deployed contract addresses on Cronos Testnet
const CONTRACTS = {
  policyEngine: '0xb1385C18FC4326420fFb41C299Cb2C8a4802B5c2',
  router: '0x2ffE191B2086551BA80DabfFC77652BED4a179ee',
};
const EXPLORER_BASE = 'https://cronos.org/explorer/testnet3/address';

interface DecisionOutputProps {
  result: SimulationResponse | null;
  status: DecisionStatus;
  error: string | null;
}

function DecisionOutput({ result, status, error }: DecisionOutputProps) {
  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'ALLOW': return 'text-success-green border-success-green/30';
      case 'BLOCK': return 'text-danger-red border-danger-red/30';
      case 'LIMIT': return 'text-yellow-400 border-yellow-400/30';
      case 'DELAY': return 'text-orange-400 border-orange-400/30';
      default: return 'text-[#8dc0ce] border-border-dark';
    }
  };

  const getDecisionBg = (decision: string) => {
    switch (decision) {
      case 'ALLOW': return 'bg-success-green/10';
      case 'BLOCK': return 'bg-danger-red/10';
      case 'LIMIT': return 'bg-yellow-400/10';
      case 'DELAY': return 'bg-orange-400/10';
      default: return '';
    }
  };

  const getEnforcementMessage = (decision: string) => {
    switch (decision) {
      case 'ALLOW': return 'Transaction would be EXECUTED';
      case 'BLOCK': return 'Transaction would be REVERTED';
      case 'LIMIT': return 'Transaction would be RATE LIMITED';
      case 'DELAY': return 'Transaction would be DELAYED';
      default: return 'Unknown enforcement action';
    }
  };

  const getEventName = (decision: string) => {
    return decision === 'ALLOW' ? 'PaymentExecuted' : 'PaymentBlocked';
  };

  return (
    <>
      <div className="px-2">
        <h3 className="text-white text-sm font-bold uppercase tracking-wider flex items-center gap-2">
          <span className="material-symbols-outlined text-success-green text-sm">verified_user</span>
          On-Chain Enforcement
        </h3>
      </div>

      {/* Main Decision Card */}
      <div className={`rounded-xl bg-card-dark border-2 p-6 shadow-2xl relative overflow-hidden ${
        result ? getDecisionColor(result.decision) : 'border-border-dark'
      }`}>
        {result && (
          <div className={`absolute -right-8 -top-8 size-32 rounded-full blur-3xl ${getDecisionBg(result.decision)}`} />
        )}
        
        <div className="relative z-10">
          {status === 'idle' && (
            <div className="text-center py-10">
              <span className="material-symbols-outlined text-5xl text-[#8dc0ce]/30 mb-4">
                shield_lock
              </span>
              <p className="text-[#8dc0ce] text-sm">
                Submit an intent to simulate on-chain enforcement
              </p>
            </div>
          )}

          {status === 'loading' && (
            <div className="text-center py-10">
              <span className="material-symbols-outlined text-5xl text-primary animate-pulse mb-4">
                hourglass_empty
              </span>
              <p className="text-[#8dc0ce] text-sm">
                Evaluating policy rules...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-10">
              <span className="material-symbols-outlined text-5xl text-danger-red mb-4">
                error
              </span>
              <p className="text-danger-red text-sm">{error}</p>
            </div>
          )}

          {status === 'success' && result && (
            <div className="space-y-6">
              {/* Decision Badge */}
              <div className="text-center">
                <span className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-2xl font-black ${getDecisionBg(result.decision)} ${getDecisionColor(result.decision).split(' ')[0]}`}>
                  <span className="material-symbols-outlined text-3xl">
                    {result.decision === 'ALLOW' ? 'check_circle' : 
                     result.decision === 'BLOCK' ? 'cancel' : 'warning'}
                  </span>
                  {result.decision}
                </span>
              </div>

              {/* Enforcement Message */}
              <div className={`text-center py-3 px-4 rounded-lg ${getDecisionBg(result.decision)}`}>
                <p className={`text-sm font-bold ${getDecisionColor(result.decision).split(' ')[0]}`}>
                  {getEnforcementMessage(result.decision)}
                </p>
                <p className="text-[#8dc0ce] text-xs mt-1">
                  {result.decision === 'ALLOW' 
                    ? 'PolicyEngine.evaluate() returned true' 
                    : 'PolicyEngine.evaluate() returned false - ExecutionRouter reverts'}
                </p>
              </div>

              {/* Risk Score */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-background-dark">
                <span className="text-[#8dc0ce] text-xs uppercase font-bold">Risk Score</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        result.riskScore < 30 ? 'bg-success-green' :
                        result.riskScore < 70 ? 'bg-yellow-400' : 'bg-danger-red'
                      }`}
                      style={{ width: `${result.riskScore}%` }}
                    />
                  </div>
                  <span className="text-white font-mono text-sm font-bold">{result.riskScore}</span>
                </div>
              </div>

              {/* Reason */}
              {result.policyReason && (
                <div className="p-3 rounded-lg bg-background-dark">
                  <span className="text-[#8dc0ce] text-xs uppercase font-bold block mb-1">Policy Reason</span>
                  <p className="text-white text-sm">{result.policyReason}</p>
                </div>
              )}

              {/* Simulated Event Log */}
              <div className="p-3 rounded-lg bg-background-dark border border-border-dark">
                <span className="text-[#8dc0ce] text-xs uppercase font-bold block mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">receipt_long</span>
                  Simulated Event Log
                </span>
                <div className="font-mono text-xs space-y-1">
                  <div className={`p-2 rounded ${getDecisionBg(result.decision)}`}>
                    <span className={`font-bold ${getDecisionColor(result.decision).split(' ')[0]}`}>
                      {getEventName(result.decision)}
                    </span>
                    <span className="text-slate-400">(</span>
                  </div>
                  <div className="pl-4 text-slate-300">
                    <div>sender: <span className="text-primary">msg.sender</span>,</div>
                    <div>recipient: <span className="text-primary">{result.intentHash?.slice(0, 10)}...</span>,</div>
                    <div>amount: <span className="text-yellow-400">parsed_amount</span>,</div>
                    {result.decision !== 'ALLOW' && (
                      <div>reason: <span className="text-danger-red">"{result.policyReason}"</span></div>
                    )}
                  </div>
                  <div className="text-slate-400">)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contract Explorer Links */}
      <div className="rounded-xl bg-card-dark border border-border-dark p-4">
        <h4 className="text-[#8dc0ce] text-xs uppercase font-bold mb-3 flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">link</span>
          Deployed Contracts
        </h4>
        <div className="space-y-2">
          <a 
            href={`${EXPLORER_BASE}/${CONTRACTS.router}`}
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
            href={`${EXPLORER_BASE}/${CONTRACTS.policyEngine}`}
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

export default DecisionOutput;
