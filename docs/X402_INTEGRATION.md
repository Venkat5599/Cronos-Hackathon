# x402 Payment Firewall Integration Guide

## How x402 + Firewall Work Together

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        x402 PAYMENT FLOW WITH FIREWALL                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Client  │───►│  x402    │───►│   FIREWALL   │───►│  PolicyEngine    │  │
│  │  (Agent) │    │  Server  │    │   Contract   │    │    Contract      │  │
│  └──────────┘    └──────────┘    └──────────────┘    └──────────────────┘  │
│       │               │                 │                    │              │
│       │  1. Request   │                 │                    │              │
│       │  Payment      │                 │                    │              │
│       │──────────────►│                 │                    │              │
│       │               │                 │                    │              │
│       │               │  2. Execute     │                    │              │
│       │               │  via Firewall   │                    │              │
│       │               │────────────────►│                    │              │
│       │               │                 │                    │              │
│       │               │                 │  3. Check Policy   │              │
│       │               │                 │───────────────────►│              │
│       │               │                 │                    │              │
│       │               │                 │  4. ALLOW/DENY     │              │
│       │               │                 │◄───────────────────│              │
│       │               │                 │                    │              │
│       │               │  5a. ✅ Execute │                    │              │
│       │               │  OR             │                    │              │
│       │               │  5b. ❌ Revert  │                    │              │
│       │               │◄────────────────│                    │              │
│       │               │                 │                    │              │
│       │  6. Response  │                 │                    │              │
│       │◄──────────────│                 │                    │              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Quick Integration (2 Lines)

### Before (Unprotected)
```typescript
// Direct wallet transfer - NO PROTECTION
await wallet.sendTransaction({
  to: recipient,
  value: parseEther(amount)
});
```

### After (Firewall Protected)
```typescript
import { X402Firewall } from '@x402/firewall-sdk';

const firewall = new X402Firewall(signer);
await firewall.pay(recipient, amount); // Policy enforced automatically
```

---

## Integration Patterns

### Pattern 1: Simple Payment (Most Common)

Use for everyday payments under policy limits.

```typescript
import { X402Firewall } from '@x402/firewall-sdk';

async function processPayment(recipient: string, amount: string) {
  const firewall = await X402Firewall.fromBrowserWallet();
  
  // Pre-check (optional but recommended)
  const sender = await signer.getAddress();
  const check = await firewall.simulate(sender, recipient, amount);
  
  if (!check.allowed) {
    console.log('Payment would be blocked:', check.reason);
    return { success: false, reason: check.reason };
  }
  
  // Execute
  const result = await firewall.pay(recipient, amount);
  
  if (result.success) {
    console.log('Payment successful:', result.txHash);
  } else {
    console.log('Payment blocked:', result.revertReason);
  }
  
  return result;
}
```

### Pattern 2: Intent Flow (High-Value Payments)

Use for payments that need review/approval before execution.

```typescript
import { X402Firewall, IntentStatus } from '@x402/firewall-sdk';

async function processHighValuePayment(
  recipient: string, 
  amount: string,
  riskScore: number
) {
  const firewall = await X402Firewall.fromBrowserWallet();
  
  // Step 1: Register intent
  const { hash } = await firewall.registerIntent(recipient, amount, 3600); // 1 hour validity
  console.log('Intent registered:', hash);
  
  // Step 2: Risk assessment (your logic)
  if (riskScore > 70) {
    await firewall.rejectIntent(hash, riskScore, 'High risk score');
    return { success: false, reason: 'Rejected due to high risk' };
  }
  
  // Step 3: Approve
  await firewall.approveIntent(hash, riskScore, 'Risk assessment passed');
  
  // Step 4: Execute
  const result = await firewall.executeIntent(hash);
  return result;
}
```

### Pattern 3: x402 Server Integration

Integrate firewall into your x402 payment server.

```typescript
import express from 'express';
import { X402Firewall, X402ProtectedPaymentHandler } from '@x402/firewall-sdk';
import { Wallet } from 'ethers';

const app = express();
app.use(express.json());

// Initialize firewall with server wallet
const wallet = new Wallet(process.env.PRIVATE_KEY!, provider);
const firewall = new X402Firewall(wallet);
const handler = new X402ProtectedPaymentHandler(firewall);

// x402 payment endpoint
app.post('/x402/pay', async (req, res) => {
  const { recipient, amount } = req.body;
  
  // Firewall automatically enforces policy
  const result = await handler.processPayment(recipient, amount);
  
  if (result.success) {
    res.json({
      status: 'success',
      txHash: result.txHash,
    });
  } else {
    res.status(402).json({
      status: 'blocked',
      reason: result.policyReason,
    });
  }
});

// High-value payment with intent flow
app.post('/x402/pay/high-value', async (req, res) => {
  const { recipient, amount, riskAssessment } = req.body;
  
  const result = await handler.processHighValuePayment(
    recipient,
    amount,
    riskAssessment
  );
  
  res.json(result);
});
```

### Pattern 4: AI Agent Integration

Protect AI agent payments with spending limits.

```typescript
import { X402Firewall } from '@x402/firewall-sdk';

class ProtectedAIAgent {
  private firewall: X402Firewall;
  
  constructor(signer: Signer) {
    this.firewall = new X402Firewall(signer);
  }
  
  async executeTask(task: AgentTask) {
    if (task.requiresPayment) {
      // Check remaining budget
      const remaining = await this.firewall.getDailyRemaining(
        await this.signer.getAddress()
      );
      
      if (parseFloat(remaining) < parseFloat(task.paymentAmount)) {
        throw new Error('Daily budget exceeded');
      }
      
      // Execute payment through firewall
      const result = await this.firewall.pay(
        task.paymentRecipient,
        task.paymentAmount
      );
      
      if (!result.success) {
        throw new Error(`Payment blocked: ${result.revertReason}`);
      }
      
      task.paymentTxHash = result.txHash;
    }
    
    // Continue with task execution...
  }
}
```

---

## Policy Configuration

### Default Policies (Deployed)

| Policy | Value | Effect |
|--------|-------|--------|
| Max Payment | 10,000 CRO | Single payments > 10k CRO are blocked |
| Daily Limit | 50,000 CRO | Total daily spending capped at 50k CRO |
| Whitelist | Disabled | All recipients allowed by default |

### Customizing Policies (Owner Only)

```typescript
const firewall = new X402Firewall(ownerSigner);

// Block a malicious sender
await firewall.blockSender('0xMalicious...', true);

// Blacklist a scam recipient
await firewall.blacklistRecipient('0xScam...', true);

// Enable rate limiting (1 payment per 60 seconds)
await firewall.setRateLimit(60);

// Emergency pause (blocks ALL payments)
await firewall.pause();

// Resume operations
await firewall.unpause();
```

---

## Error Handling

```typescript
const result = await firewall.pay(recipient, amount);

if (!result.success) {
  switch (result.revertReason) {
    case 'Amount exceeds maximum':
      // Payment too large - split into smaller payments
      break;
    case 'Daily limit exceeded':
      // Wait until tomorrow or request limit increase
      break;
    case 'Sender is blocked':
      // Contact admin to unblock
      break;
    case 'Recipient is blacklisted':
      // Cannot pay this recipient
      break;
    case 'rate limited':
      // Wait before next payment
      break;
    default:
      console.error('Unknown error:', result.error);
  }
}
```

---

## Events & Monitoring

Listen to firewall events for monitoring:

```typescript
import { Contract } from 'ethers';

const firewall = new Contract(FIREWALL_ADDRESS, FIREWALL_ABI, provider);

// Payment executed
firewall.on('PaymentExecuted', (intentHash, sender, recipient, amount, timestamp) => {
  console.log(`✅ Payment: ${formatEther(amount)} CRO from ${sender} to ${recipient}`);
});

// Payment blocked
firewall.on('PaymentBlocked', (intentHash, sender, recipient, amount, reason) => {
  console.log(`❌ Blocked: ${formatEther(amount)} CRO - Reason: ${reason}`);
  // Alert admin, log to monitoring system, etc.
});

// Emergency pause
firewall.on('EmergencyPause', (by, timestamp) => {
  console.log(`🚨 EMERGENCY PAUSE by ${by}`);
  // Notify all systems
});
```

---

## Contract Addresses

### Cronos Testnet (Chain ID: 338)

| Contract | Address |
|----------|---------|
| X402PaymentFirewall | `0xC3C4E069B294C8ED3841c87d527c942F873CFAA9` |
| X402PolicyEngine | `0xD0CE6F16969d81997750afE018A34921DeDd04A0` |

### Cronos Mainnet (Chain ID: 25)

Coming soon after security audit.

---

## Security Considerations

1. **Private Key Security**: The firewall protects against policy violations, but private key compromise still allows payments within policy limits.

2. **Policy Limits**: Set conservative limits. It's easier to increase limits than recover stolen funds.

3. **Emergency Pause**: Test the pause mechanism before production. Know who has pause authority.

4. **Monitoring**: Set up alerts for blocked payments and unusual patterns.

5. **Upgrades**: The firewall is not upgradeable by design. Deploy new version and migrate if needed.
