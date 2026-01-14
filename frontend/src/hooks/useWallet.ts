import { useState, useEffect, useCallback } from 'react';

interface WalletState {
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  chainId: number | null;
  walletName: string | null;
}

const CRONOS_TESTNET_CHAIN_ID = 338;
const CRONOS_TESTNET_CONFIG = {
  chainId: '0x152',
  chainName: 'Cronos Testnet',
  nativeCurrency: {
    name: 'Test CRO',
    symbol: 'tCRO',
    decimals: 18,
  },
  rpcUrls: ['https://evm-t3.cronos.org'],
  blockExplorerUrls: ['https://cronos.org/explorer/testnet3'],
};

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, callback: (data: unknown) => void) => void;
  removeListener: (event: string, callback: (data: unknown) => void) => void;
  isMetaMask?: boolean;
  isPhantom?: boolean;
  providers?: EthereumProvider[];
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

// Detect available wallets
function getAvailableWallets(): { name: string; provider: EthereumProvider }[] {
  const wallets: { name: string; provider: EthereumProvider }[] = [];
  
  if (typeof window.ethereum === 'undefined') return wallets;

  // Check for multiple providers
  if (window.ethereum.providers?.length) {
    for (const provider of window.ethereum.providers) {
      if (provider.isMetaMask && !provider.isPhantom) {
        wallets.push({ name: 'MetaMask', provider });
      } else if (provider.isPhantom) {
        wallets.push({ name: 'Phantom', provider });
      }
    }
  } else {
    // Single provider
    if (window.ethereum.isMetaMask && !window.ethereum.isPhantom) {
      wallets.push({ name: 'MetaMask', provider: window.ethereum });
    } else if (window.ethereum.isPhantom) {
      wallets.push({ name: 'Phantom', provider: window.ethereum });
    } else {
      wallets.push({ name: 'Browser Wallet', provider: window.ethereum });
    }
  }

  return wallets;
}

// Get MetaMask specifically
function getMetaMaskProvider(): EthereumProvider | null {
  if (typeof window.ethereum === 'undefined') return null;

  if (window.ethereum.providers?.length) {
    const metaMask = window.ethereum.providers.find(p => p.isMetaMask && !p.isPhantom);
    if (metaMask) return metaMask;
  }

  if (window.ethereum.isMetaMask && !window.ethereum.isPhantom) {
    return window.ethereum;
  }

  return null;
}

let activeProvider: EthereumProvider | null = null;

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnecting: false,
    error: null,
    chainId: null,
    walletName: null,
  });

  const [availableWallets, setAvailableWallets] = useState<string[]>([]);

  // Detect wallets on mount
  useEffect(() => {
    const wallets = getAvailableWallets();
    setAvailableWallets(wallets.map(w => w.name));
  }, []);

  // Listen for changes
  useEffect(() => {
    if (!activeProvider) return;

    const handleAccountsChanged = (data: unknown) => {
      const accounts = data as string[];
      if (!accounts?.length) {
        setState({ address: null, isConnecting: false, error: null, chainId: null, walletName: null });
        activeProvider = null;
      } else {
        setState(prev => ({ ...prev, address: accounts[0] }));
      }
    };

    const handleChainChanged = (data: unknown) => {
      const chainId = parseInt(data as string, 16);
      setState(prev => ({ ...prev, chainId }));
    };

    activeProvider.on('accountsChanged', handleAccountsChanged);
    activeProvider.on('chainChanged', handleChainChanged);

    return () => {
      if (activeProvider) {
        activeProvider.removeListener('accountsChanged', handleAccountsChanged);
        activeProvider.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [state.address]);

  const switchToCronosTestnet = useCallback(async () => {
    if (!activeProvider) return;

    try {
      await activeProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CRONOS_TESTNET_CONFIG.chainId }],
      });
      setState(prev => ({ ...prev, chainId: CRONOS_TESTNET_CHAIN_ID, error: null }));
    } catch (switchError: unknown) {
      if ((switchError as { code?: number })?.code === 4902) {
        try {
          await activeProvider.request({
            method: 'wallet_addEthereumChain',
            params: [CRONOS_TESTNET_CONFIG],
          });
          setState(prev => ({ ...prev, chainId: CRONOS_TESTNET_CHAIN_ID, error: null }));
        } catch (addError) {
          setState(prev => ({ ...prev, error: 'Failed to add Cronos Testnet' }));
        }
      } else {
        setState(prev => ({ ...prev, error: 'Failed to switch network' }));
      }
    }
  }, []);

  // Connect specifically to MetaMask
  const connectMetaMask = useCallback(async () => {
    const provider = getMetaMaskProvider();
    
    if (!provider) {
      setState(prev => ({ 
        ...prev, 
        error: 'MetaMask not found. Please install MetaMask extension.' 
      }));
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    activeProvider = provider;

    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      
      if (!accounts?.length) throw new Error('No accounts');

      const chainIdHex = await provider.request({ method: 'eth_chainId' }) as string;
      const chainId = parseInt(chainIdHex, 16);

      setState(prev => ({
        ...prev,
        address: accounts[0],
        chainId,
        isConnecting: false,
        walletName: 'MetaMask',
      }));

      // Auto-switch to Cronos
      if (chainId !== CRONOS_TESTNET_CHAIN_ID) {
        setTimeout(() => switchToCronosTestnet(), 500);
      }

    } catch (err: unknown) {
      activeProvider = null;
      const message = err instanceof Error ? err.message : 'Connection failed';
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: message.includes('rejected') ? 'Connection rejected' : message,
      }));
    }
  }, [switchToCronosTestnet]);

  // Generic connect (will use whatever is available)
  const connect = useCallback(async () => {
    // Always prefer MetaMask for Cronos
    const metaMask = getMetaMaskProvider();
    if (metaMask) {
      return connectMetaMask();
    }

    // Fallback to any available provider
    const wallets = getAvailableWallets();
    if (wallets.length === 0) {
      setState(prev => ({ ...prev, error: 'No wallet found. Please install MetaMask.' }));
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    // If only Phantom, warn user
    if (wallets.length === 1 && wallets[0].name === 'Phantom') {
      setState(prev => ({ 
        ...prev, 
        error: 'Only Phantom detected. Phantom may not support Cronos. Please install MetaMask.' 
      }));
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    const wallet = wallets[0];
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    activeProvider = wallet.provider;

    try {
      const accounts = await wallet.provider.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts?.length) throw new Error('No accounts');

      const chainIdHex = await wallet.provider.request({ method: 'eth_chainId' }) as string;
      const chainId = parseInt(chainIdHex, 16);

      setState(prev => ({
        ...prev,
        address: accounts[0],
        chainId,
        isConnecting: false,
        walletName: wallet.name,
      }));

      if (chainId !== CRONOS_TESTNET_CHAIN_ID) {
        setTimeout(() => switchToCronosTestnet(), 500);
      }

    } catch (err: unknown) {
      activeProvider = null;
      const message = err instanceof Error ? err.message : 'Connection failed';
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: message,
      }));
    }
  }, [connectMetaMask, switchToCronosTestnet]);

  const disconnect = useCallback(() => {
    activeProvider = null;
    setState({
      address: null,
      isConnecting: false,
      error: null,
      chainId: null,
      walletName: null,
    });
  }, []);

  return {
    address: state.address,
    isConnecting: state.isConnecting,
    error: state.error,
    chainId: state.chainId,
    walletName: state.walletName,
    isConnected: !!state.address,
    isCorrectChain: state.chainId === CRONOS_TESTNET_CHAIN_ID,
    availableWallets,
    hasMetaMask: availableWallets.includes('MetaMask'),
    connect,
    connectMetaMask,
    disconnect,
    switchToCronosTestnet,
  };
}

// Export the active provider for use in contracts
export function getActiveProvider(): EthereumProvider | null {
  return activeProvider;
}
