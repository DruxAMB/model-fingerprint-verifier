"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MetaMask, CoinbaseWallet, Rabby, RainbowWallet, PhantomWallet } from "react-web3-icons";

// Minimal EIP-1193 provider type
type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isBraveWallet?: boolean;
  isPhantom?: boolean;
  isRainbow?: boolean;
  providers?: Eip1193Provider[];
};

// EIP-6963 provider announcement
type Eip6963ProviderInfo = {
  name: string;
  icon?: string;
  rdns?: string;
};

type Eip6963Announcement = {
  info: Eip6963ProviderInfo;
  provider: Eip1193Provider;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    phantom?: { ethereum?: Eip1193Provider };
    coinbaseWalletExtension?: Eip1193Provider;
  }
}

export type WalletId = "metamask" | "coinbase" | "rabby" | "rainbow" | "phantom" | "browser";

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
  rainbow: { name: "Rainbow", Logo: RainbowWallet },
  phantom: { name: "Phantom", Logo: PhantomWallet },
  browser: { name: "Browser Wallet", Logo: MetaMask },
};

// Match a provider to a WalletId by checking its flags and EIP-6963 info.
// Key issue: Rainbow and Coinbase both set isMetaMask=true for compatibility,
// so we must exclude them when detecting MetaMask.
function identifyProvider(
  provider: Eip1193Provider,
  eip6963Info?: Eip6963ProviderInfo,
): WalletId | null {
  // EIP-6963 rdns (reverse domain name) is the most reliable identifier
  if (eip6963Info?.rdns) {
    const rdns = eip6963Info.rdns.toLowerCase();
    if (rdns === "io.metamask" || rdns === "io.metamask.mobile") return "metamask";
    if (rdns === "com.coinbase.wallet") return "coinbase";
    if (rdns === "app.rabby") return "rabby";
    if (rdns === "me.rainbow") return "rainbow";
    if (rdns === "app.phantom") return "phantom";
  }

  // EIP-6963 name matching (fallback when rdns is absent)
  if (eip6963Info?.name) {
    const name = eip6963Info.name.toLowerCase();
    if (name === "metamask") return "metamask";
    if (name === "coinbase wallet" || name === "coinbase") return "coinbase";
    if (name === "rabby") return "rabby";
    if (name === "rainbow") return "rainbow";
    if (name === "phantom") return "phantom";
  }

  // Legacy flag-based detection.
  // MetaMask: must have isMetaMask AND must NOT be Rainbow/Coinbase/Phantom.
  // Rainbow Wallet sets isMetaMask=true AND isRainbow=true.
  // Coinbase Wallet sets overrideIsMetaMask=true (isMetaMask=true).
  if (
    provider.isMetaMask &&
    !provider.isCoinbaseWallet &&
    !provider.isPhantom &&
    !provider.isRabby &&
    !provider.isRainbow
  ) {
    return "metamask";
  }
  if (provider.isCoinbaseWallet) return "coinbase";
  if (provider.isRabby) return "rabby";
  if (provider.isRainbow) return "rainbow";
  if (provider.isPhantom) return "phantom";

  return null;
}

// Discover wallets via EIP-6963 (Multi Injected Provider Discovery).
// This is the modern standard that solves the multi-wallet shadowing problem.
// When multiple wallets are installed, window.ethereum only points to one of them
// (usually the last-loaded). EIP-6963 lets each wallet announce itself separately.
function discoverEIP6963Providers(): Promise<Eip6963Announcement[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve([]);
      return;
    }

    const announcements: Eip6963Announcement[] = [];
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as Eip6963Announcement;
      if (detail?.provider && typeof detail.provider.request === "function") {
        announcements.push(detail);
      }
    };

    window.addEventListener("eip6963:announceProvider", handler);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // Wallets respond synchronously in most implementations.
    // Give a small timeout for any async responses.
    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", handler);
      resolve(announcements);
    }, 200);
  });
}

// Detect all injected wallets using EIP-6963 first, then legacy fallbacks.
async function detectWalletsAsync(): Promise<DetectedWallet[]> {
  if (typeof window === "undefined") return [];

  const detected: Record<string, DetectedWallet> = {};

  // 1. EIP-6963 discovery (most reliable in multi-wallet environments)
  const announcements = await discoverEIP6963Providers();
  for (const ann of announcements) {
    const id = identifyProvider(ann.provider, ann.info);
    if (id && !detected[id]) {
      detected[id] = {
        id,
        name: ann.info.name || WALLET_META[id].name,
        provider: ann.provider,
        installed: true,
      };
    }
  }

  // 2. Legacy fallback: window.ethereum and its providers[] array
  if (window.ethereum) {
    const candidates: Eip1193Provider[] = [window.ethereum];
    if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
      candidates.push(...window.ethereum.providers);
    }

    for (const provider of candidates) {
      if (!provider) continue;
      const id = identifyProvider(provider);
      if (id && !detected[id]) {
        detected[id] = {
          id,
          name: WALLET_META[id].name,
          provider,
          installed: true,
        };
      }
    }
  }

  // 3. Legacy fallback: Phantom injects at window.phantom.ethereum
  if (!detected.phantom && window.phantom?.ethereum) {
    detected.phantom = {
      id: "phantom",
      name: "Phantom",
      provider: window.phantom.ethereum,
      installed: true,
    };
  }

  // 4. Legacy fallback: Coinbase injects at window.coinbaseWalletExtension
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

// Synchronous quick-detect for the initial render (before EIP-6963 completes).
// Uses only legacy injection points. EIP-6963 discovery runs async in useEffect.
function detectWalletsSync(): DetectedWallet[] {
  if (typeof window === "undefined") return [];

  const detected: Record<string, DetectedWallet> = {};

  if (window.ethereum) {
    const candidates: Eip1193Provider[] = [window.ethereum];
    if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
      candidates.push(...window.ethereum.providers);
    }

    for (const provider of candidates) {
      if (!provider) continue;
      const id = identifyProvider(provider);
      if (id && !detected[id]) {
        detected[id] = {
          id,
          name: WALLET_META[id].name,
          provider,
          installed: true,
        };
      }
    }
  }

  if (!detected.phantom && window.phantom?.ethereum) {
    detected.phantom = {
      id: "phantom",
      name: "Phantom",
      provider: window.phantom.ethereum,
      installed: true,
    };
  }

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

export type WalletState = {
  address: string | null;
  connecting: boolean;
  connectingWallet: WalletId | null;
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
  // Cache of EIP-6963 discovered wallets, kept in a ref so connect() can use it
  const eip6963Cache = useRef<DetectedWallet[]>([]);

  // Detect wallets on mount - sync first, then async EIP-6963
  useEffect(() => {
    // Quick sync detect for immediate UI, deferred so hydration stays clean
    queueMicrotask(() => {
      const syncWallets = detectWalletsSync();
      setDetectedWallets(syncWallets);
      setHasWallet(syncWallets.length > 0 || !!window.ethereum);
    });

    // Async EIP-6963 discover for shadowed wallets (e.g. MetaMask behind Rainbow)
    detectWalletsAsync().then((asyncWallets) => {
      eip6963Cache.current = asyncWallets;
      setDetectedWallets(asyncWallets);
      setHasWallet(asyncWallets.length > 0 || !!window.ethereum);
    });

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
        // Check EIP-6963 cache first (most reliable)
        const cached = eip6963Cache.current.find((w) => w.id === walletId);
        if (cached?.provider) {
          await connectWithProvider(walletId, cached.provider, cached.name);
          return;
        }

        // Check current detected wallets
        const wallets = detectWalletsSync();
        const wallet = wallets.find((w) => w.id === walletId);
        if (wallet?.provider) {
          await connectWithProvider(walletId, wallet.provider, wallet.name);
          return;
        }

        // Re-run EIP-6963 discovery in case it hasn't completed yet
        const asyncWallets = await detectWalletsAsync();
        eip6963Cache.current = asyncWallets;
        const asyncWallet = asyncWallets.find((w) => w.id === walletId);
        if (asyncWallet?.provider) {
          await connectWithProvider(walletId, asyncWallet.provider, asyncWallet.name);
          return;
        }

        // No provider found for this wallet
        setError(`${WALLET_META[walletId].name} not detected. Make sure the extension is installed and enabled.`);
        return;
      }

      // "Browser Wallet" fallback - use whatever window.ethereum is
      if (walletId === "browser") {
        if (window.ethereum) {
          await connectWithProvider("browser", window.ethereum, "Browser Wallet");
        } else {
          setError("No browser wallet found. Install MetaMask or another wallet extension.");
        }
        return;
      }

      // No walletId specified - show the modal
      const wallets = eip6963Cache.current.length > 0 ? eip6963Cache.current : detectWalletsSync();
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
