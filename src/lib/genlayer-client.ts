// GenLayer client integration for the Model Fingerprint Verifier contract.
// Uses genlayer-js SDK to read from and write to the deployed contract.

import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, ExecutionResult } from "genlayer-js/types";

// Contract address on Studionet (deployed 2026-09-09)
export const CONTRACT_ADDRESS = "0x3cdB5193E6A9Fedd4acB9007d5ba079b4dcECFBb";

// Deployer account — used for write transactions in the demo.
// On Studionet (gasless), no funds are needed.
// In production, this would use a browser wallet (MetaMask) instead.
const DEMO_PRIVATE_KEY = process.env.NEXT_PUBLIC_DEMO_PRIVATE_KEY || "";

// Read client — no wallet needed
const readClient = createClient({
  chain: studionet,
});

// Write client — uses the deployer account for demo transactions
function getWriteClient() {
  if (!DEMO_PRIVATE_KEY) {
    throw new Error("NEXT_PUBLIC_DEMO_PRIVATE_KEY not set");
  }
  const account = createAccount(DEMO_PRIVATE_KEY as `0x${string}`);
  return createClient({
    chain: studionet,
    account,
  });
}

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

// Read contract state
export async function getChallenges(): Promise<Challenge[]> {
  try {
    const result = await readClient.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_challenges",
      args: [],
    });
    return result as Challenge[];
  } catch (error) {
    console.error("Failed to fetch challenges:", error);
    throw error;
  }
}

export async function getAllAgents(): Promise<Record<string, Agent>> {
  try {
    const result = await readClient.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_all_agents",
      args: [],
    });
    return result as Record<string, Agent>;
  } catch (error) {
    console.error("Failed to fetch agents:", error);
    throw error;
  }
}

export async function getAgent(address: string): Promise<Agent | null> {
  try {
    const result = await readClient.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_agent",
      args: [address],
    });
    if (!result || Object.keys(result as object).length === 0) {
      return null;
    }
    return result as Agent;
  } catch (error) {
    console.error("Failed to fetch agent:", error);
    throw error;
  }
}

export async function getAgentCount(): Promise<number> {
  try {
    const result = await readClient.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_agent_count",
      args: [],
    });
    return Number(result);
  } catch (error) {
    console.error("Failed to fetch agent count:", error);
    throw error;
  }
}

// Write contract state (requires demo account)
export async function registerAgent(
  claimedModel: string,
  description: string,
): Promise<string> {
  const writeClient = getWriteClient();
  const txHash = (await writeClient.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "register_agent",
    args: [claimedModel, description],
    value: BigInt(0),
  })) as string;

  // Wait for the transaction to be accepted
  const receipt = await readClient.waitForTransactionReceipt({
    hash: txHash as never,
    status: TransactionStatus.ACCEPTED,
  });

  if (receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    throw new Error(`Registration failed: ${receipt.txExecutionResultName}`);
  }

  return txHash;
}

export async function submitResponses(responses: string[]): Promise<string> {
  const writeClient = getWriteClient();
  const txHash = (await writeClient.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "submit_responses",
    args: [responses],
    value: BigInt(0),
  })) as string;

  const receipt = await readClient.waitForTransactionReceipt({
    hash: txHash as never,
    status: TransactionStatus.ACCEPTED,
  });

  if (receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    throw new Error(`Submit responses failed: ${receipt.txExecutionResultName}`);
  }

  return txHash;
}

export async function runVerification(): Promise<string> {
  const writeClient = getWriteClient();
  const txHash = (await writeClient.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "run_verification",
    args: [],
    value: BigInt(0),
  })) as string;

  // Verification takes longer because it runs LLM consensus
  const receipt = await readClient.waitForTransactionReceipt({
    hash: txHash as never,
    status: TransactionStatus.ACCEPTED,
  });

  if (receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    throw new Error(`Verification failed: ${receipt.txExecutionResultName}`);
  }

  return txHash;
}

export { readClient };
