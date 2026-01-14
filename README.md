# 🛡️ x402 Payment Firewall

### The Missing Security Layer for Autonomous Agent Payments

[![Live on Cronos](https://img.shields.io/badge/🔴_LIVE-Cronos_Testnet-00D4FF?style=for-the-badge)](https://cronos.org/explorer/testnet3/address/0xC3C4E069B294C8ED3841c87d527c942F873CFAA9)
[![x402 Protocol](https://img.shields.io/badge/x402-Native_Integration-00FF88?style=for-the-badge)](https://x402.org)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.19-363636?style=for-the-badge&logo=solidity)](https://soliditylang.org/)

---

## 🎯 The Problem We Solve

**AI agents are getting wallets.** x402 enables autonomous payments. But what happens when:

| Threat | Impact | Current Solution |
|--------|--------|------------------|
| 🔓 Agent key compromised | Attacker drains entire wallet | ❌ None |
| 💉 Prompt injection attack | Malicious prompt triggers payments | ❌ None |
| 📈 No spending limits | Single tx empties treasury | ❌ None |
| 🕵️ No audit trail | Can't trace what happened | ❌ None |

**Multi-sig?** Requires human approval → defeats autonomy.  
**Rate limiting?** Off-chain → can be bypassed.  
**Warnings?** Users ignore them.

---

## 💡 Our Solution: On-Chain Enforcement

```
                    ┌─────────────────────────────────────┐
                    │      x402 PAYMENT FIREWALL          │
                    │   "The Bouncer for Your Wallet"     │
                    └─────────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
   ┌─────────┐                 ┌─────────┐                 ┌─────────┐
   │ 0.01 CRO│                 │ 100 CRO │                 │15000 CRO│
   │ Payment │                 │ Payment │                 │ Payment │
   └────┬────┘                 └────┬────┘                 └────┬────┘
        │                           │                           │
        ▼                           ▼                           ▼
   ┌─────────┐                 ┌─────────┐                 ┌─────────┐
   │✅ ALLOW │                 │✅ ALLOW │                 │❌ BLOCK │
   │ Execute │                 │ Execute │                 │ REVERT  │
   └─────────┘                 └─────────┘                 └─────────┘
```

**Not warnings. Not alerts. PHYSICAL ENFORCEMENT.**

The smart contract literally **reverts** unauthorized transactions. Even with the private key, attackers can only operate within policy limits.

---

## 🔴 Live Demo

### Deployed Contracts (Cronos Testnet)

| Contract | Address | Explorer |
|----------|---------|----------|
| **X402PaymentFirewall** | `0xC3C4E069B294C8ED3841c87d527c942F873CFAA9` | [✅ Verified](https://cronos.org/explorer/testnet3/address/0xC3C4E069B294C8ED3841c87d527c942F873CFAA9#code) |
| **X402PolicyEngine** | `0xD0CE6F16969d81997750afE018A34921DeDd04A0` | [✅ Verified](https://cronos.org/explorer/testnet3/address/0xD0CE6F16969d81997750afE018A34921DeDd04A0#code) |

### Try It Yourself

```bash
# Clone & run
git clone https://github.com/[your-repo]/x402-firewall
cd x402-firewall/frontend
npm install && npm run dev

# Open http://localhost:5173
# Connect MetaMask → Cronos Testnet
# Try sending 15,000 CRO → Watch it get BLOCKED
```

### Proof of Enforcement

| Test | Amount | Result | Evidence |
|------|--------|--------|----------|
| Small payment | 0.01 CRO | ✅ Executed | [TX](https://cronos.org/explorer/testnet3/tx/0x26f363226771f9e359b6ed74c67eef0d2314bd21e458dcbfde3583e7b460fbae) |
| Over limit | 15,000 CRO | ❌ Reverted | Policy: Max 10,000 CRO |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                  │
│  React + TypeScript + Vite + TailwindCSS                         │
│  • MetaMask integration (Cronos Testnet auto-switch)             │
│  • Real-time policy display                                       │
│  • Transaction history                                            │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    SMART CONTRACTS                                │
│                                                                   │
│  ┌─────────────────────┐    ┌─────────────────────┐              │
│  │ X402PaymentFirewall │───►│  X402PolicyEngine   │              │
│  │                     │    │                     │              │
│  │ • executePayment()  │    │ • evaluate()        │              │
│  │ • registerIntent()  │    │ • Daily limits      │              │
│  │ • Emergency pause   │    │ • Max per TX        │              │
│  │ • Rate limiting     │    │ • Blacklists        │              │
│  └─────────────────────┘    └─────────────────────┘              │
│                                                                   │
│  Network: Cronos Testnet (Chain ID: 338)                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Policy Rules (On-Chain Enforced)

| Rule | Setting | Violation = |
|------|---------|-------------|
| **Max Payment** | 10,000 CRO | `REVERT` |
| **Daily Limit** | 50,000 CRO | `REVERT` |
| **Blocked Sender** | Configurable | `REVERT` |
| **Blacklisted Recipient** | Configurable | `REVERT` |
| **Rate Limit** | Configurable | `REVERT` |
| **Emergency Pause** | Owner only | `REVERT ALL` |

**100% deterministic. No AI. No oracles. Pure smart contract logic.**

---

## 🔧 Integration (2 Lines)

```typescript
// Before: Unprotected
await wallet.sendTransaction({ to: recipient, value: amount });

// After: Firewall Protected
import { X402Firewall } from '@x402/firewall-sdk';
const firewall = new X402Firewall(signer);
await firewall.pay(recipient, '100'); // Policy enforced automatically
```

### Full Example

```typescript
const firewall = await X402Firewall.fromBrowserWallet();

// Pre-check
const check = await firewall.simulate(sender, recipient, '100');
if (!check.allowed) {
  console.log('Would be blocked:', check.reason);
  return;
}

// Execute (reverts if policy violated)
const result = await firewall.pay(recipient, '100');
console.log(result.success ? `TX: ${result.txHash}` : `Blocked: ${result.revertReason}`);
```

---

## 📁 Project Structure

```
x402-firewall/
├── contracts/                 # Solidity smart contracts
│   ├── X402PaymentFirewall.sol   # Main firewall (intent + execution)
│   ├── X402PolicyEngine.sol      # Policy checker
│   ├── X402IntentRegistry.sol    # Intent registration
│   └── X402ExecutionRouter.sol   # Execution gate
├── frontend/                  # React dashboard
│   └── src/
│       ├── App.tsx               # Main UI
│       ├── hooks/useContracts.ts # Contract interactions
│       └── hooks/useWallet.ts    # MetaMask integration
├── sdk/                       # TypeScript SDK
│   └── index.ts                  # Drop-in integration
├── scripts/                   # Deployment & testing
│   ├── deploy-firewall.ts
│   └── test-new-firewall.ts
└── docs/                      # Documentation
    ├── ARCHITECTURE.md
    └── X402_INTEGRATION.md
```

---

## 🎪 Use Cases

### 1. AI Agent Treasury
```
Agent budget: 100,000 CRO
Policy: Max 1,000/tx, 10,000/day
Result: Even if compromised, max loss = 10,000 CRO/day
```

### 2. DAO Automation
```
Treasury pays contractors automatically
Policy: Whitelist-only recipients
Result: Unauthorized addresses cannot receive funds
```

### 3. Subscription Services
```
User authorizes recurring payments
Policy: Max 100 CRO, specific recipient only
Result: Service cannot overcharge or redirect
```

---

## 🏆 Why This Wins

| Criteria | Our Solution |
|----------|--------------|
| **Deployed on Cronos** | ✅ Testnet, verified working |
| **x402 Related** | ✅ Core authorization layer for x402 payments |
| **Real Problem** | ✅ Agent security is unsolved |
| **Working Demo** | ✅ Execute real transactions |
| **Production Ready** | ✅ Emergency pause, rate limiting, audit logs |
| **Developer Friendly** | ✅ 2-line SDK integration |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MetaMask
- tCRO from [Cronos Faucet](https://cronos.org/faucet)

### Run Locally

```bash
# Install
git clone https://github.com/[repo]
cd x402-firewall
npm install

# Deploy contracts (optional - already deployed)
npx hardhat run scripts/deploy-firewall.ts --network cronosTestnet

# Run frontend
cd frontend && npm install && npm run dev
```

---

## 📈 Roadmap

- [x] Core contracts deployed
- [x] Policy enforcement working
- [x] Frontend demo
- [x] SDK created
- [ ] Mainnet deployment
- [ ] Security audit
- [ ] npm package publish
- [ ] Multi-chain support

---

## 📚 Documentation

- [Architecture Deep Dive](./docs/ARCHITECTURE.md)
- [Integration Guide](./docs/X402_INTEGRATION.md)
- [Integration Patterns](./docs/INTEGRATION_PATTERNS.md)

---

## 🔗 Links

| Resource | Link |
|----------|------|
| **Firewall Contract** | [✅ Verified Code](https://cronos.org/explorer/testnet3/address/0xC3C4E069B294C8ED3841c87d527c942F873CFAA9#code) |
| **PolicyEngine Contract** | [✅ Verified Code](https://cronos.org/explorer/testnet3/address/0xD0CE6F16969d81997750afE018A34921DeDd04A0#code) |
| **Demo TX (Success)** | [Explorer](https://cronos.org/explorer/testnet3/tx/0x26f363226771f9e359b6ed74c67eef0d2314bd21e458dcbfde3583e7b460fbae) |

---

<div align="center">

### Built for Cronos x402 Hackathon 2025

**Real Security. Real Enforcement. Real Protection.**

*Not warnings — walls.*

</div>
