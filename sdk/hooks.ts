/**
 * React Hooks for x402 Payment Firewall
 * 
 * @example
 * ```tsx
 * import { useFirewall } from '@venkat5599/x402-firewall-sdk/hooks';
 * 
 * function MyComponent() {
 *   const { firewall, loading, error } = useFirewall({ network: 'testnet' });
 *   
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   
 *   return <button onClick={() => firewall.pay('0x...', '100')}>Pay</button>;
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { X402Firewall } from './index';
import type { PaymentResult, FirewallStats, PolicyState } from './index';

export interface UseFirewallOptions {
  network?: 'testnet' | 'mainnet';
  autoConnect?: boolean;
}

export interface UseFirewallReturn {
  firewall: X402Firewall | null;
  loading: boolean;
  error: Error | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * Hook to connect to x402 Firewall with browser wallet
 */
export function useFirewall(options: UseFirewallOptions = {}): UseFirewallReturn {
  const { network = 'testnet', autoConnect = true } = options;
  const [firewall, setFirewall] = useState<X402Firewall | null>(null);
  const [loading, setLoading] = useState(autoConnect);
  const [error, setError] = useState<Error | null>(null);

  const connect = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fw = await X402Firewall.fromBrowserWallet({ network });
      setFirewall(fw);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [network]);

  const disconnect = useCallback(() => {
    setFirewall(null);
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
  }, [autoConnect, connect]);

  return { firewall, loading, error, connect, disconnect };
}

/**
 * Hook to execute payments with loading state
 */
export function usePayment(firewall: X402Firewall | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);

  const pay = useCallback(async (recipient: string, amount: string) => {
    if (!firewall) {
      setError(new Error('Firewall not connected'));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await firewall.pay(recipient, amount);
      setResult(res);
      return res;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [firewall]);

  return { pay, loading, error, result };
}

/**
 * Hook to fetch firewall stats with auto-refresh
 */
export function useFirewallStats(
  firewall: X402Firewall | null,
  refreshInterval?: number
) {
  const [stats, setStats] = useState<FirewallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!firewall) return;

    try {
      setLoading(true);
      const data = await firewall.getStats();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [firewall]);

  useEffect(() => {
    refresh();

    if (refreshInterval) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refresh, refreshInterval]);

  return { stats, loading, error, refresh };
}

/**
 * Hook to fetch policy state
 */
export function usePolicyState(firewall: X402Firewall | null) {
  const [policy, setPolicy] = useState<PolicyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!firewall) return;

    firewall.getPolicyState()
      .then(setPolicy)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [firewall]);

  return { policy, loading, error };
}

/**
 * Hook to check daily remaining limit
 */
export function useDailyRemaining(
  firewall: X402Firewall | null,
  address: string | null
) {
  const [remaining, setRemaining] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!firewall || !address) return;

    try {
      setLoading(true);
      const amount = await firewall.getDailyRemaining(address);
      setRemaining(amount);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [firewall, address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { remaining, loading, error, refresh };
}
