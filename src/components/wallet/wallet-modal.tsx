"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Wallet } from "lucide-react";
import {
  type WalletId,
  type DetectedWallet,
  WALLET_META,
} from "@/lib/use-wallet";

type WalletModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detectedWallets: DetectedWallet[];
  onSelect: (walletId: WalletId) => void;
  connecting: boolean;
};

// Wallets to always show in the modal (even if not detected)
const ALL_WALLET_IDS: WalletId[] = [
  "metamask",
  "coinbase",
  "rabby",
  "okx",
  "trust",
  "phantom",
];

export function WalletModal({
  open,
  onOpenChange,
  detectedWallets,
  onSelect,
  connecting,
}: WalletModalProps) {
  const detectedIds = new Set(detectedWallets.map((w) => w.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" aria-hidden="true" />
            Connect Wallet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          {/* Detected wallets first */}
          {ALL_WALLET_IDS.map((id) => {
            const meta = WALLET_META[id];
            const isDetected = detectedIds.has(id);
            const Logo = meta.Logo;

            return (
              <button
                key={id}
                onClick={() => onSelect(id)}
                disabled={connecting || !isDetected}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Logo className="h-8 w-8 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{meta.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {isDetected ? "Detected" : "Not installed"}
                  </p>
                </div>
                {connecting && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                )}
              </button>
            );
          })}

          {/* Browser wallet fallback */}
          <div className="my-2 flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={() => onSelect("browser")}
            disabled={connecting}
            className="flex w-full items-center gap-3 rounded-lg border border-dashed p-3 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Wallet className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Browser Wallet</p>
              <p className="text-xs text-muted-foreground">
                Use the built-in browser wallet
              </p>
            </div>
          </button>

          <p className="pt-2 text-center text-xs text-muted-foreground">
            Don't have a wallet?{" "}
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Get one here
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
