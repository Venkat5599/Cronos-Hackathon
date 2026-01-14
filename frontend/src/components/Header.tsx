export type Page = 'dashboard' | 'policies' | 'logs';

interface HeaderProps {
  networkStatus: 'online' | 'offline' | 'checking';
  currentPage: Page;
  onNavigate: (page: Page) => void;
  walletAddress: string | null;
  isConnecting: boolean;
  isCorrectChain: boolean;
  walletError: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onSwitchChain: () => void;
}

function Header({ 
  networkStatus, 
  currentPage, 
  onNavigate,
  walletAddress,
  isConnecting,
  isCorrectChain,
  onConnect,
  onDisconnect,
  onSwitchChain,
}: HeaderProps) {
  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0f12]/80 border-b border-white/5">
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#00d4ff] to-[#00ff88] rounded-xl blur-lg opacity-50" />
            <div className="relative size-10 bg-gradient-to-br from-[#00d4ff] to-[#00ff88] rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[#0a0f12] text-xl font-bold">shield</span>
            </div>
          </div>
          <div>
            <h1 className="text-white text-xl font-black tracking-tight">
              x402 <span className="bg-gradient-to-r from-[#00d4ff] to-[#00ff88] bg-clip-text text-transparent">Firewall</span>
            </h1>
            <p className="text-[#8dc0ce] text-[10px] font-medium uppercase tracking-widest">
              On-Chain Security Layer
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-2">
          {[
            { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
            { key: 'policies', label: 'Policies', icon: 'policy' },
            { key: 'logs', label: 'Audit Logs', icon: 'receipt_long' },
          ].map((item) => (
            <button 
              key={item.key}
              onClick={() => onNavigate(item.key as Page)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                currentPage === item.key 
                  ? 'bg-gradient-to-r from-[#00d4ff]/20 to-[#00ff88]/20 text-white border border-[#00d4ff]/30' 
                  : 'text-[#8dc0ce] hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-sm">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          {/* Network Badge */}
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
            networkStatus === 'online' 
              ? 'bg-[#00ff88]/10 border-[#00ff88]/30' 
              : networkStatus === 'offline'
              ? 'bg-[#ff4757]/10 border-[#ff4757]/30'
              : 'bg-[#ffa502]/10 border-[#ffa502]/30'
          }`}>
            <span className={`size-2 rounded-full ${
              networkStatus === 'online' ? 'bg-[#00ff88] animate-pulse' :
              networkStatus === 'offline' ? 'bg-[#ff4757]' : 'bg-[#ffa502] animate-pulse'
            }`} />
            <span className={`text-xs font-bold ${
              networkStatus === 'online' ? 'text-[#00ff88]' :
              networkStatus === 'offline' ? 'text-[#ff4757]' : 'text-[#ffa502]'
            }`}>
              CRONOS
            </span>
          </div>

          {/* Wallet */}
          {walletAddress ? (
            <div className="flex items-center gap-2">
              {!isCorrectChain && (
                <button
                  onClick={onSwitchChain}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#ffa502]/10 border border-[#ffa502]/30 text-[#ffa502] text-xs font-bold hover:bg-[#ffa502]/20 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Switch Network
                </button>
              )}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/30">
                <span className="size-2 rounded-full bg-[#00ff88] animate-pulse" />
                <span className="text-[#00ff88] text-xs font-mono font-bold">
                  {truncateAddress(walletAddress)}
                </span>
              </div>
              <button
                onClick={onDisconnect}
                className="p-2 rounded-xl bg-[#ff4757]/10 border border-[#ff4757]/30 text-[#ff4757] hover:bg-[#ff4757]/20 transition-all"
                title="Disconnect"
              >
                <span className="material-symbols-outlined text-sm">logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00ff88] text-[#0a0f12] text-sm font-bold hover:shadow-lg hover:shadow-[#00d4ff]/25 transition-all disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  Connecting...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                  Connect
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
