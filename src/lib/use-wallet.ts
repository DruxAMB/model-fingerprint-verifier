"use client";

import { useState, useEffect, useCallback } from "react";
import { MetaMask, CoinbaseWallet, Rabby, OKXWallet, TrustWallet, PhantomWallet } from "react-web3-icons";

// Minimal EIP-1193 provider type
type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isOkxWallet?: boolean;
  isTrust?: boolean;
  isBraveWallet?: boolean;
  isPhantom?: boolean;
  providers?: Eip1193Provider[];
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export type WalletId = "metamask" | "coinbase" | "rabby" | "okx" | "trust" | "phantom" | "browser";

export type DetectedWallet = {
  id: WalletId;
  name: string;
  provider: Eip1193Provider | null;
  installed: boolean;
};

// Wallet metadata with logo component references
export const WALLET_META: Record<
  WalletId,
  { name: string; Logo: React.ComponentType<{ className?: string }> }
> = {
  metamask: { name: "MetaMask", Logo: MetaMask },
  coinbase: { name: "Coinbase Wallet", Logo: CoinbaseWallet },
  rabby: { name: "Rabby Wallet", Logo: Rabby },
  okx: { name: "OKX Wallet", Logo: OKXWallet },
  trust: { name: "Trust Wallet", Logo: TrustWallet },
  phantom: { name: "Phantom", Logo: PhantomWallet },
  browser: { name: "Browser Wallet", Logo: MetaMask }, // fallback uses generic
};

// Detect all injected wallets available in the browser
function detectWallets(): DetectedWallet[] {
  if (typeof window === "undefined" || !window.ethereum) {
    return [];
  }

  const providers: Eip1193Provider[] = [];
  // Some wallets inject multiple providers via window.ethereum.providers
  if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
    providers.push(...window.ethereum.providers);
  } else {
    providers.push(window.ethereum);
  }

  const detected: Record<string, DetectedWallet> = {};

  for (const provider of providers) {
    if (provider.isMetaMask && !detected.metamask) {
      detected.metamask = { id: "metamask", name: "MetaMask", provider, installed: true };
    }
    if (provider.isCoinbaseWallet && !detected.coinbase) {
      detected.coinbase = { id: "coinbase", name: "Coinbase Wallet", provider, installed: true };
    }
    if (provider.isRabby && !detected.rabby) {
      detected.rabby = { id: "rabby", name: "Rabby Wallet", provider, installed: true };
    }
    if (provider.isOkxWallet && !detected.okx) {
      detected.okx = { id: "okx", name: "OKX Wallet", provider, installed: true };
    }
    if (provider.isTrust && !detected.trust) {
      detected.trust = { id: "trust", name: "Trust Wallet", provider, installed: true };
    }
    if (provider.isPhantom && !detected.phantom) {
      detected.phantom = { id: "phantom", name: "Phantom", provider, installed: true };
    }
  }

  return Object.values(detected);
}

export type WalletState = {
  address: string | null;
  connecting: boolean;
  error: string | null;
  hasWallet: boolean;
  showWalletModal: boolean;
  detectedWallets: DetectedWallet[];
};

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<WalletId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [detectedWallets, setDetectedWallets] = useState<DetectedWallet[]>([]);

  // Detect wallets on mount
  useEffect(() => {
    const wallets = detectWallets();
    setDetectedWallets(wallets);
    setHasWallet(wallets.length > 0 || !!window.ethereum);

    // Check if already connected
    if (typeof window !== "undefined" && window.ethereum) {
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts: unknown) => {
          const arr = accounts as string[];
          if (arr && arr.length > 0) {
            setAddress(arr[0]);
          }
        })
        .catch(() => {});

      // Listen for account changes
      const handleAccountsChanged = (...args: unknown[]) => {
        const accounts = args[0] as string[];
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
        } else {
          setAddress(null);
        }
      };

      window.ethereum.on?.("accountsChanged", handleAccountsChanged);
      return () => {
        window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      };
    }
  }, []);

  const connectWithProvider = useCallback(
    async (walletId: WalletId, provider: Eip1193Provider, walletName: string) => {
      setConnecting(true);
      setConnectingWallet(walletId);
      setError(null);
      try {
        const accounts = (await provider.request({
          method: "eth_requestAccounts",
        })) as string[];
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
          setShowWalletModal(false);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Failed to connect ${walletName}`;
        setError(msg);
      } finally {
        setConnecting(false);
        setConnectingWallet(null);
      }
    },
    [],
  );

  const connect = useCallback(
    async (walletId?: WalletId) => {
      if (typeof window === "undefined" || !window.ethereum) {
        setError("No wallet found. Install MetaMask to continue.");
        return;
      }

      // If a specific wallet was selected from the modal
      if (walletId && walletId !== "browser") {
        const wallets = detectWallets();
        const wallet = wallets.find((w) => w.id === walletId);
        if (wallet && wallet.provider) {
          await connectWithProvider(walletId, wallet.provider, wallet.name);
          return;
        }
      }

      // "Browser Wallet" fallback
      if (walletId === "browser") {
        await connectWithProvider("browser", window.ethereum, "Browser Wallet");
        return;
      }

      // No walletId specified — always show the modal
      const wallets = detectWallets();
      setDetectedWallets(wallets);
      setShowWalletModal(true);
    },
    [connectWithProvider],
  );

  const disconnect = useCallback(() => {
    setAddress(null);
    setError(null);
  }, []);

  return {
    address,
    connecting,
    connectingWallet,
    error,
    hasWallet,
    showWalletModal,
    detectedWallets,
    setShowWalletModal,
    connect,
    disconnect,
  };
}
