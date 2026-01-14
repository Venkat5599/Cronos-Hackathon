import { useState, useEffect } from 'react';
import Header, { Page } from './components/Header';
import SecurityPolicies from './components/SecurityPolicies';
import AuditLogs from './components/AuditLogs';
import Footer from './components/Footer';
import { SimulationResponse } from './types';
import { useWallet } from './hooks/useWallet';
import { useContracts, EvaluationResult, ExecutionResult, EXPLORER_BASE, CONTRACTS, FirewallStats } from './hooks/useContracts';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [recipient, setRecipient] = useState('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
  const [amount, setAmount] = useState('0.01');
  const [preCheckResult, setPreCheckResult] = useState<EvaluationResult | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [firewallStats, setFirewallStats] = useState<FirewallStats | null>(null);
  const [history, setHistory] = useState<SimulationResponse[]>([]);

  const wallet = useWallet();
  const contracts = useContracts();

  const networkStatus = wallet.isConnected 
    ? wallet.isCorrectChain ? 'online' : 'offline'
    : 'checking';

  // Fetch data on mount and after transactions
  useEffect(() => {
    const fetchData = async () => {
      try {
        const stats = await contracts.fetchFirewallStats();
        setFirewallStats(stats);
      } catch (e) { console.error(e); }
    };
    fetchData();
  }, [executionResult]);

  useEffect(() => {
    if (wallet.address && wallet.isCorrectChain) {
      contracts.getWalletBalance(wallet.address).then(setWalletBalance);
    }
  }, [wallet.address, wallet.isCorrectChain, executionResult]);

  const handlePreCheck = async () => {
    if (!wallet.address) return;
    setExecutionResult(null);
    try {
      const result = await contracts.evaluatePayment(wallet.address, recipient, amount);
      setPreCheckResult(result);
    } catch (err) { console.error(err); }
  };

  const handleExecutePayment = async () => {
    if (!wallet.address || !wallet.isCorrectChain) return;
    try {
      const result = await contracts.executeRealPayment(recipient, amount);
      setExecutionResult(result);
      const historyEntry: SimulationResponse = {
        intentHash: result.txHash || `0x${Date.now().toString(16)}`,
        decision: result.success ? 'ALLOW' : 'BLOCK',
        riskScore: result.success ? 10 : 90,
        riskLevel: result.success ? 'low' : 'high',
        policyReason: result.success ? 'Payment executed' : (result.revertReason || result.error || 'Reverted'),
        estimatedGas: result.gasUsed || '0',
        networkLatency: 0,
        simulatedAt: Date.now(),
        intent: { category: 'payment', explanation: 'On-chain', confidence: 100 },
        anomalies: result.success ? [] : [result.error || 'Blocked'],
        factors: [],
      };
      setHistory(prev => [historyEntry, ...prev].slice(0, 50));
      if (wallet.address) {
        contracts.getWalletBalance(wallet.address).then(setWalletBalance);
      }
    } catch (err) { console.error(err); }
  };

  const presets = {
    small: { recipient: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', amount: '0.01' },
    medium: { recipient: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', amount: '100' },
    overLimit: { recipient: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', amount: '15000' },
  };

  const applyPreset = (preset: keyof typeof presets) => {
    setRecipient(presets[preset].recipient);
    setAmount(presets[preset].amount);
    setPreCheckResult(null);
    setExecutionResult(null);
  };


  return (
    <div className="min-h-screen bg-[#0a0f12] text-white overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#00d4ff]/10 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#00ff88]/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#6366f1]/5 rounded-full blur-[200px]" />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      <Header 
        networkStatus={networkStatus} 
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        walletAddress={wallet.address}
        isConnecting={wallet.isConnecting}
        isCorrectChain={wallet.isCorrectChain}
        walletError={wallet.error}
        onConnect={wallet.connect}
        onDisconnect={wallet.disconnect}
        onSwitchChain={wallet.switchToCronosTestnet}
      />
      
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {currentPage === 'dashboard' && (
          <>
            {/* Hero Section */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#00d4ff]/20 to-[#00ff88]/20 border border-[#00d4ff]/30 mb-6">
                <span className="size-2 rounded-full bg-[#00ff88] animate-pulse" />
                <span className="text-[#00d4ff] text-sm font-medium">Live on Cronos Testnet</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-white via-[#00d4ff] to-[#00ff88] bg-clip-text text-transparent mb-4">
                x402 Payment Firewall
              </h1>
              <p className="text-[#8dc0ce] text-lg max-w-2xl mx-auto">
                On-chain security layer that <span className="text-white font-semibold">physically blocks</span> unauthorized payments. 
                Not warnings — real enforcement.
              </p>
            </div>

            {/* Stats Bar */}
            {firewallStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total Intents', value: firewallStats.totalIntents, color: 'text-white' },
                  { label: 'Executed', value: firewallStats.totalExecuted, color: 'text-[#00ff88]' },
                  { label: 'Blocked', value: firewallStats.totalBlocked, color: 'text-[#ff4757]' },
                  { label: 'Volume', value: `${parseFloat(firewallStats.totalVolume).toFixed(2)} CRO`, color: 'text-[#00d4ff]' },
                ].map((stat, i) => (
                  <div key={i} className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#00d4ff]/20 to-[#00ff88]/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative p-4 rounded-2xl bg-[#111820]/80 border border-white/5 backdrop-blur-sm">
                      <p className="text-[#8dc0ce] text-xs uppercase tracking-wider mb-1">{stat.label}</p>
                      <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}


            {/* Wallet Status */}
            {wallet.isConnected && wallet.isCorrectChain && (
              <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-[#00ff88]/10 to-[#00d4ff]/10 border border-[#00ff88]/30 backdrop-blur-sm">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-[#00ff88]/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#00ff88] text-2xl">account_balance_wallet</span>
                    </div>
                    <div>
                      <p className="text-[#8dc0ce] text-xs uppercase tracking-wider">Connected Wallet</p>
                      <p className="text-white font-mono font-bold">{wallet.address?.slice(0, 12)}...{wallet.address?.slice(-8)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#8dc0ce] text-xs uppercase tracking-wider">Balance</p>
                    <p className="text-3xl font-black text-white">{walletBalance ? `${parseFloat(walletBalance).toFixed(4)}` : '...'} <span className="text-[#00d4ff] text-lg">tCRO</span></p>
                  </div>
                </div>
              </div>
            )}

            {/* Test Presets */}
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <span className="text-[#8dc0ce] text-sm font-medium">Quick Test:</span>
              {[
                { key: 'small', label: '0.01 CRO', desc: 'Should Pass', color: 'from-[#00ff88] to-[#00d4ff]', icon: 'check_circle' },
                { key: 'medium', label: '100 CRO', desc: 'Should Pass', color: 'from-[#00d4ff] to-[#6366f1]', icon: 'check_circle' },
                { key: 'overLimit', label: '15,000 CRO', desc: 'Will Block', color: 'from-[#ff4757] to-[#ff6b81]', icon: 'block' },
              ].map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => applyPreset(preset.key as keyof typeof presets)}
                  className="group relative px-4 py-2 rounded-xl overflow-hidden transition-transform hover:scale-105"
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${preset.color} opacity-20 group-hover:opacity-30 transition-opacity`} />
                  <div className="relative flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">{preset.icon}</span>
                    <span className="font-bold">{preset.label}</span>
                    <span className="text-xs opacity-60">({preset.desc})</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Payment Form */}
              <div className="space-y-6">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#00d4ff] to-[#00ff88] rounded-3xl blur-lg opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className="relative p-6 rounded-2xl bg-[#111820]/90 border border-white/10 backdrop-blur-xl">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="size-10 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00ff88] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#0a0f12]">send</span>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Execute Payment</h2>
                        <p className="text-[#8dc0ce] text-sm">Through x402 Firewall</p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <label className="text-[#8dc0ce] text-xs uppercase tracking-wider font-medium block mb-2">Recipient Address</label>
                        <input
                          type="text"
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value)}
                          className="w-full bg-[#0a0f12] border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff]/50 transition-all"
                          placeholder="0x..."
                        />
                      </div>

                      <div>
                        <label className="text-[#8dc0ce] text-xs uppercase tracking-wider font-medium block mb-2">Amount (CRO)</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-[#0a0f12] border border-white/10 rounded-xl px-4 py-4 text-white font-mono text-3xl font-bold focus:outline-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff]/50 transition-all"
                            placeholder="0.00"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#00d4ff] font-bold">CRO</span>
                        </div>
                      </div>

                      {/* Policy Info */}
                      <div className="p-4 rounded-xl bg-[#0a0f12]/50 border border-white/5">
                        <p className="text-[#8dc0ce] text-xs uppercase tracking-wider mb-3">Policy Limits</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-white font-bold">10,000 CRO</p>
                            <p className="text-[#8dc0ce] text-xs">Max per transaction</p>
                          </div>
                          <div>
                            <p className="text-white font-bold">50,000 CRO</p>
                            <p className="text-[#8dc0ce] text-xs">Daily limit</p>
                          </div>
                        </div>
                      </div>
                    </div>


                    {/* Action Buttons */}
                    <div className="mt-6 space-y-3">
                      {!wallet.isConnected ? (
                        <>
                          {wallet.hasMetaMask ? (
                            <button
                              onClick={wallet.connectMetaMask}
                              disabled={wallet.isConnecting}
                              className="w-full py-4 rounded-xl bg-gradient-to-r from-[#f6851b] to-[#e2761b] text-white font-bold flex items-center justify-center gap-3 hover:shadow-lg hover:shadow-[#f6851b]/25 transition-all disabled:opacity-50"
                            >
                              {wallet.isConnecting ? (
                                <><span className="material-symbols-outlined animate-spin">progress_activity</span> Connecting...</>
                              ) : (
                                <><span className="text-2xl">🦊</span> Connect MetaMask</>
                              )}
                            </button>
                          ) : (
                            <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer"
                              className="w-full py-4 rounded-xl bg-gradient-to-r from-[#f6851b] to-[#e2761b] text-white font-bold flex items-center justify-center gap-3 hover:shadow-lg hover:shadow-[#f6851b]/25 transition-all">
                              <span className="text-2xl">🦊</span> Install MetaMask
                            </a>
                          )}
                          {wallet.error && <p className="text-[#ff4757] text-xs text-center">{wallet.error}</p>}
                        </>
                      ) : !wallet.isCorrectChain ? (
                        <button onClick={wallet.switchToCronosTestnet}
                          className="w-full py-4 rounded-xl bg-gradient-to-r from-[#ffa502] to-[#ff6348] text-white font-bold flex items-center justify-center gap-3">
                          <span className="material-symbols-outlined">swap_horiz</span> Switch to Cronos Testnet
                        </button>
                      ) : (
                        <>
                          <button onClick={handlePreCheck} disabled={contracts.isLoading}
                            className="w-full py-3 rounded-xl bg-[#0a0f12] border border-[#00d4ff]/50 text-[#00d4ff] font-bold flex items-center justify-center gap-2 hover:bg-[#00d4ff]/10 transition-all disabled:opacity-50">
                            {contracts.isLoading ? (
                              <><span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> Checking...</>
                            ) : (
                              <><span className="material-symbols-outlined text-sm">search</span> Pre-Check Policy</>
                            )}
                          </button>
                          <button onClick={handleExecutePayment} disabled={contracts.isExecuting || parseFloat(amount) <= 0}
                            className="w-full py-4 rounded-xl bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-[#0a0f12] font-bold flex items-center justify-center gap-3 hover:shadow-lg hover:shadow-[#00ff88]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                            {contracts.isExecuting ? (
                              <><span className="material-symbols-outlined animate-spin">progress_activity</span> Executing...</>
                            ) : (
                              <><span className="material-symbols-outlined">bolt</span> Execute Real Payment</>
                            )}
                          </button>
                          <p className="text-center text-[#8dc0ce] text-xs flex items-center justify-center gap-1">
                            <span className="material-symbols-outlined text-xs">info</span>
                            Sends real tCRO through the firewall contract
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Results Panel */}
              <div className="space-y-6">
                {/* Pre-Check Result */}
                {preCheckResult && (
                  <div className="relative group">
                    <div className={`absolute -inset-1 rounded-3xl blur-lg opacity-30 ${preCheckResult.allowed ? 'bg-[#00ff88]' : 'bg-[#ff4757]'}`} />
                    <div className="relative p-6 rounded-2xl bg-[#111820]/90 border border-white/10 backdrop-blur-xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`size-12 rounded-xl flex items-center justify-center ${preCheckResult.allowed ? 'bg-[#00ff88]/20' : 'bg-[#ff4757]/20'}`}>
                          <span className={`material-symbols-outlined text-2xl ${preCheckResult.allowed ? 'text-[#00ff88]' : 'text-[#ff4757]'}`}>
                            {preCheckResult.allowed ? 'verified' : 'gpp_bad'}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">Policy Pre-Check</h3>
                          <p className={`text-sm font-bold ${preCheckResult.allowed ? 'text-[#00ff88]' : 'text-[#ff4757]'}`}>
                            {preCheckResult.allowed ? 'WILL PASS' : 'WILL BE BLOCKED'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-[#0a0f12]/50">
                          <p className="text-[#8dc0ce] text-xs uppercase tracking-wider mb-1">Reason</p>
                          <p className="text-white text-sm font-medium">{preCheckResult.reason}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg bg-[#0a0f12]/50">
                            <p className="text-[#8dc0ce] text-xs uppercase tracking-wider mb-1">Daily Spent</p>
                            <p className="text-white font-bold">{parseFloat(preCheckResult.dailySpent).toFixed(2)} CRO</p>
                          </div>
                          <div className="p-3 rounded-lg bg-[#0a0f12]/50">
                            <p className="text-[#8dc0ce] text-xs uppercase tracking-wider mb-1">Daily Remaining</p>
                            <p className="text-[#00ff88] font-bold">{parseFloat(preCheckResult.dailyRemaining).toFixed(2)} CRO</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Execution Result */}
                {executionResult && (
                  <div className="relative group">
                    <div className={`absolute -inset-1 rounded-3xl blur-lg opacity-30 ${executionResult.success ? 'bg-[#00ff88]' : 'bg-[#ff4757]'}`} />
                    <div className="relative p-6 rounded-2xl bg-[#111820]/90 border border-white/10 backdrop-blur-xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`size-12 rounded-xl flex items-center justify-center ${executionResult.success ? 'bg-[#00ff88]/20' : 'bg-[#ff4757]/20'}`}>
                          <span className={`material-symbols-outlined text-2xl ${executionResult.success ? 'text-[#00ff88]' : 'text-[#ff4757]'}`}>
                            {executionResult.success ? 'check_circle' : 'cancel'}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">Execution Result</h3>
                          <p className={`text-sm font-bold ${executionResult.success ? 'text-[#00ff88]' : 'text-[#ff4757]'}`}>
                            {executionResult.success ? 'PAYMENT EXECUTED' : 'PAYMENT BLOCKED'}
                          </p>
                        </div>
                      </div>
                      {executionResult.success ? (
                        <div className="space-y-3">
                          <a href={`${EXPLORER_BASE}/tx/${executionResult.txHash}`} target="_blank" rel="noopener noreferrer"
                            className="block p-4 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/30 hover:bg-[#00ff88]/20 transition-colors">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[#8dc0ce] text-xs uppercase tracking-wider mb-1">Transaction Hash</p>
                                <p className="text-[#00ff88] font-mono text-sm">{executionResult.txHash.slice(0, 20)}...{executionResult.txHash.slice(-8)}</p>
                              </div>
                              <span className="material-symbols-outlined text-[#00ff88]">open_in_new</span>
                            </div>
                          </a>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-[#0a0f12]/50">
                              <p className="text-[#8dc0ce] text-xs uppercase tracking-wider mb-1">Block</p>
                              <p className="text-white font-bold">#{executionResult.blockNumber}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-[#0a0f12]/50">
                              <p className="text-[#8dc0ce] text-xs uppercase tracking-wider mb-1">Gas Used</p>
                              <p className="text-white font-bold">{parseInt(executionResult.gasUsed || '0').toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-[#ff4757]/10 border border-[#ff4757]/30">
                          <p className="text-[#8dc0ce] text-xs uppercase tracking-wider mb-1">Revert Reason</p>
                          <p className="text-[#ff4757] font-medium">{executionResult.revertReason || executionResult.error}</p>
                          <p className="text-[#8dc0ce] text-xs mt-2">
                            The firewall contract blocked this payment based on policy rules.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Contract Info Card */}
                <div className="p-5 rounded-2xl bg-[#111820]/60 border border-white/5">
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#00d4ff]">deployed_code</span>
                    Verified Contracts
                    <span className="text-[#00ff88] text-xs ml-auto">✅ Source Verified</span>
                  </h3>
                  <div className="space-y-3">
                    <a href={`${EXPLORER_BASE}/address/${CONTRACTS.firewall}#code`} target="_blank" rel="noopener noreferrer"
                      className="block p-3 rounded-xl bg-[#0a0f12]/50 hover:bg-[#0a0f12] transition-colors group">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[#8dc0ce] text-xs uppercase tracking-wider">X402PaymentFirewall</p>
                          <p className="text-[#00d4ff] font-mono text-xs mt-1">{CONTRACTS.firewall.slice(0, 18)}...</p>
                        </div>
                        <span className="material-symbols-outlined text-[#8dc0ce] group-hover:text-[#00d4ff] transition-colors">open_in_new</span>
                      </div>
                    </a>
                    <a href={`${EXPLORER_BASE}/address/${CONTRACTS.policyEngine}#code`} target="_blank" rel="noopener noreferrer"
                      className="block p-3 rounded-xl bg-[#0a0f12]/50 hover:bg-[#0a0f12] transition-colors group">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[#8dc0ce] text-xs uppercase tracking-wider">X402PolicyEngine</p>
                          <p className="text-[#00d4ff] font-mono text-xs mt-1">{CONTRACTS.policyEngine.slice(0, 18)}...</p>
                        </div>
                        <span className="material-symbols-outlined text-[#8dc0ce] group-hover:text-[#00d4ff] transition-colors">open_in_new</span>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction History */}
            {history.length > 0 && (
              <div className="mt-12">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#00d4ff]">history</span>
                  Recent Transactions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {history.slice(0, 6).map((item, i) => (
                    <div key={i} className={`p-4 rounded-xl border backdrop-blur-sm ${
                      item.decision === 'ALLOW' 
                        ? 'bg-[#00ff88]/5 border-[#00ff88]/20' 
                        : 'bg-[#ff4757]/5 border-[#ff4757]/20'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          item.decision === 'ALLOW' 
                            ? 'bg-[#00ff88]/20 text-[#00ff88]' 
                            : 'bg-[#ff4757]/20 text-[#ff4757]'
                        }`}>
                          {item.decision}
                        </span>
                        <span className="text-[#8dc0ce] text-xs">
                          {new Date(item.simulatedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-white font-mono text-xs truncate">{item.intentHash}</p>
                      <p className="text-[#8dc0ce] text-xs mt-2 truncate">{item.policyReason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {currentPage === 'policies' && <SecurityPolicies />}
        {currentPage === 'logs' && <AuditLogs history={history} />}
      </main>

      <Footer />
    </div>
  );
}

export default App;