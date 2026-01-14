import { PaymentIntent, SimulationResponse } from './types';

const API_BASE = 'http://localhost:3000/api';

export async function simulateIntent(intent: PaymentIntent): Promise<SimulationResponse> {
  const response = await fetch(`${API_BASE}/x402/simulate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(intent),
  });

  if (!response.ok) {
    const text = await response.text();
    let error;
    try {
      error = JSON.parse(text);
    } catch {
      error = { message: text || 'Simulation failed' };
    }
    throw new Error(error.message || 'Simulation failed');
  }

  return response.json();
}

export async function checkHealth(): Promise<{ status: string; network: string }> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) {
      throw new Error('Health check failed');
    }
    const text = await response.text();
    if (!text) {
      return { status: 'healthy', network: 'cronos-testnet' };
    }
    return JSON.parse(text);
  } catch {
    throw new Error('Backend not reachable');
  }
}
