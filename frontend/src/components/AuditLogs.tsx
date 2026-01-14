import { SimulationResponse } from '../types';
import { CONTRACTS, EXPLORER_BASE } from '../hooks/useContracts';

interface AuditLogsProps {
  history: SimulationResponse[];
}

function AuditLogs({ history }: AuditLogsProps) {
  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString();

  const stats = {
    total: history.length,
    allowed: history.filter(h => h.decision === 'ALLOW').length,
    blocked: history.filter(h => h.decision === 'BLOCK').length,
    other: history.filter(h => h.decision === 'LIMIT' || h.decision === 'DELAY').length,
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#6366f1]/20 to-[#00d4ff]/20 border border-[#6366f1]/30 mb-6">
          <span className="material-symbols-outlined text-[#6366f1]">receipt_long</span>
          <span className="text-[#00d4ff] text-sm font-medium">Transaction History</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
          Audit Logs
        </h1>
        <p className="text-[#8dc0ce] text-lg max-w-2xl mx-auto">
          Complete history of payment attempts and on-chain enforcement decisions.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#111820]/80 border border-white/5 backdrop-blur-sm">
          <p className="text-[#8dc0ce] text-xs uppercase tracking-wider mb-2">Total</p>
          <p className="text-3xl font-black text-white">{stats.total}</p>
        </div>
        <div className="p-5 rounded-2xl bg-[#111820]/80 border border-[#00ff88]/20 backdrop-blur-sm">
          <p className="text-[#8dc0ce] text-xs uppercase tracking-wider mb-2">Allowed</p>
          <p className="text-3xl font-black text-[#00ff88]">{stats.allowed}</p>
        </div>
        <div className="p-5 rounded-2xl bg-[#111820]/80 border border-[#ff4757]/20 backdrop-blur-sm">
          <p className="text-[#8dc0ce] text-xs uppercase tracking-wider mb-2">Blocked</p>
          <p className="text-3xl font-black text-[#ff4757]">{stats.blocked}</p>
        </div>
        <div className="p-5 rounded-2xl bg-[#111820]/80 border border-[#ffa502]/20 backdrop-blur-sm">
          <p className="text-[#8dc0ce] text-xs uppercase tracking-wider mb-2">Limited/Delayed</p>
          <p className="text-3xl font-black text-[#ffa502]">{stats.other}</p>
        </div>
      </div>

      {/* On-Chain Events Info */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#00d4ff]/10 to-[#6366f1]/10 border border-[#00d4ff]/30">
        <div className="flex items-start gap-4">
          <div className="size-10 rounded-xl bg-[#00d4ff]/20 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[#00d4ff]">info</span>
          </div>
          <div>
            <h4 className="text-white font-bold">On-Chain Event Logging</h4>
            <p className="text-[#8dc0ce] text-sm mt-1">
              All enforcement decisions are recorded as blockchain events:
            </p>
            <div className="flex flex-wrap gap-3 mt-3">
              <code className="text-[#00ff88] text-xs bg-[#00ff88]/10 px-3 py-1.5 rounded-lg border border-[#00ff88]/30">
                PaymentExecuted(sender, recipient, amount)
              </code>
              <code className="text-[#ff4757] text-xs bg-[#ff4757]/10 px-3 py-1.5 rounded-lg border border-[#ff4757]/30">
                PaymentBlocked(sender, recipient, amount, reason)
              </code>
            </div>
            <a
              href={`${EXPLORER_BASE}/address/${CONTRACTS.firewall}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#00d4ff] text-sm mt-3 hover:underline"
            >
              View contract events on explorer
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </a>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-2xl bg-[#111820]/80 border border-white/5 backdrop-blur-sm overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <h3 className="text-white font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00d4ff]">history</span>
            Session History
          </h3>
        </div>

        {history.length === 0 ? (
          <div className="p-16 text-center">
            <div className="size-20 rounded-2xl bg-[#0a0f12]/50 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-5xl text-[#8dc0ce]/30">receipt_long</span>
            </div>
            <p className="text-white font-bold mb-2">No transactions yet</p>
            <p className="text-[#8dc0ce] text-sm">
              Execute a payment from the Dashboard to see logs here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#0a0f12]/50 text-left">
                  <th className="px-5 py-4 text-[#8dc0ce] text-xs uppercase font-bold tracking-wider">Time</th>
                  <th className="px-5 py-4 text-[#8dc0ce] text-xs uppercase font-bold tracking-wider">TX Hash</th>
                  <th className="px-5 py-4 text-[#8dc0ce] text-xs uppercase font-bold tracking-wider">Decision</th>
                  <th className="px-5 py-4 text-[#8dc0ce] text-xs uppercase font-bold tracking-wider">Risk</th>
                  <th className="px-5 py-4 text-[#8dc0ce] text-xs uppercase font-bold tracking-wider">Reason</th>
                  <th className="px-5 py-4 text-[#8dc0ce] text-xs uppercase font-bold tracking-wider">Event</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, i) => (
                  <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-4 text-white text-xs font-mono">
                      {formatTime(item.simulatedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <a 
                        href={`${EXPLORER_BASE}/tx/${item.intentHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#00d4ff] text-xs font-mono hover:underline"
                      >
                        {item.intentHash.slice(0, 16)}...
                      </a>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                        item.decision === 'ALLOW' 
                          ? 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30' 
                          : item.decision === 'BLOCK'
                          ? 'bg-[#ff4757]/10 text-[#ff4757] border border-[#ff4757]/30'
                          : 'bg-[#ffa502]/10 text-[#ffa502] border border-[#ffa502]/30'
                      }`}>
                        <span className="material-symbols-outlined text-xs">
                          {item.decision === 'ALLOW' ? 'check_circle' : item.decision === 'BLOCK' ? 'cancel' : 'warning'}
                        </span>
                        {item.decision}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-[#0a0f12] rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              item.riskScore < 30 ? 'bg-[#00ff88]' :
                              item.riskScore < 70 ? 'bg-[#ffa502]' : 'bg-[#ff4757]'
                            }`}
                            style={{ width: `${item.riskScore}%` }}
                          />
                        </div>
                        <span className="text-white text-xs font-mono">{item.riskScore}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[#8dc0ce] text-xs max-w-[200px] truncate">
                      {item.policyReason}
                    </td>
                    <td className="px-5 py-4">
                      <code className={`text-[10px] px-2 py-1 rounded-lg ${
                        item.decision === 'ALLOW'
                          ? 'bg-[#00ff88]/10 text-[#00ff88]'
                          : 'bg-[#ff4757]/10 text-[#ff4757]'
                      }`}>
                        {item.decision === 'ALLOW' ? 'PaymentExecuted' : 'PaymentBlocked'}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export */}
      <div className="p-5 rounded-2xl bg-[#111820]/80 border border-white/5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-10 rounded-xl bg-[#6366f1]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#6366f1]">download</span>
            </div>
            <div>
              <span className="text-white font-bold">Export Logs</span>
              <p className="text-[#8dc0ce] text-xs">Download session history as JSON</p>
            </div>
          </div>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `x402-audit-logs-${Date.now()}.json`;
              a.click();
            }}
            disabled={history.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6366f1]/10 border border-[#6366f1]/30 text-[#6366f1] text-sm font-bold hover:bg-[#6366f1]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export JSON
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuditLogs;
