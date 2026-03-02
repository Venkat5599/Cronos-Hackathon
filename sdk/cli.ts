#!/usr/bin/env node

/**
 * x402 Payment Firewall CLI
 * 
 * Usage:
 *   npx x402-firewall pay <recipient> <amount>
 *   npx x402-firewall simulate <sender> <recipient> <amount>
 *   npx x402-firewall stats
 *   npx x402-firewall intent <intentHash>
 */

import { X402Firewall } from './index';
import { JsonRpcProvider, Wallet } from 'ethers';

const COMMANDS = {
  pay: 'Execute a payment',
  simulate: 'Simulate a payment',
  stats: 'Get firewall statistics',
  intent: 'Get intent details',
  policy: 'Get policy state',
  help: 'Show help',
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    showHelp();
    return;
  }

  // Load environment variables
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL || 'https://evm-t3.cronos.org';
  const network = (process.env.NETWORK || 'testnet') as 'testnet' | 'mainnet';

  if (!privateKey && command !== 'stats' && command !== 'policy') {
    console.error('❌ Error: PRIVATE_KEY environment variable required');
    console.log('Set it with: export PRIVATE_KEY=your_private_key');
    process.exit(1);
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = privateKey ? new Wallet(privateKey, provider) : null;
  const firewall = new X402Firewall(wallet || provider, { network });

  try {
    switch (command) {
      case 'pay':
        await handlePay(firewall, args);
        break;
      case 'simulate':
        await handleSimulate(firewall, args);
        break;
      case 'stats':
        await handleStats(firewall);
        break;
      case 'intent':
        await handleIntent(firewall, args);
        break;
      case 'policy':
        await handlePolicy(firewall);
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    process.exit(1);
  }
}

async function handlePay(firewall: X402Firewall, args: string[]) {
  const recipient = args[1];
  const amount = args[2];

  if (!recipient || !amount) {
    console.error('Usage: x402-firewall pay <recipient> <amount>');
    process.exit(1);
  }

  console.log(`💸 Sending ${amount} CRO to ${recipient}...`);
  
  const result = await firewall.pay(recipient, amount);

  if (result.success) {
    console.log('✅ Payment successful!');
    console.log(`   TX: ${result.txHash}`);
    console.log(`   Gas: ${result.gasUsed}`);
  } else {
    console.log('❌ Payment blocked');
    console.log(`   Reason: ${result.revertReason || result.error}`);
  }
}

async function handleSimulate(firewall: X402Firewall, args: string[]) {
  const sender = args[1];
  const recipient = args[2];
  const amount = args[3];

  if (!sender || !recipient || !amount) {
    console.error('Usage: x402-firewall simulate <sender> <recipient> <amount>');
    process.exit(1);
  }

  console.log(`🔍 Simulating payment of ${amount} CRO...`);
  
  const result = await firewall.simulate(sender, recipient, amount);

  if (result.allowed) {
    console.log('✅ Payment would succeed');
  } else {
    console.log('❌ Payment would be blocked');
    console.log(`   Reason: ${result.reason}`);
  }
}

async function handleStats(firewall: X402Firewall) {
  console.log('📊 Fetching firewall statistics...\n');
  
  const stats = await firewall.getStats();

  console.log('Firewall Statistics:');
  console.log(`  Total Intents:    ${stats.totalIntents}`);
  console.log(`  Approved:         ${stats.totalApproved}`);
  console.log(`  Rejected:         ${stats.totalRejected}`);
  console.log(`  Executed:         ${stats.totalExecuted}`);
  console.log(`  Blocked:          ${stats.totalBlocked}`);
  console.log(`  Total Volume:     ${stats.totalVolume} CRO`);
}

async function handleIntent(firewall: X402Firewall, args: string[]) {
  const intentHash = args[1];

  if (!intentHash) {
    console.error('Usage: x402-firewall intent <intentHash>');
    process.exit(1);
  }

  console.log(`🔍 Fetching intent ${intentHash}...\n`);
  
  const intent = await firewall.getIntent(intentHash);

  if (!intent) {
    console.log('❌ Intent not found');
    return;
  }

  console.log('Intent Details:');
  console.log(`  Hash:       ${intent.intentHash}`);
  console.log(`  Sender:     ${intent.sender}`);
  console.log(`  Recipient:  ${intent.recipient}`);
  console.log(`  Amount:     ${intent.amount} CRO`);
  console.log(`  Status:     ${getStatusName(intent.status)}`);
  console.log(`  Risk Score: ${intent.riskScore}`);
  console.log(`  Reason:     ${intent.reason}`);
  console.log(`  Expiry:     ${new Date(intent.expiry * 1000).toISOString()}`);
}

async function handlePolicy(firewall: X402Firewall) {
  console.log('📋 Fetching policy state...\n');
  
  const policy = await firewall.getPolicyState();

  console.log('Policy Configuration:');
  console.log(`  Max Payment:      ${policy.maxPayment} CRO`);
  console.log(`  Daily Limit:      ${policy.dailyLimit} CRO`);
  console.log(`  Whitelist Mode:   ${policy.whitelistEnabled ? 'Enabled' : 'Disabled'}`);
}

function getStatusName(status: number): string {
  const names = ['Pending', 'Approved', 'Rejected', 'Executed', 'Expired', 'Cancelled'];
  return names[status] || 'Unknown';
}

function showHelp() {
  console.log('x402 Payment Firewall CLI\n');
  console.log('Commands:');
  Object.entries(COMMANDS).forEach(([cmd, desc]) => {
    console.log(`  ${cmd.padEnd(12)} ${desc}`);
  });
  console.log('\nExamples:');
  console.log('  x402-firewall pay 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb 100');
  console.log('  x402-firewall simulate 0x... 0x... 100');
  console.log('  x402-firewall stats');
  console.log('  x402-firewall intent 0x...');
  console.log('\nEnvironment Variables:');
  console.log('  PRIVATE_KEY  Your wallet private key (required for transactions)');
  console.log('  RPC_URL      Cronos RPC URL (default: testnet)');
  console.log('  NETWORK      testnet or mainnet (default: testnet)');
}

main().catch(console.error);
