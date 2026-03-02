# @venkat5599/x402-firewall-sdk

> On-chain security layer for autonomous AI agent payments on Cronos

[![npm version](https://img.shields.io/npm/v/@venkat5599/x402-firewall-sdk.svg)](https://www.npmjs.com/package/@venkat5599/x402-firewall-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is x402 Payment Firewall?

x402 Payment Firewall is a smart contract security layer that protects autonomous AI agent payments on the Cronos blockchain. It enforces spending policies directly on-chain, ensuring that even if an AI agent's private key is compromised, attackers cannot drain funds beyond configured limits.

## Features

- **Spending Limits** - Max per transaction, daily caps
- **Recipient Controls** - Whitelist/blacklist support
- **Rate Limiting** - Prevent rapid draining
- **Emergency Controls** - Instant pause capability
- **Audit Trail** - All attempts logged on-chain
- **Intent Flow** - Optional approval workflow for high-value payments
- **React Hooks** - Easy integration with React apps
- **Event Listeners** - Real-time payment notifications
- **Gas Estimation** - Know costs before executing
- **Batch Operations** - Multiple payments efficiently
- **CLI Tool** - Command-line interface
- **TypeScript** - Full type safety

## Installation

```bash
npm install @venkat5599/x402-firewall-sdk ethers
```

## Quick Start

```typescript
import { X402Firewall } from '@venkat5599/x402-firewall-sdk';
import { ethers } from 'ethers';

// Connect to Cronos Testnet
const provider = new ethers.JsonRpcProvider('https://evm-t3.cronos.org');
const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);

// Initialize firewall
const firewall = new X402Firewall(wallet, { network: 'testnet' });

// Execute a protected payment
const result = await firewall.pay('0xRecipientAddress', '100'); // 100 CRO

if (result.success) {
  console.log('Payment executed:', result.txHash);
} else {
  console.log('Payment blocked:', result.revertReason);
}
```

## Usage Examples

### Simple Payment

```typescript
// Execute payment with automatic policy enforcement
const result = await firewall.pay('0x...', '100');
```

### Simulate Before Paying

```typescript
// Check if payment would succeed
const simulation = await firewall.simulate(
  senderAddress,
  recipientAddress,
  '100'
);

if (simulation.allowed) {
  await firewall.pay(recipientAddress, '100');
} else {
  console.log('Would be blocked:', simulation.reason);
}
```

### Gas Estimation

```typescript
// Estimate gas cost before paying
const estimate = await firewall.estimatePaymentCost('0x...', '100');
console.log('Gas cost:', estimate.gasCostInCRO, 'CRO');
console.log('Total cost:', estimate.totalCostInCRO, 'CRO');
```

### Event Listeners

```typescript
// Listen to payment events in real-time
const unsubscribe = firewall.onPaymentExecuted((event) => {
  console.log('Payment sent:', event.amount, 'CRO');
  console.log('TX:', event.txHash);
});

// Stop listening
unsubscribe();
```

### React Hooks

```typescript
import { useFirewall, usePayment } from '@venkat5599/x402-firewall-sdk/hooks';

function PaymentButton() {
  const { firewall, loading } = useFirewall({ network: 'testnet' });
  const { pay, loading: paying } = usePayment(firewall);
  
  if (loading) return <div>Connecting...</div>;
  
  return (
    <button 
      onClick={() => pay('0x...', '100')}
      disabled={paying}
    >
      {paying ? 'Sending...' : 'Pay 100 CRO'}
    </button>
  );
}
```

### Batch Operations

```typescript
import { batchPay } from '@venkat5599/x402-firewall-sdk/batch';

const result = await batchPay(firewall, [
  { recipient: '0x...', amount: '100' },
  { recipient: '0x...', amount: '200' },
  { recipient: '0x...', amount: '50' }
]);

console.log(`${result.successCount} succeeded, ${result.failureCount} failed`);
```

### CLI Usage

```bash
# Execute payment
npx x402-firewall pay 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb 100

# Simulate payment
npx x402-firewall simulate 0xSender... 0xRecipient... 100

# Get statistics
npx x402-firewall stats

# Get intent details
npx x402-firewall intent 0xIntentHash...

# Get policy state
npx x402-firewall policy
```

### Intent Flow (High-Value Payments)

```typescript
// 1. Register intent
const { hash } = await firewall.registerIntent('0x...', '5000', 3600);

// 2. Approve intent (by authorized agent)
await firewall.approveIntent(hash, 25, 'Low risk payment');

// 3. Execute approved intent
await firewall.executeIntent(hash);
```

### Browser Wallet Integration

```typescript
// Connect to MetaMask
const firewall = await X402Firewall.fromBrowserWallet({ network: 'testnet' });

// Use as normal
await firewall.pay('0x...', '100');
```

### Read-Only Access

```typescript
// Create read-only instance (no wallet needed)
const firewall = X402Firewall.readOnly({ network: 'testnet' });

// Query stats
const stats = await firewall.getStats();
console.log('Total volume:', stats.totalVolume, 'CRO');

// Check policy state
const policy = await firewall.getPolicyState();
console.log('Max payment:', policy.maxPayment, 'CRO');
```

## API Reference

### Constructor

```typescript
new X402Firewall(signerOrProvider, options?)
```

**Parameters:**
- `signerOrProvider`: ethers Signer or Provider
- `options.network`: 'testnet' | 'mainnet' (default: 'testnet')
- `options.firewallAddress`: Custom firewall address (optional)
- `options.policyEngineAddress`: Custom policy engine address (optional)

### Payment Methods

#### `pay(recipient, amountInCRO)`

Execute a payment through the firewall with automatic policy enforcement.

**Returns:** `Promise<PaymentResult>`

```typescript
{
  success: boolean;
  txHash: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
  revertReason?: string;
}
```

#### `simulate(sender, recipient, amountInCRO)`

Simulate a payment without executing to check if it would be allowed.

**Returns:** `Promise<SimulationResult>`

```typescript
{
  allowed: boolean;
  reason: string;
}
```

### Intent Methods

#### `registerIntent(recipient, amountInCRO, validForSeconds?)`

Register a payment intent for approval.

**Returns:** `Promise<{ hash: string; tx: ContractTransactionReceipt }>`

#### `approveIntent(intentHash, riskScore, reason)`

Approve a pending intent (requires agent authorization).

#### `rejectIntent(intentHash, riskScore, reason)`

Reject a pending intent (requires agent authorization).

#### `executeIntent(intentHash)`

Execute an approved intent.

#### `getIntent(intentHash)`

Get details of a registered intent.

**Returns:** `Promise<PaymentIntent | null>`

### View Methods

#### `getStats()`

Get firewall statistics.

**Returns:** `Promise<FirewallStats>`

```typescript
{
  totalIntents: number;
  totalApproved: number;
  totalRejected: number;
  totalExecuted: number;
  totalBlocked: number;
  totalVolume: string; // in CRO
}
```

#### `getPolicyState()`

Get current policy configuration.

**Returns:** `Promise<PolicyState>`

```typescript
{
  maxPayment: string; // in CRO
  dailyLimit: string; // in CRO
  whitelistEnabled: boolean;
}
```

#### `getDailyRemaining(sender)`

Get remaining daily spending limit for an address.

**Returns:** `Promise<string>` (amount in CRO)

#### `isPaused()`

Check if firewall is paused.

#### `isAgent(address)`

Check if address is an authorized agent.

#### `isSenderBlocked(sender)`

Check if sender is blocked.

#### `isRecipientBlacklisted(recipient)`

Check if recipient is blacklisted.

### Admin Methods (Owner Only)

- `pause()` - Pause all payments
- `unpause()` - Resume payments
- `addAgent(agent)` - Add authorized agent
- `setRateLimit(intervalSeconds)` - Set minimum time between payments
- `blockSender(sender, blocked)` - Block/unblock sender
- `blacklistRecipient(recipient, blacklisted)` - Blacklist/whitelist recipient

## x402 Integration Helper

For x402 protocol integration:

```typescript
import { X402ProtectedPaymentHandler } from '@x402/firewall-sdk';

const handler = new X402ProtectedPaymentHandler(firewall);

// Process x402 payment with protection
const result = await handler.processPayment(recipient, amount);

// Process high-value payment with risk assessment
const result = await handler.processHighValuePayment(
  recipient,
  amount,
  { score: 25, reason: 'Verified merchant' }
);
```

## Deployed Contracts

### Cronos Testnet

- **Firewall:** `0xC3C4E069B294C8ED3841c87d527c942F873CFAA9`
- **Policy Engine:** `0xD0CE6F16969d81997750afE018A34921DeDd04A0`
- **Explorer:** [View on Cronos Explorer](https://cronos.org/explorer/testnet3/address/0xC3C4E069B294C8ED3841c87d527c942F873CFAA9#code)

### Cronos Mainnet

Coming soon after security audit.

## Network Configuration

### Cronos Testnet

```typescript
{
  chainId: 338,
  name: 'Cronos Testnet',
  rpc: 'https://evm-t3.cronos.org',
  explorer: 'https://cronos.org/explorer/testnet3'
}
```

### Cronos Mainnet

```typescript
{
  chainId: 25,
  name: 'Cronos Mainnet',
  rpc: 'https://evm.cronos.org',
  explorer: 'https://cronos.org/explorer'
}
```

## Security Policies

All policies are enforced on-chain. Violations cause transaction revert.

| Policy | Default Value | Configurable |
|--------|---------------|--------------|
| Max per transaction | 10,000 CRO | ✅ Yes |
| Daily spending limit | 50,000 CRO | ✅ Yes |
| Sender blacklist | Empty | ✅ Yes |
| Recipient blacklist | Empty | ✅ Yes |
| Rate limit | 0 (disabled) | ✅ Yes |

## Error Handling

The SDK provides detailed error information:

```typescript
const result = await firewall.pay('0x...', '15000');

if (!result.success) {
  console.log('Error:', result.error);
  console.log('Reason:', result.revertReason);
  // Reason: "Exceeds max payment limit"
}
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import {
  X402Firewall,
  PaymentIntent,
  IntentStatus,
  FirewallStats,
  PolicyState,
  PaymentResult,
  SimulationResult,
  CRONOS_TESTNET,
  CRONOS_MAINNET,
  DEPLOYED_CONTRACTS
} from '@x402/firewall-sdk';
```

## Requirements

- Node.js >= 18.0.0
- ethers.js >= 6.0.0

## License

MIT

## Links

- [GitHub Repository](https://github.com/Venkat5599/x402-Intent-Firewall)
- [Documentation](https://github.com/Venkat5599/x402-Intent-Firewall/tree/main/docs)
- [Cronos Explorer](https://cronos.org/explorer/testnet3)

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/Venkat5599/x402-Intent-Firewall/issues)
- Documentation: [Read the docs](https://github.com/Venkat5599/x402-Intent-Firewall/tree/main/docs)

---

Built for Cronos x402 Hackathon 2025 🏆
