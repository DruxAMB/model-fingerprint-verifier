"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Fingerprint,
  Plus,
  Loader2,
  ExternalLink,
  Brain,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Wallet,
  LogOut,
} from "lucide-react";
import {
  type Agent,
  type AgentStatus,
  type VerificationResult,
  type Challenge,
  getChallenges,
  getAllAgents,
  registerAgent,
  submitResponses,
  runVerification,
  CONTRACT_ADDRESS,
} from "@/lib/genlayer-client";
import { useWallet } from "@/lib/use-wallet";
import { WalletModal } from "@/components/wallet/wallet-modal";
import { MOCK_RESPONSES } from "@/lib/mock-data";

const KNOWN_MODELS = [
  "GPT-5",
  "Claude Opus 4.5",
  "Claude Sonnet 4.5",
  "Gemini 3 Pro",
  "Gemini 3.6 Flash",
  "Llama 4 Maverick",
  "Qwen3 Max",
  "DeepSeek V3.2",
  "Grok 4",
];

const CUSTOM_MODEL = "__custom__";

const STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; icon: typeof ShieldCheck; className: string }
> = {
  pending: { label: "Pending", icon: Brain, className: "bg-muted text-muted-foreground" },
  verified: { label: "Verified", icon: ShieldCheck, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  flagged: { label: "Flagged", icon: ShieldX, className: "bg-red-500/10 text-red-600 dark:text-red-400" },
  inconclusive: { label: "Inconclusive", icon: ShieldAlert, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

function StatusBadge({ status }: { status: AgentStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge variant="secondary" className={config.className}>
      <Icon className="h-3 w-3 mr-1" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

function AgentCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-medium truncate">
              {agent.claimed_model}
            </CardTitle>
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {agent.description}
            </p>
          </div>
          <StatusBadge status={agent.status} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground font-mono truncate">
          {agent.address}
        </p>
        {agent.verification_result && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            {agent.verification_result.verdict === "match" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            ) : agent.verification_result.verdict === "mismatch" ? (
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            )}
            <span className="text-muted-foreground truncate">
              {agent.verification_result.reasoning}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChallengeResponse({
  challenge,
  response,
  index,
}: {
  challenge: { id: string; prompt: string };
  response: string | undefined;
  index: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-xs">
          {String(index + 1).padStart(2, "0")}
        </Badge>
        <span className="text-sm font-medium">{challenge.id}</span>
      </div>
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground mb-1">Challenge prompt:</p>
        <p className="text-sm">{challenge.prompt}</p>
      </div>
      {response ? (
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground mb-1">Agent response:</p>
          <pre className="text-sm whitespace-pre-wrap font-sans">{response}</pre>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-3">
          <p className="text-sm text-muted-foreground italic">No response submitted yet</p>
        </div>
      )}
    </div>
  );
}

function VerdictDisplay({ result }: { result: VerificationResult }) {
  const isMatch = result.verdict === "match";
  const isMismatch = result.verdict === "mismatch";

  return (
    <div
      className={`rounded-lg border p-4 ${
        isMatch
          ? "border-emerald-500/30 bg-emerald-500/5"
          : isMismatch
            ? "border-red-500/30 bg-red-500/5"
            : "border-amber-500/30 bg-amber-500/5"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {isMatch ? (
          <ShieldCheck className="h-5 w-5 text-emerald-500" aria-hidden="true" />
        ) : isMismatch ? (
          <ShieldX className="h-5 w-5 text-red-500" aria-hidden="true" />
        ) : (
          <ShieldAlert className="h-5 w-5 text-amber-500" aria-hidden="true" />
        )}
        <span className="font-semibold text-lg">
          {isMatch
            ? "VERIFIED"
            : isMismatch
              ? "MISMATCH DETECTED"
              : "INCONCLUSIVE"}
        </span>
        <Badge variant="outline" className="ml-auto">
          {result.confidence}% confidence
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-2">{result.reasoning}</p>
      {isMismatch && result.suspected_actual_model !== "unknown" && (
        <p className="text-sm">
          <span className="text-muted-foreground">Suspected actual model: </span>
          <span className="font-medium">{result.suspected_actual_model}</span>
        </p>
      )}
    </div>
  );
}

export default function Home() {
  const wallet = useWallet();
  const [agents, setAgents] = useState<Record<string, Agent>>({});
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelPreset, setModelPreset] = useState("");
  const [claimedModel, setClaimedModel] = useState("");
  const [description, setDescription] = useState("");

  const refreshAgents = useCallback(async () => {
    try {
      setError(null);
      const allAgents = await getAllAgents();
      setAgents(allAgents);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch agents";
      setError(msg);
    }
  }, []);

  // Fetch challenges and agents on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const ch = await getChallenges();
        setChallenges(ch);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to fetch challenges";
        setError(msg);
      }
      await refreshAgents();
      setLoading(false);
    }
    load();
  }, [refreshAgents]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.address) {
      toast.error("Wallet not connected", {
        description: "Connect your MetaMask wallet to register an agent.",
      });
      return;
    }
    if (!claimedModel.trim() || !description.trim()) return;

    setRegistering(true);
    try {
      const result = await registerAgent(
        wallet.address,
        claimedModel.trim(),
        description.trim(),
      );
      toast.success("Agent registered on-chain", {
        description: `Claiming to be "${claimedModel.trim()}" — tx: ${result.txHash.slice(0, 10)}...`,
      });
      setModelPreset("");
      setClaimedModel("");
      setDescription("");
      setShowRegister(false);
      await refreshAgents();
      // Select the newly registered agent
      const updated = await getAllAgents();
      const fresh = updated[wallet.address];
      if (fresh) setSelectedAgent(fresh);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      toast.error("Registration failed", { description: msg });
    } finally {
      setRegistering(false);
    }
  };

  const handleSubmitMockResponses = async () => {
    if (!selectedAgent || !wallet.address) return;
    setSubmitting(true);
    try {
      const result = await submitResponses(wallet.address, MOCK_RESPONSES);
      toast.success("Responses submitted on-chain", {
        description: "Simulated Gemini 3.6 Flash responses loaded",
      });
      await refreshAgents();
      const updated = await getAllAgents();
      const fresh = updated[selectedAgent.address];
      if (fresh) setSelectedAgent(fresh);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submit responses failed";
      toast.error("Submit responses failed", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunVerification = async () => {
    if (!selectedAgent || !wallet.address) return;
    setVerifying(true);
    try {
      await runVerification(wallet.address);
      await refreshAgents();
      const updated = await getAllAgents();
      const fresh = updated[selectedAgent.address];
      if (fresh) {
        setSelectedAgent(fresh);
        if (fresh.verification_result) {
          if (fresh.verification_result.verdict === "mismatch") {
            toast.error("MISMATCH DETECTED", {
              description: `Agent claiming "${fresh.claimed_model}" is suspected to be "${fresh.verification_result.suspected_actual_model}"`,
            });
          } else if (fresh.verification_result.verdict === "match") {
            toast.success("VERIFIED", {
              description: `Agent confirmed as "${fresh.claimed_model}"`,
            });
          } else {
            toast.warning("INCONCLUSIVE", {
              description: fresh.verification_result.reasoning,
            });
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      toast.error("Verification failed", { description: msg });
    } finally {
      setVerifying(false);
    }
  };

  const agentList = Object.values(agents);
  const connectedAgent = wallet.address ? agents[wallet.address] : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="border-b">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-6 w-6 text-primary" aria-hidden="true" />
              <span className="text-sm font-medium text-muted-foreground">
                GenLayer Intelligent Contract
              </span>
            </div>
            {/* Wallet connection */}
            {wallet.address ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  <Wallet className="h-3 w-3 mr-1" aria-hidden="true" />
                  {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={wallet.disconnect}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Disconnect</span>
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => wallet.connect()}
                disabled={wallet.connecting || !wallet.hasWallet}
              >
                {wallet.connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="h-4 w-4 mr-1" aria-hidden="true" />
                    Connect Wallet
                  </>
                )}
              </Button>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Model Fingerprint Verifier
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl">
            On-chain identity verification for AI agents. GenLayer consensus
            catches agents lying about what model they run.
          </p>
          {wallet.error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {wallet.error}
            </p>
          )}
          {!wallet.hasWallet && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              No wallet detected. Install{" "}
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                MetaMask
              </a>{" "}
              to register and verify agents.
            </p>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              onClick={() => {
                const el = document.getElementById("agents");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Try the demo
            </Button>
            {wallet.address ? (
              <Button
                size="lg"
                variant="outline"
                onClick={() => setShowRegister(true)}
              >
                <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                Register New Agent
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                onClick={() => wallet.connect()}
                disabled={wallet.connecting || !wallet.hasWallet}
              >
                <Wallet className="h-4 w-4 mr-1" aria-hidden="true" />
                Connect to Register
              </Button>
            )}
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">1. Register</p>
              <p className="text-xs text-muted-foreground mt-1">
                Agent claims a model identity on-chain
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">2. Challenge</p>
              <p className="text-xs text-muted-foreground mt-1">
                Contract generates calibrated fingerprinting prompts
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">3. Verify</p>
              <p className="text-xs text-muted-foreground mt-1">
                GenLayer validators analyze responses via consensus
              </p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">Contract: {CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)}</span>
            <a
              href={`https://studio.genlayer.com/contracts/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              View on Studionet
            </a>
          </div>
        </div>
      </section>

      {/* Agents List */}
      <section id="agents" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Registered Agents</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshAgents}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              <span className="sr-only">Refresh</span>
            </Button>
            <Dialog
              open={showRegister}
              onOpenChange={(open) => {
                setShowRegister(open);
                if (!open) {
                  setModelPreset("");
                  setClaimedModel("");
                  setDescription("");
                }
              }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!wallet.address) {
                    wallet.connect();
                  } else {
                    setShowRegister(true);
                  }
                }}
                disabled={!wallet.hasWallet}
              >
                <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                Register New Agent
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register New Agent</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleRegister} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="claimed-model">Claimed Model</Label>
                    <Select
                      value={modelPreset || null}
                      onValueChange={(value) => {
                        if (value === null) return;
                        setModelPreset(value);
                        setClaimedModel(value === CUSTOM_MODEL ? "" : value);
                      }}
                      disabled={registering}
                    >
                      <SelectTrigger id="claimed-model" aria-label="Claimed Model">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {KNOWN_MODELS.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                        <SelectSeparator />
                        <SelectItem value={CUSTOM_MODEL}>Other (custom)…</SelectItem>
                      </SelectContent>
                    </Select>
                    {modelPreset === CUSTOM_MODEL && (
                      <Input
                        placeholder="e.g., Mistral Large 3"
                        value={claimedModel}
                        onChange={(e) => setClaimedModel(e.target.value)}
                        required
                        maxLength={200}
                        disabled={registering}
                        autoFocus
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Agent Description</Label>
                    <Input
                      id="description"
                      placeholder="e.g., High-reasoning agent for DeFi trading"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      maxLength={500}
                      disabled={registering}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={registering || !claimedModel.trim() || !description.trim()}
                  >
                    {registering ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />
                        Registering on-chain...
                      </>
                    ) : (
                      "Register Agent"
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    MetaMask will prompt you to sign the transaction.
                    Studionet is gasless — no funds needed.
                  </p>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-8 text-center">
            <AlertTriangle
              className="h-8 w-8 mx-auto text-red-500 mb-2"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              Failed to load contract data
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={refreshAgents}>
              <RefreshCw className="h-4 w-4 mr-1" aria-hidden="true" />
              Retry
            </Button>
          </div>
        ) : agentList.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Fingerprint
              className="h-8 w-8 mx-auto text-muted-foreground mb-2"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              No agents registered yet.{" "}
              {wallet.address
                ? "Click \u201CRegister New Agent\u201D to get started."
                : "Connect your wallet to register the first agent."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {agentList.map((agent) => (
              <AgentCard
                key={agent.address}
                agent={agent}
                onClick={() => setSelectedAgent(agent)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Agent Detail Dialog */}
      <Dialog
        open={!!selectedAgent}
        onOpenChange={(open) => !open && setSelectedAgent(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedAgent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="truncate">{selectedAgent.claimed_model}</span>
                  <StatusBadge status={selectedAgent.status} />
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                {/* Agent info */}
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Description: </span>
                    {selectedAgent.description}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {selectedAgent.address}
                  </p>
                  {selectedAgent.address === wallet.address && (
                    <Badge variant="outline" className="text-xs mt-1">
                      Your agent
                    </Badge>
                  )}
                </div>

                <Separator />

                {/* Challenges */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Brain className="h-4 w-4" aria-hidden="true" />
                    Fingerprinting Challenges
                  </h3>
                  {challenges.length === 0 ? (
                    <Skeleton className="h-20 w-full" />
                  ) : (
                    challenges.map((challenge, i) => (
                      <ChallengeResponse
                        key={challenge.id}
                        challenge={challenge}
                        response={selectedAgent.responses[i]}
                        index={i}
                      />
                    ))
                  )}
                </div>

                <Separator />

                {/* Actions — only for the connected user's own agent */}
                {selectedAgent.address === wallet.address ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {selectedAgent.responses.length === 0 && selectedAgent.status === "pending" && (
                      <Button
                        onClick={handleSubmitMockResponses}
                        disabled={submitting}
                        variant="secondary"
                        className="flex-1"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />
                            Submitting...
                          </>
                        ) : (
                          "Submit Mock Responses"
                        )}
                      </Button>
                    )}
                    {selectedAgent.responses.length > 0 &&
                      selectedAgent.status === "pending" && (
                        <Button
                          onClick={handleRunVerification}
                          disabled={verifying}
                          className="flex-1"
                        >
                          {verifying ? (
                            <>
                              <Loader2
                                className="h-4 w-4 mr-1 animate-spin"
                                aria-hidden="true"
                              />
                              GenLayer validators analyzing...
                            </>
                          ) : (
                            "Run Verification"
                          )}
                        </Button>
                      )}
                  </div>
                ) : !wallet.address ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Connect your wallet to register and verify your own agent.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => wallet.connect()}
                      disabled={wallet.connecting || !wallet.hasWallet}
                    >
                      <Wallet className="h-4 w-4 mr-1" aria-hidden="true" />
                      Connect Wallet
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      This agent belongs to another wallet. Register your own
                      agent to submit responses and run verification.
                    </p>
                  </div>
                )}

                {/* Verification Result */}
                {verifying && (
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full" />
                  </div>
                )}
                {!verifying && selectedAgent.verification_result && (
                  <VerdictDisplay result={selectedAgent.verification_result} />
                )}

                {/* Explorer Link */}
                {!verifying && selectedAgent.verification_result && (
                  <a
                    href={`https://studio.genlayer.com/contracts/${CONTRACT_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    View on GenLayer Studionet
                  </a>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Wallet Selection Modal */}
      <WalletModal
        open={wallet.showWalletModal}
        onOpenChange={wallet.setShowWalletModal}
        detectedWallets={wallet.detectedWallets}
        onSelect={(id) => wallet.connect(id)}
        connecting={wallet.connecting}
        connectingWallet={wallet.connectingWallet}
      />
    </div>
  );
}
