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
    phantom?: { ethereum?: Eip1193Provider };
    coinbaseWalletExtension?: Eip1193Provider;
    okxwallet?: Eip1193Provider;
    trustwallet?: Eip1193Provider;
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

// Detect all injected wallets available in the browser.
// Wallets inject themselves in different ways:
// - MetaMask, Rabby: window.ethereum with isMetaMask/isRabby flag
// - Coinbase: window.ethereum.providers[] with isCoinbaseWallet, or window.coinbaseWalletExtension
// - Phantom: window.phantom.ethereum (separate injection point), or window.ethereum with isPhantom
// - OKX: window.okxwallet, or window.ethereum.providers[] with isOkxWallet
// - Trust: window.trustwallet, or window.ethereum.providers[] with isTrust
function detectWallets(): DetectedWallet[] {
  if (typeof window === "undefined") return [];

  const detected: Record<string, DetectedWallet> = {};

  // Gather all possible providers to check
  const candidates: Eip1193Provider[] = [];

  // 1. window.ethereum (may be a single provider or have a providers[] array)
  if (window.ethereum) {
    candidates.push(window.ethereum);
    if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
      candidates.push(...window.ethereum.providers);
    }
  }

  // 2. Phantom injects at window.phantom.ethereum (separate from window.ethereum)
  if (window.phantom?.ethereum) {
    candidates.push(window.phantom.ethereum);
  }

  // 3. Coinbase may also inject at window.coinbaseWalletExtension
  if (window.coinbaseWalletExtension) {
    candidates.push(window.coinbaseWalletExtension);
  }

  // 4. OKX may inject at window.okxwallet
  if (window.okxwallet) {
    candidates.push(window.okxwallet);
  }

  // 5. Trust may inject at window.trustwallet
  if (window.trustwallet) {
    candidates.push(window.trustwallet);
  }

  // Check each candidate provider for wallet-specific flags
  for (const provider of candidates) {
    if (!provider) continue;

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

  // Special case: Phantom injects at window.phantom.ethereum but may not set
  // isPhantom on the provider in all versions. If window.phantom exists, mark it.
  if (!detected.phantom && window.phantom?.ethereum) {
    detected.phantom = {
      id: "phantom",
      name: "Phantom",
      provider: window.phantom.ethereum,
      installed: true,
    };
  }

  // Special case: Coinbase may inject at window.coinbaseWalletExtension
  // without the isCoinbaseWallet flag
  if (!detected.coinbase && window.coinbaseWalletExtension) {
    detected.coinbase = {
      id: "coinbase",
      name: "Coinbase Wallet",
      provider: window.coinbaseWalletExtension,
      installed: true,
    };
  }

  return Object.values(detected);
}

// Try to get a specific wallet's provider by its known injection point.
// Used as a fallback when detectWallets() doesn't find it.
function getWalletProvider(walletId: WalletId): Eip1193Provider | null {
  if (typeof window === "undefined") return null;

  switch (walletId) {
    case "metamask":
      // MetaMask is usually window.ethereum with isMetaMask
      if (window.ethereum?.isMetaMask) return window.ethereum;
      if (window.ethereum?.providers) {
        const mm = window.ethereum.providers.find((p) => p.isMetaMask);
        if (mm) return mm;
      }
      return window.ethereum ?? null;

    case "coinbase":
      if (window.coinbaseWalletExtension) return window.coinbaseWalletExtension;
      if (window.ethereum?.isCoinbaseWallet) return window.ethereum;
      if (window.ethereum?.providers) {
        const cb = window.ethereum.providers.find((p) => p.isCoinbaseWallet);
        if (cb) return cb;
      }
      return null;

    case "phantom":
      if (window.phantom?.ethereum) return window.phantom.ethereum;
      if (window.ethereum?.isPhantom) return window.ethereum;
      return null;

    case "rabby":
      if (window.ethereum?.isRabby) return window.ethereum;
      if (window.ethereum?.providers) {
        const rb = window.ethereum.providers.find((p) => p.isRabby);
        if (rb) return rb;
      }
      return null;

    case "okx":
      if (window.okxwallet) return window.okxwallet;
      if (window.ethereum?.isOkxWallet) return window.ethereum;
      if (window.ethereum?.providers) {
        const ok = window.ethereum.providers.find((p) => p.isOkxWallet);
        if (ok) return ok;
      }
      return null;

    case "trust":
      if (window.trustwallet) return window.trustwallet;
      if (window.ethereum?.isTrust) return window.ethereum;
      if (window.ethereum?.providers) {
        const tw = window.ethereum.providers.find((p) => p.isTrust);
        if (tw) return tw;
      }
      return null;

    default:
      return window.ethereum ?? null;
  }
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
      if (typeof window === "undefined") {
        setError("No wallet found. This only works in a browser.");
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

        // Wallet not detected — try its known injection point as a last resort
        const fallbackProvider = getWalletProvider(walletId);
        if (fallbackProvider) {
          await connectWithProvider(walletId, fallbackProvider, WALLET_META[walletId].name);
          return;
        }

        // No provider found for this wallet
        setError(`${WALLET_META[walletId].name} not detected. Make sure the extension is installed and enabled.`);
        return;
      }

      // "Browser Wallet" fallback — use whatever window.ethereum is
      if (walletId === "browser") {
        if (window.ethereum) {
          await connectWithProvider("browser", window.ethereum, "Browser Wallet");
        } else {
          setError("No browser wallet found. Install MetaMask or another wallet extension.");
        }
        return;
      }

      // No walletId specified — show the modal
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
