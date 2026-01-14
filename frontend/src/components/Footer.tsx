import { CONTRACTS, EXPLORER_BASE } from '../hooks/useContracts';

function Footer() {
  return (
    <footer className="mt-16 pb-8">
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Main Footer Content */}
        <div className="p-6 rounded-2xl bg-[#111820]/60 border border-white/5 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Brand */}
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#00ff88] flex items-center justify-center">
                <span className="material-symbols-outlined text-[#0a0f12] text-2xl">shield</span>
              </div>
              <div>
                <h3 className="text-xl font-black bg-gradient-to-r from-white to-[#00d4ff] bg-clip-text text-transparent">
                  x402 Payment Firewall
                </h3>
                <p className="text-[#8dc0ce] text-xs">Real On-Chain Security for Autonomous Payments</p>
              </div>
            </div>

            {/* Contract Links - VERIFIED */}
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={`${EXPLORER_BASE}/address/${CONTRACTS.firewall}#code`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/30 hover:bg-[#00ff88]/20 transition-all group"
              >
                <span className="text-[#00ff88] text-xs font-bold">✅ Firewall Verified</span>
                <span className="material-symbols-outlined text-[#00ff88] text-sm group-hover:translate-x-0.5 transition-transform">
                  open_in_new
                </span>
              </a>
              <a
                href={`${EXPLORER_BASE}/address/${CONTRACTS.policyEngine}#code`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/30 hover:bg-[#00d4ff]/20 transition-all group"
              >
                <span className="text-[#00d4ff] text-xs font-bold">✅ PolicyEngine Verified</span>
                <span className="material-symbols-outlined text-[#00d4ff] text-sm group-hover:translate-x-0.5 transition-transform">
                  open_in_new
                </span>
              </a>
            </div>
          </div>

          {/* Divider */}
          <div className="my-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Bottom Row */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#00ff88] animate-pulse" />
                <span className="text-[#8dc0ce] text-xs">Live on Cronos Testnet</span>
              </div>
              <div className="text-[#8dc0ce] text-xs">Chain ID: 338</div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-[#8dc0ce] text-xs">Built for</span>
              <div className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#00d4ff]/20 to-[#6366f1]/20 border border-[#00d4ff]/30">
                <span className="text-white text-xs font-bold">Cronos x402 Hackathon 2025</span>
              </div>
            </div>
          </div>
        </div>

        {/* Attribution */}
        <p className="text-center text-[#8dc0ce]/50 text-[10px] mt-4">
          Deterministic On-Chain Policy Enforcement • No AI • No Off-Chain Trust • Pure Smart Contract Security
        </p>
      </div>
    </footer>
  );
}

export default Footer;
