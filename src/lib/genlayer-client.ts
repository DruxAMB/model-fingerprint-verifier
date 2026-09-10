// GenLayer client integration — CLIENT-SAFE reads only.
// Write operations are handled via server-side API routes to keep the
// private key out of the browser bundle. See src/lib/genlayer-server.ts
// and src/app/api/*/route.ts.

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

// Contract address on Studionet (deployed 2026-09-10)
export const CONTRACT_ADDRESS = "0xCF6B87C16fE73F2087B07b6B0aF06BCB4B16e344";

// Read client — no wallet needed, safe for browser
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

// Read contract state
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
