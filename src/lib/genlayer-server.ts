// GenLayer server-only module for write operations.
// This file MUST never be imported from a client component.
// It uses the DEMO_PRIVATE_KEY env var (no NEXT_PUBLIC_ prefix) which
// stays server-side only and is never bundled into the browser.

import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, ExecutionResult } from "genlayer-js/types";
import { CONTRACT_ADDRESS } from "./genlayer-client";

// Check receipt for errors. txExecutionResultName may be undefined for
// write transactions that don't return a value — that's OK. We only
// fail on explicit FINISHED_WITH_ERROR.
function checkReceipt(
  receipt: { txExecutionResultName?: ExecutionResult },
  label: string,
): void {
  if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
    throw new Error(`${label} failed: ${receipt.txExecutionResultName}`);
  }
}

const DEMO_PRIVATE_KEY = process.env.DEMO_PRIVATE_KEY || "";

function getWriteClient() {
  if (!DEMO_PRIVATE_KEY) {
    throw new Error("DEMO_PRIVATE_KEY not set");
  }
  const account = createAccount(DEMO_PRIVATE_KEY as `0x${string}`);
  return createClient({
    chain: studionet,
    account,
  });
}

const readClient = createClient({ chain: studionet });

export async function registerAgent(
  claimedModel: string,
  description: string,
): Promise<{ txHash: string }> {
  const writeClient = getWriteClient();
  const txHash = (await writeClient.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "register_agent",
    args: [claimedModel, description],
    value: BigInt(0),
  })) as string;

  const receipt = await readClient.waitForTransactionReceipt({
    hash: txHash as never,
    status: TransactionStatus.ACCEPTED,
  });

  checkReceipt(receipt, "Registration");

  return { txHash };
}

export async function submitResponses(
  responses: string[],
): Promise<{ txHash: string }> {
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

  checkReceipt(receipt, "Submit responses");

  return { txHash };
}

export async function runVerification(): Promise<{ txHash: string }> {
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

  checkReceipt(receipt, "Verification");

  return { txHash };
}
