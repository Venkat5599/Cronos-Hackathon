/**
 * Batch Operations for x402 Payment Firewall
 * 
 * @example
 * ```typescript
 * import { batchPay } from '@venkat5599/x402-firewall-sdk/batch';
 * 
 * const results = await batchPay(firewall, [
 *   { recipient: '0x...', amount: '100' },
 *   { recipient: '0x...', amount: '200' }
 * ]);
 * ```
 */

import type { X402Firewall } from './index';
import type { PaymentResult } from './index';

export interface BatchPaymentRequest {
  recipient: string;
  amount: string;
}

export interface BatchPaymentResult {
  success: boolean;
  results: PaymentResult[];
  successCount: number;
  failureCount: number;
  totalAmount: string;
}

/**
 * Execute multiple payments in sequence
 * 
 * @param firewall X402Firewall instance
 * @param payments Array of payment requests
 * @param options Batch options
 * @returns Batch payment results
 */
export async function batchPay(
  firewall: X402Firewall,
  payments: BatchPaymentRequest[],
  options?: {
    stopOnError?: boolean;
    delayMs?: number;
  }
): Promise<BatchPaymentResult> {
  const { stopOnError = false, delayMs = 0 } = options || {};
  
  const results: PaymentResult[] = [];
  let successCount = 0;
  let failureCount = 0;
  let totalAmount = 0;

  for (const payment of payments) {
    try {
      const result = await firewall.pay(payment.recipient, payment.amount);
      results.push(result);
      
      if (result.success) {
        successCount++;
        totalAmount += parseFloat(payment.amount);
      } else {
        failureCount++;
        if (stopOnError) break;
      }
      
      // Optional delay between payments
      if (delayMs > 0 && payments.indexOf(payment) < payments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      failureCount++;
      results.push({
        success: false,
        txHash: '',
        error: (error as Error).message,
      });
      
      if (stopOnError) break;
    }
  }

  return {
    success: failureCount === 0,
    results,
    successCount,
    failureCount,
    totalAmount: totalAmount.toString(),
  };
}

/**
 * Register multiple intents in batch
 */
export async function batchRegisterIntents(
  firewall: X402Firewall,
  intents: Array<{
    recipient: string;
    amount: string;
    validForSeconds?: number;
  }>
): Promise<Array<{ hash: string; success: boolean; error?: string }>> {
  const results = [];

  for (const intent of intents) {
    try {
      const { hash } = await firewall.registerIntent(
        intent.recipient,
        intent.amount,
        intent.validForSeconds
      );
      results.push({ hash, success: true });
    } catch (error) {
      results.push({
        hash: '',
        success: false,
        error: (error as Error).message,
      });
    }
  }

  return results;
}

/**
 * Simulate multiple payments before executing
 */
export async function batchSimulate(
  firewall: X402Firewall,
  sender: string,
  payments: BatchPaymentRequest[]
): Promise<Array<{
  recipient: string;
  amount: string;
  allowed: boolean;
  reason: string;
}>> {
  const results = [];

  for (const payment of payments) {
    const simulation = await firewall.simulate(
      sender,
      payment.recipient,
      payment.amount
    );
    
    results.push({
      recipient: payment.recipient,
      amount: payment.amount,
      allowed: simulation.allowed,
      reason: simulation.reason,
    });
  }

  return results;
}

/**
 * Get multiple intents by hash
 */
export async function batchGetIntents(
  firewall: X402Firewall,
  intentHashes: string[]
): Promise<Array<any>> {
  const results = [];

  for (const hash of intentHashes) {
    const intent = await firewall.getIntent(hash);
    results.push(intent);
  }

  return results;
}
