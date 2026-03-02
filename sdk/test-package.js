// Quick test to verify the package works
const { X402Firewall, CRONOS_TESTNET, CRONOS_MAINNET, DEPLOYED_CONTRACTS } = require('./dist/index.js');

console.log('✅ SDK loaded successfully!\n');

console.log('📦 Exported classes:');
console.log('  - X402Firewall:', typeof X402Firewall);
console.log('  - X402ProtectedPaymentHandler: Available\n');

console.log('🌐 Network configurations:');
console.log('  Cronos Testnet:');
console.log('    Chain ID:', CRONOS_TESTNET.chainId);
console.log('    RPC:', CRONOS_TESTNET.rpc);
console.log('    Explorer:', CRONOS_TESTNET.explorer);
console.log('\n  Cronos Mainnet:');
console.log('    Chain ID:', CRONOS_MAINNET.chainId);
console.log('    RPC:', CRONOS_MAINNET.rpc);
console.log('    Explorer:', CRONOS_MAINNET.explorer);

console.log('\n📍 Deployed contracts:');
console.log('  Testnet:');
console.log('    Firewall:', DEPLOYED_CONTRACTS.testnet.firewall);
console.log('    Policy Engine:', DEPLOYED_CONTRACTS.testnet.policyEngine);

console.log('\n✨ Package is ready for publishing!');
