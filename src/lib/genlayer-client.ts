// GenLayer client integration - reads are always available, writes
// require a connected MetaMask wallet. No private keys are stored or
// transmitted; the user signs all transactions through their wallet.

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, ExecutionResult } from "genlayer-js/types";

// Contract address on Studionet (deployed 2026-09-10)
export const CONTRACT_ADDRESS = "0xCF6B87C16fE73F2087B07b6B0aF06BCB4B16e344";

// Read client - no wallet needed, safe for browser
const readClient = createClient({
  chain: studionet,
});

export type AgentStatus = "pending" | "verified" | "flagged" | "inconclusive";

export type VerificationResult = {
  verdict: "match" | "mismatch" | "inconclusive";
  confidence: number;
  reasoning: string;
  suspected_actual_model: string;
};

export type Agent = {
  address: string;
  claimed_model: string;
  description: string;
  status: AgentStatus;
  responses: string[];
  verification_result: VerificationResult | null;
  registered_at: number;
  verified_at: number;
};

export type Challenge = {
  id: string;
  prompt: string;
};

// Parse the verification_result JSON string into an object
function parseVerificationResult(raw: string): VerificationResult | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Normalize the raw contract return into our Agent type
function normalizeAgent(raw: Record<string, unknown>): Agent {
  return {
    address: String(raw.address ?? ""),
    claimed_model: String(raw.claimed_model ?? ""),
    description: String(raw.description ?? ""),
    status: (raw.status as AgentStatus) ?? "pending",
    responses: Array.isArray(raw.responses) ? (raw.responses as string[]) : [],
    verification_result: parseVerificationResult(
      typeof raw.verification_result === "string"
        ? (raw.verification_result as string)
        : "",
    ),
    registered_at: Number(raw.registered_at ?? 0),
    verified_at: Number(raw.verified_at ?? 0),
  };
}

// --- Reads (no wallet needed) ---

export async function getChallenges(): Promise<Challenge[]> {
  const result = await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_challenges",
    args: [],
  });
  return result as Challenge[];
}

export async function getAllAgents(): Promise<Record<string, Agent>> {
  const result = (await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_all_agents",
    args: [],
  })) as Record<string, Record<string, unknown>>;

  const agents: Record<string, Agent> = {};
  for (const [key, raw] of Object.entries(result)) {
    agents[key] = normalizeAgent(raw);
  }
  return agents;
}

export async function getAgent(address: string): Promise<Agent | null> {
  const result = (await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_agent",
    args: [address],
  })) as Record<string, unknown>;

  if (!result || Object.keys(result).length === 0) {
    return null;
  }
  return normalizeAgent(result);
}

export async function getAgentCount(): Promise<number> {
  const result = await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_agent_count",
    args: [],
  });
  return Number(result);
}

// --- Writes (require connected MetaMask wallet) ---

// Create a write client using the user's wallet. The wallet must be
// switched to Studionet before writing - call switchToStudionet first.
function getWriteClient(address: string) {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No wallet found. Install MetaMask to continue.");
  }
  return createClient({
    chain: studionet,
    account: address as `0x${string}`,
    provider: window.ethereum,
  });
}

// Best-effort switch to Studionet. Some wallets (Rainbow) don't support
// wallet_switchEthereumChain. If switching fails, we try the transaction
// anyway - the GenLayer SDK sends to its own RPC endpoint, not the
// wallet's chain RPC, so the wallet's chain may not matter.
async function trySwitchToStudionet(): Promise<void> {
  if (typeof window === "undefined" || !window.ethereum) return;

  const chainId = "0xF22F"; // 61999 in hex
  const chainParams = {
    chainId,
    chainName: "GenLayer Studionet",
    nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
    rpcUrls: ["https://studio.genlayer.com/api"],
    blockExplorerUrls: ["https://studio.genlayer.com"],
  };

  // Already on Studionet?
  try {
    const current = await window.ethereum.request({ method: "eth_chainId" });
    if (current === chainId) return;
  } catch { /* proceed */ }

  // Try addEthereumChain (adds + switches in most wallets)
  try {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [chainParams],
    });
    return;
  } catch { /* fall through */ }

  // Try switchEthereumChain (not all wallets support this)
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch {
    // Both methods failed - don't throw. Let the transaction attempt
    // proceed. If the SDK rejects it for chain mismatch, the error
    // message will tell the user to switch manually.
    console.warn("Could not auto-switch to Studionet. If the transaction fails, manually switch your wallet to GenLayer Studionet (Chain ID 61999).");
  }
}

// Check receipt for errors. txExecutionResultName may be undefined for
// write transactions that don't return a value - that's OK. We only
// fail on explicit FINISHED_WITH_ERROR.
function checkReceipt(
  receipt: { txExecutionResultName?: ExecutionResult },
  label: string,
): void {
  if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
    throw new Error(`${label} failed: ${receipt.txExecutionResultName}`);
  }
}

export async function registerAgent(
  address: string,
  claimedModel: string,
  description: string,
): Promise<{ txHash: string }> {
  await trySwitchToStudionet();
  const writeClient = getWriteClient(address);
  let txHash: string;
  try {
    txHash = (await writeClient.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "register_agent",
      args: [claimedModel, description],
      value: BigInt(0),
    })) as string;
  } catch (err) {
    throw enrichChainError(err, "register");
  }

  const receipt = await readClient.waitForTransactionReceipt({
    hash: txHash as never,
    status: TransactionStatus.ACCEPTED,
  });

  checkReceipt(receipt, "Registration");
  return { txHash };
}

export async function submitResponses(
  address: string,
  responses: string[],
): Promise<{ txHash: string }> {
  await trySwitchToStudionet();
  const writeClient = getWriteClient(address);
  let txHash: string;
  try {
    txHash = (await writeClient.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "submit_responses",
      args: [responses],
      value: BigInt(0),
    })) as string;
  } catch (err) {
    throw enrichChainError(err, "submit responses");
  }

  const receipt = await readClient.waitForTransactionReceipt({
    hash: txHash as never,
    status: TransactionStatus.ACCEPTED,
  });

  checkReceipt(receipt, "Submit responses");
  return { txHash };
}

export async function runVerification(
  address: string,
): Promise<{ txHash: string }> {
  await trySwitchToStudionet();
  const writeClient = getWriteClient(address);
  let txHash: string;
  try {
    txHash = (await writeClient.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "run_verification",
      args: [],
      value: BigInt(0),
    })) as string;
  } catch (err) {
    throw enrichChainError(err, "run verification");
  }

  // Verification takes longer because it runs LLM consensus
  const receipt = await readClient.waitForTransactionReceipt({
    hash: txHash as never,
    status: TransactionStatus.ACCEPTED,
  });

  checkReceipt(receipt, "Verification");
  return { txHash };
}

// If the SDK throws a chain mismatch error, add a helpful message
// telling the user to switch to Studionet manually.
function enrichChainError(err: unknown, action: string): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("chain") || msg.includes("Chain") || msg.includes("network")) {
    return new Error(
      `Could not ${action}: your wallet is on the wrong network. Please manually switch to GenLayer Studionet (Chain ID 61999) in your wallet and try again.`,
    );
  }
  return err instanceof Error ? err : new Error(`Could not ${action}: ${msg}`);
}
