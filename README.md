# 🔥 x402 Intent Firewall

> **AI-Powered Payment Security for Cronos EVM**

An autonomous middleware that intercepts x402 payment requests, analyzes intent and risk using deterministic AI heuristics, and decides whether to **ALLOW**, **BLOCK**, **LIMIT**, or **DELAY** each payment—all before on-chain execution.

[![Status](https://img.shields.io/badge/Status-Production_Ready-brightgreen)]()
[![Cronos](https://img.shields.io/badge/Chain-Cronos_EVM-blue)]()
[![License](https://img.shields.io/badge/License-MIT-yellow)]()

---

## 🎯 Problem & Solution

**Problem:** Users need protection against suspicious payments, fraud, and anomalous transactions.

**Solution:** An AI firewall that:
1. 🔍 **Intercepts** every x402 payment request
2. 🧠 **Analyzes** intent (what is this payment for?) and risk
3. ⚖️ **Decides** ALLOW/BLOCK/LIMIT/DELAY based on risk score
4. 🔗 **Records** decision on-chain (immutable audit trail)
5. 💡 **Explains** reasoning (fully transparent AI)

---

## 🚀 Quick Start (2 Minutes)

### Run the Demo

```bash
cd backend
npm install
npm run dev
```

**Output:** 4 test scenarios demonstrating:
- ✅ Normal user → ALLOW (Risk: LOW, Score: 20)
- ⚠️ New user + Large unknown payment → LIMIT (Risk: MEDIUM, Score: 48)
- ⚠️ Suspicious round amount → LIMIT (Risk: HIGH, Score: 63)
- ✅ Repeat user with gradual increase → ALLOW (Risk: LOW, Score: 10)

### Integrate (2 Lines of Code)

```typescript
import { setupX402Firewall, withX402Firewall } from "x402-firewall";

// Initialize once
await setupX402Firewall("0xPolicyContract...", "https://evm-cn.cronos.org");

// Use in payment handler
const response = await withX402Firewall(paymentRequest);

if (response.decision === "ALLOW") {
  // Process payment
} else if (response.decision === "LIMIT") {
  // Process with response.allowedAmount
} else {
  // Handle BLOCK/DELAY
}
```

---

## 📊 How It Works

---

## 📊 How It Works

```
Payment Request
    ↓
[1] Load User History & Context
    ↓
[2] Analyze Intent (API call? Bulk purchase? Unknown?)
    ↓
[3] Detect Anomalies (new recipient, amount spike, frequency)
    ↓
[4] Calculate Risk Score (0-100)
    ↓
[5] Make Decision (ALLOW/BLOCK/LIMIT/DELAY)
    ↓
[6] Record On-Chain (immutable proof)
    ↓
Return Response with Reasoning
```

### Risk Score → Decision Mapping

| Risk Score | Decision | Action |
|-----------|----------|--------|
| 0-39 | ✅ **ALLOW** | Approve payment |
| 40-59 | ⚠️ **LIMIT** | Reduce amount (50% safety margin) |
| 60-79 | ⚠️ **LIMIT** | Reduce amount (50% safety margin) |
| 80+ | ❌ **BLOCK** | Reject payment |

### What Triggers Risk?

| Anomaly | Risk Points | Example |
|---------|-------------|---------|
| 🆕 New Recipient | +20 | First time paying this address |
| 📈 Amount Spike | +30 | 5x+ typical amount |
| 🚀 Frequency Spike | +25 | 3x+ typical frequency |
| 🤷 Low Intent Confidence | +15 | Unclear payment purpose |
| 🆕 New User | +20 | No transaction history |
| 🎯 New User + Large Unknown | +18 | High-risk triple factor |
| 🔢 Round Amount | +10 | Suspicious automation (1000000) |

---

## 🏗️ Architecture

### System Flow
```
App/Wallet → x402 Firewall → AI Engine → Smart Contract → x402 Facilitator → Settlement
```

### Core Components

**1. Smart Contract** (`contracts/X402PolicyEngine.sol` - 377 lines)
- On-chain policy enforcement
- Immutable decision recording
- Agent authorization management
- Blacklist/whitelist support

**2. AI Risk Engine** (`backend/src/ai-engine.ts` - 467 lines)
- Intent analysis (4 categories)
- Anomaly detection (5 types)
- Risk scoring (0-100 scale)
- Decision mapping (deterministic rules)

**3. Middleware** (`backend/src/middleware.ts` - 300 lines)
- User context management
- On-chain interaction
- Response orchestration

**4. Developer SDK** (`sdk/index.ts` - 200 lines)
- One-function integration
- Type-safe TypeScript API

---

## 🧠 AI Decision Logic (Deterministic & Explainable)

### Step 1: Intent Analysis
Determines payment purpose with confidence score:
- **api_service** (80% confidence) - Metadata indicates API call
- **recurring_payment** (75%) - Subscription pattern detected
- **bulk_service** (70%) - Bulk operation indicators
- **unknown_payment** (30%) - No clear intent

### Step 2: Anomaly Detection
Flags suspicious patterns:
- **new_recipient** - Never paid before
- **amount_spike** - Amount > 5x typical
- **frequency_spike** - Txs > 3x normal rate
- **round_amount** - Suspicious precision (1000000)
- **new_user_large_unknown_payment** - Triple high-risk factor

### Step 3: Risk Assessment
Combines anomalies + intent + history:
```typescript
score = anomalyConfidence 
      + (lowIntentConfidence ? 15 : 0)
      + (newUser ? 20 : 0)
      + (newUserLargeUnknown ? 18 : 0)
      + (policyViolation ? 25 : 0)
```

### Step 4: Decision
Maps score to action with explanation:
```typescript
if (score >= 80) return BLOCK;
if (score >= 40) return LIMIT;
return ALLOW;
```

**Key:** All logic is **deterministic** (no opaque ML), fully **auditable**, and **reproducible**.

---

## 📁 Project Structure

```
x402-firewall/
├── contracts/
│   └── X402PolicyEngine.sol      # Smart contract (Solidity 0.8.19)
│
├── backend/                       # TypeScript middleware
│   ├── src/
│   │   ├── types.ts              # All interfaces/types
│   │   ├── middleware.ts         # Core orchestrator
│   │   ├── ai-engine.ts          # AI decision logic
│   │   ├── policy-contract.ts    # Contract client
│   │   ├── demo.ts               # Runnable demo
│   │   └── index.ts              # Entry point
│   ├── package.json
│   └── tsconfig.json
│
├── sdk/                           # Developer SDK
│   ├── index.ts                  # Main API
│   ├── package.json
│   └── tsconfig.json
│
└── README.md                      # This file
```

---

## 🎮 Demo Scenarios

### Test 1: Normal User → Known Recipient
```
✅ ALLOW (Risk: LOW, Score: 20)
- Intent: API call to data_oracle (80% confidence)
- Factors: new_user
- Anomalies: none
```

### Test 2: New User → Large Unknown Payment
```
⚠️ LIMIT (Risk: MEDIUM, Score: 48)
- Amount: 50000 → 25000 CRO (50% reduction)
- Intent: bulk_service (70% confidence)
- Factors: round_amount, new_user, new_user_large_unknown_payment
- Anomalies: round_amount
```

### Test 3: Suspicious Round Amount
```
⚠️ LIMIT (Risk: HIGH, Score: 63)
- Amount: 1000000 → 500000 CRO
- Intent: unknown_payment (30% confidence)
- Factors: round_amount, low_intent_confidence, new_user
- Anomalies: round_amount
```

### Test 4: Repeat User, Gradual Increase
```
✅ ALLOW (Risk: LOW, Score: 10)
- Intent: API call to data_oracle (80% confidence)
- Factors: limited_history
- Anomalies: none
```

---

## 🛠️ Technical Details

### Stack
- **Blockchain:** Cronos EVM (Mainnet: Chain ID 25, Testnet: 338)
- **Smart Contract:** Solidity 0.8.19
- **Backend:** TypeScript 5.3+, Node.js 18+
- **SDK:** TypeScript with full type definitions

### Smart Contract Functions
```solidity
// Policy Management
function setRecipientPolicy(address, RecipientPolicy) external onlyOwner
function blacklistRecipient(address) external onlyOwner

// Agent Management  
function authorizeAgent(address) external onlyOwner
function revokeAgent(address) external onlyOwner

// Core Logic
function evaluatePayment(address recipient, uint256 amount) external view returns (Decision, string)
function recordDecision(address sender, address recipient, uint256 amount, Decision, string) external onlyAuthorizedAgent

// Queries
function getAttemptCount() external view returns (uint256)
function getRecentAttempts(uint256 count) external view returns (PaymentAttempt[])
```

### TypeScript API
```typescript
// Initialize
initializeFirewall(config: FirewallConfig): void
setupX402Firewall(contractAddress: string, rpcUrl: string): Promise<void>

// Evaluate
withX402Firewall(request: X402PaymentRequest): Promise<X402FirewallResponse>

// Health
checkFirewallHealth(): Promise<{ healthy: boolean }>
```

---

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Cronos RPC access

### Install

```bash
# Clone repository
git clone <repo-url>
cd x402-firewall

# Install backend dependencies
cd backend
npm install

# Install SDK dependencies
cd ../sdk
npm install
```

### Configure

Create `backend/.env`:
```env
POLICY_ENGINE_ADDRESS=0x0000000000000000000000000000000000000000
CRONOS_RPC_URL=https://evm-cn.cronos.org
CRONOS_CHAIN_ID=25
```

### Run Demo

```bash
cd backend
npm run dev
```

---

## 🔌 Integration Examples

### Express.js API

```typescript
import express from "express";
import { initializeFirewall, withX402Firewall } from "x402-firewall";

const app = express();
app.use(express.json());

initializeFirewall(config);

app.post("/x402/evaluate", async (req, res) => {
  const response = await withX402Firewall(req.body);
  res.json(response);
});

app.listen(3000);
```

### DeFi Protocol

```typescript
async function swapWithFirewall(swapRequest) {
  const decision = await withX402Firewall({
    requestId: `swap-${Date.now()}`,
    sender: swapRequest.userAddress,
    recipient: swapRequest.routerAddress,
    amount: swapRequest.amount,
    timestamp: Math.floor(Date.now() / 1000),
    metadata: { intent: "token_swap" }
  });

  if (decision.decision === "BLOCK") {
    throw new Error(`Swap blocked: ${decision.message}`);
  }

  const finalAmount = decision.decision === "LIMIT" 
    ? decision.allowedAmount 
    : swapRequest.amount;
    
  return executeSwap(finalAmount);
}
```

---

## 🚢 Deployment

### Deploy Smart Contract

```bash
# Compile
npx hardhat compile

# Deploy to Cronos Testnet
npx hardhat run scripts/deploy.ts --network cronos-testnet

# Verify
npx hardhat verify --network cronos-testnet <CONTRACT_ADDRESS>
```

### Deploy Backend

```bash
# Build
cd backend
npm run build

# Deploy (example: AWS/GCP/Heroku)
# Set environment variables
# Start: node dist/index.js
```

---

## 📋 What's Included

✅ **Smart Contract** - 377 lines of auditable Solidity  
✅ **AI Engine** - 467 lines of deterministic risk logic  
✅ **Middleware** - 300 lines of orchestration  
✅ **Type Definitions** - Complete TypeScript types  
✅ **Developer SDK** - One-function integration API  
✅ **Runnable Demo** - 4 test scenarios with output  
✅ **Documentation** - This comprehensive README  

---

## 🎯 Hackathon Highlights

1. **Complete MVP**: Fully functional end-to-end system
2. **Production-Ready Code**: Clean, typed, documented
3. **Deterministic AI**: Auditable heuristics (not black box ML)
4. **Explainable Decisions**: Every decision has clear reasoning
5. **On-Chain Proof**: Immutable audit trail in smart contract
6. **Developer-Friendly**: 2-line integration
7. **Live Demo**: Works out of the box (`npm run dev`)

---

## 🔮 Future Enhancements

- [ ] Machine learning risk model (trained on real data)
- [ ] Multi-chain support (Ethereum, Polygon, BSC)
- [ ] Web dashboard for policy management
- [ ] Real-time monitoring & alerts
- [ ] Historical analytics & reporting
- [ ] Batch payment optimization
- [ ] Integration with x402 Facilitator protocol

---

## 📄 License

MIT License - See LICENSE file

---

## 🙋 Questions?

- **Demo:** Run `npm run dev` in `/backend`
- **Integration:** See examples above
- **Smart Contract:** Deploy to Cronos testnet
- **Issues:** Open GitHub issue

**Built for Cronos Hackathon 2026** 🚀
