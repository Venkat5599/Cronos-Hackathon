# Changelog

All notable changes to @venkat5599/x402-firewall-sdk will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-03-04

### Added - React Hooks
- `useFirewall()` - Connect to firewall with automatic loading states
- `usePayment()` - Execute payments with state management
- `useFirewallStats()` - Get statistics with auto-refresh
- `usePolicyState()` - Get policy configuration
- `useDailyRemaining()` - Check remaining daily limit

### Added - Event Listeners
- `onPaymentExecuted()` - Listen to successful payments
- `onPaymentBlocked()` - Listen to blocked payments
- `onIntentRegistered()` - Listen to intent registrations
- `onIntentApproved()` - Listen to intent approvals
- `removeAllListeners()` - Clean up all listeners

### Added - Custom Error Types
- `ExceedsLimitError` - Payment exceeds limits
- `BlacklistedError` - Address is blacklisted
- `NotWhitelistedError` - Address not whitelisted
- `RateLimitError` - Rate limit exceeded
- `PausedError` - Firewall is paused
- `IntentExpiredError` - Intent has expired
- `IntentNotFoundError` - Intent not found
- `UnauthorizedError` - Unauthorized action
- `InsufficientBalanceError` - Not enough balance
- `parseFirewallError()` - Parse contract errors

### Added - Gas Estimation
- `estimatePaymentCost()` - Estimate gas for payments
- `estimateIntentCost()` - Estimate gas for intent execution
- Returns gas limit, gas price, and total cost in CRO

### Added - Batch Operations
- `batchPay()` - Execute multiple payments
- `batchRegisterIntents()` - Register multiple intents
- `batchSimulate()` - Simulate multiple payments
- `batchGetIntents()` - Get multiple intents
- Configurable error handling and delays

### Added - CLI Tool
- `pay` command - Execute payments from command line
- `simulate` command - Test payments
- `stats` command - Get firewall statistics
- `intent` command - Get intent details
- `policy` command - Get policy state
- `help` command - Show usage

### Added - Documentation
- `FEATURES.md` - Complete feature list
- `ROADMAP.md` - Future development plans
- Updated README with all new features

### Improved
- Better TypeScript types for all features
- Enhanced error messages
- Improved developer experience
- More comprehensive examples

### Changed
- Package version bumped to 1.1.0
- Added React as optional peer dependency
- Updated exports in package.json
- Extended tsconfig to include new files

---

## [1.0.0] - 2025-03-03

### Added
- Initial release of x402 Payment Firewall SDK
- Core payment execution with automatic policy enforcement
- Intent-based payment flow for high-value transactions
- Payment simulation before execution
- Browser wallet integration (MetaMask support)
- Read-only SDK instance for querying
- Full TypeScript support with type definitions
- Comprehensive error handling and revert reasons
- Admin functions for firewall management
- x402 protocol integration helpers
- Support for Cronos Testnet (Chain ID 338)
- Deployed contract addresses included

### Features
- `pay()` - Execute protected payments
- `simulate()` - Pre-check payment validity
- `registerIntent()` - Register payment intents
- `approveIntent()` / `rejectIntent()` - Intent approval workflow
- `executeIntent()` - Execute approved intents
- `getStats()` - Query firewall statistics
- `getPolicyState()` - Get current policy configuration
- `getDailyRemaining()` - Check remaining daily limit
- Static factory methods: `fromBrowserWallet()`, `readOnly()`

### Security
- On-chain policy enforcement
- Spending limits (per transaction and daily)
- Recipient blacklist/whitelist
- Rate limiting support
- Emergency pause capability
- Sender blocking

### Documentation
- Complete API reference
- Usage examples for all features
- Integration guide for x402 protocol
- TypeScript type exports
- Error handling examples

### Contracts
- Firewall: `0xC3C4E069B294C8ED3841c87d527c942F873CFAA9`
- Policy Engine: `0xD0CE6F16969d81997750afE018A34921DeDd04A0`
- Network: Cronos Testnet (338)
