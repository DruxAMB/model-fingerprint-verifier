"use client";

import { useState, useEffect, useCallback } from "react";

// Minimal EIP-1193 provider type
type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export type WalletState = {
  address: string | null;
  connecting: boolean;
  error: string | null;
  hasWallet: boolean;
};

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);

  // Detect wallet on mount
  useEffect(() => {
    setHasWallet(typeof window !== "undefined" && !!window.ethereum);

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

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("No wallet found. Install MetaMask to continue.");
      return;
    }

    setConnecting(true);
    setError(null);
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(msg);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setError(null);
  }, []);

  return {
    address,
    connecting,
    error,
    hasWallet,
    connect,
    disconnect,
  };
}
