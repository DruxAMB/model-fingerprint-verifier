"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import {
  type Agent,
  type AgentStatus,
  type VerificationResult,
  CHALLENGES,
  SEED_AGENTS,
  MOCK_RESPONSES,
  MOCK_VERIFICATION_RESULT,
} from "@/lib/mock-data";

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
      className="cursor-pointer hover:border-primary/50 transition-colors @media(hover:hover){hover:border-primary/50}"
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
  const [agents, setAgents] = useState<Agent[]>(SEED_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [claimedModel, setClaimedModel] = useState("");
  const [description, setDescription] = useState("");

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimedModel.trim() || !description.trim()) return;

    setRegistering(true);
    // Simulate contract call delay
    setTimeout(() => {
      const newAgent: Agent = {
        address: `0x${Math.random().toString(16).slice(2, 42)}`,
        claimed_model: claimedModel.trim(),
        description: description.trim(),
        status: "pending",
        responses: [],
        verification_result: null,
        registered_at: Math.floor(Date.now() / 1000),
        verified_at: 0,
      };
      setAgents([...agents, newAgent]);
      setClaimedModel("");
      setDescription("");
      setRegistering(false);
      setShowRegister(false);
      toast.success("Agent registered", {
        description: `Claiming to be "${newAgent.claimed_model}"`,
      });
      // Auto-select the new agent
      setSelectedAgent(newAgent);
    }, 800);
  };

  const handleSubmitMockResponses = () => {
    if (!selectedAgent) return;
    const updated = agents.map((a) =>
      a.address === selectedAgent.address
        ? { ...a, responses: MOCK_RESPONSES }
        : a,
    );
    setAgents(updated);
    setSelectedAgent({ ...selectedAgent, responses: MOCK_RESPONSES });
    toast.success("Mock responses submitted", {
      description: "Simulated Gemini 3.6 Flash responses loaded",
    });
  };

  const handleRunVerification = () => {
    if (!selectedAgent) return;
    setVerifying(true);
    // Simulate GenLayer consensus delay
    setTimeout(() => {
      const result = MOCK_VERIFICATION_RESULT;
      const updated = agents.map((a) =>
        a.address === selectedAgent.address
          ? {
              ...a,
              status: "flagged" as AgentStatus,
              verification_result: result,
              verified_at: Math.floor(Date.now() / 1000),
            }
          : a,
      );
      setAgents(updated);
      setSelectedAgent({
        ...selectedAgent,
        status: "flagged",
        verification_result: result,
        verified_at: Math.floor(Date.now() / 1000),
      });
      setVerifying(false);
      toast.error("MISMATCH DETECTED", {
        description: `Agent claiming "${selectedAgent.claimed_model}" is suspected to be "${result.suspected_actual_model}"`,
      });
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="border-b">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex items-center gap-2 mb-4">
            <Fingerprint className="h-6 w-6 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium text-muted-foreground">
              GenLayer Intelligent Contract
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Model Fingerprint Verifier
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl">
            On-chain identity verification for AI agents. GenLayer consensus
            catches agents lying about what model they run.
          </p>
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
            <Button
              size="lg"
              variant="outline"
              onClick={() => setShowRegister(true)}
            >
              <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
              Register New Agent
            </Button>
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
        </div>
      </section>

      {/* Agents List */}
      <section id="agents" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Registered Agents</h2>
          <Dialog open={showRegister} onOpenChange={setShowRegister}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRegister(true)}
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
                  <Input
                    id="claimed-model"
                    placeholder="e.g., GPT-5, Claude 3.5 Sonnet, Gemini 3.6 Flash"
                    value={claimedModel}
                    onChange={(e) => setClaimedModel(e.target.value)}
                    required
                    maxLength={200}
                    disabled={registering}
                  />
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
                      Registering...
                    </>
                  ) : (
                    "Register Agent"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {agents.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Fingerprint
              className="h-8 w-8 mx-auto text-muted-foreground mb-2"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              No agents registered yet. Click "Register New Agent" to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {agents.map((agent) => (
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
                </div>

                <Separator />

                {/* Challenges */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Brain className="h-4 w-4" aria-hidden="true" />
                    Fingerprinting Challenges
                  </h3>
                  {CHALLENGES.map((challenge, i) => (
                    <ChallengeResponse
                      key={challenge.id}
                      challenge={challenge}
                      response={selectedAgent.responses[i]}
                      index={i}
                    />
                  ))}
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  {selectedAgent.responses.length === 0 && (
                    <Button
                      onClick={handleSubmitMockResponses}
                      variant="secondary"
                      className="flex-1"
                    >
                      Submit Mock Responses
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
                    href={`https://explorer-bradbury.genlayer.com/address/${selectedAgent.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    View on GenLayer Explorer
                  </a>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
