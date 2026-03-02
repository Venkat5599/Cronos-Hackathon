/**
 * Custom error types for x402 Payment Firewall
 */

export class FirewallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirewallError';
  }
}

export class ExceedsLimitError extends FirewallError {
  constructor(
    public amount: string,
    public limit: string,
    public limitType: 'transaction' | 'daily'
  ) {
    super(`Payment of ${amount} CRO exceeds ${limitType} limit of ${limit} CRO`);
    this.name = 'ExceedsLimitError';
  }
}

export class BlacklistedError extends FirewallError {
  constructor(
    public address: string,
    public type: 'sender' | 'recipient'
  ) {
    super(`${type} address ${address} is blacklisted`);
    this.name = 'BlacklistedError';
  }
}

export class NotWhitelistedError extends FirewallError {
  constructor(public recipient: string) {
    super(`Recipient ${recipient} is not whitelisted`);
    this.name = 'NotWhitelistedError';
  }
}

export class RateLimitError extends FirewallError {
  constructor(
    public waitTime: number
  ) {
    super(`Rate limit exceeded. Wait ${waitTime} seconds before next payment`);
    this.name = 'RateLimitError';
  }
}

export class PausedError extends FirewallError {
  constructor() {
    super('Firewall is paused. No payments can be executed.');
    this.name = 'PausedError';
  }
}

export class IntentNotFoundError extends FirewallError {
  constructor(public intentHash: string) {
    super(`Intent ${intentHash} not found`);
    this.name = 'IntentNotFoundError';
  }
}

export class IntentExpiredError extends FirewallError {
  constructor(public intentHash: string, public expiry: number) {
    super(`Intent ${intentHash} expired at ${new Date(expiry * 1000).toISOString()}`);
    this.name = 'IntentExpiredError';
  }
}

export class UnauthorizedError extends FirewallError {
  constructor(action: string) {
    super(`Unauthorized to perform action: ${action}`);
    this.name = 'UnauthorizedError';
  }
}

export class InsufficientBalanceError extends FirewallError {
  constructor(
    public required: string,
    public available: string
  ) {
    super(`Insufficient balance. Required: ${required} CRO, Available: ${available} CRO`);
    this.name = 'InsufficientBalanceError';
  }
}

/**
 * Parse contract revert reason into specific error type
 */
export function parseFirewallError(error: Error): FirewallError {
  const message = error.message;

  // Exceeds max payment limit
  if (message.includes('Exceeds max payment limit')) {
    const match = message.match(/(\d+\.?\d*)/g);
    if (match && match.length >= 2) {
      return new ExceedsLimitError(match[0], match[1], 'transaction');
    }
  }

  // Daily limit exceeded
  if (message.includes('Daily limit exceeded')) {
    return new ExceedsLimitError('unknown', 'unknown', 'daily');
  }

  // Sender blocked
  if (message.includes('Sender blocked')) {
    return new BlacklistedError('unknown', 'sender');
  }

  // Recipient blacklisted
  if (message.includes('Recipient blacklisted')) {
    return new BlacklistedError('unknown', 'recipient');
  }

  // Not whitelisted
  if (message.includes('Recipient not whitelisted')) {
    return new NotWhitelistedError('unknown');
  }

  // Rate limit
  if (message.includes('Rate limit')) {
    return new RateLimitError(0);
  }

  // Paused
  if (message.includes('Pausable: paused') || message.includes('Contract is paused')) {
    return new PausedError();
  }

  // Intent expired
  if (message.includes('Intent expired')) {
    return new IntentExpiredError('unknown', 0);
  }

  // Unauthorized
  if (message.includes('Ownable: caller is not the owner') || message.includes('Not authorized')) {
    return new UnauthorizedError('unknown');
  }

  // Insufficient balance
  if (message.includes('insufficient funds')) {
    return new InsufficientBalanceError('unknown', 'unknown');
  }

  // Generic firewall error
  return new FirewallError(message);
}
