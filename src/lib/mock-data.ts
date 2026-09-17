// Mock data for local development.
// Will be replaced by GenLayer contract calls when deployed.

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

export const CHALLENGES: Challenge[] = [
  {
    id: "identity",
    prompt: "What is your name and what model are you? Answer in exactly one sentence.",
  },
  {
    id: "formatting",
    prompt: "List 3 benefits of exercise. Use your preferred formatting style.",
  },
  {
    id: "reasoning",
    prompt:
      "If a train travels 60 mph for 2.5 hours, then 80 mph for 1.5 hours, what's the total distance? Show your work briefly.",
  },
];

// Pre-seeded agents so the landing page never looks empty
export const SEED_AGENTS: Agent[] = [
  {
    address: "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12",
    claimed_model: "Gemini 3.6 Flash",
    description: "High-speed reasoning agent for DeFi arbitrage detection.",
    status: "verified",
    responses: [
      "My name is Gemini, and I am the Gemini 3.6 Flash model.",
      "Here are 3 benefits of exercise:\n\n1. **Improved cardiovascular health** - Regular exercise strengthens the heart.\n2. **Enhanced mental well-being** - Physical activity releases endorphins.\n3. **Better sleep quality** - Exercise regulates your circadian rhythm.",
      "To find the total distance, use the formula **Distance = Speed × Time**:\n\n1. **First leg:** 60 mph × 2.5 hours = 150 miles\n2. **Second leg:** 80 mph × 1.5 hours = 120 miles\n\n**Total Distance:** 150 + 120 = **270 miles**",
    ],
    verification_result: {
      verdict: "match",
      confidence: 95,
      reasoning:
        "The agent self-identifies as Gemini 3.6 Flash, and the response style matches known Gemini formatting patterns.",
      suspected_actual_model: "Gemini 3.6 Flash",
    },
    registered_at: 1725408000,
    verified_at: 1725408600,
  },
  {
    address: "0x2b3c4d5e6f7890abcdef1234567890abcdef1234",
    claimed_model: "GPT-5",
    description: "Advanced reasoning agent for autonomous trading decisions.",
    status: "flagged",
    responses: [
      "My name is Gemini, and I am the Gemini 3.6 Flash model.",
      "Here are 3 benefits of exercise:\n\n1. **Improved cardiovascular health** - Regular exercise strengthens the heart.\n2. **Enhanced mental well-being** - Physical activity releases endorphins.\n3. **Better sleep quality** - Exercise regulates your circadian rhythm.",
      "To find the total distance, use the formula **Distance = Speed × Time**:\n\n1. **First leg:** 60 mph × 2.5 hours = 150 miles\n2. **Second leg:** 80 mph × 1.5 hours = 120 miles\n\n**Total Distance:** 150 + 120 = **270 miles**",
    ],
    verification_result: {
      verdict: "mismatch",
      confidence: 98,
      reasoning:
        "The agent claims to be GPT-5 but self-identifies as 'Gemini 3.6 Flash' in the identity challenge. The formatting style matches Gemini, not GPT-5.",
      suspected_actual_model: "Gemini 3.6 Flash",
    },
    registered_at: 1725494400,
    verified_at: 1725495000,
  },
];

// Mock responses for the "Submit Mock Responses" button
// These simulate a Gemini model pretending to be GPT-5
export const MOCK_RESPONSES = [
  "My name is Gemini, and I am the Gemini 3.6 Flash model.",
  "Here are 3 benefits of exercise:\n\n1. **Improved cardiovascular health** - Regular exercise strengthens the heart.\n2. **Enhanced mental well-being** - Physical activity releases endorphins.\n3. **Better sleep quality** - Exercise regulates your circadian rhythm.",
  "To find the total distance, use the formula **Distance = Speed × Time**:\n\n1. **First leg:** 60 mph × 2.5 hours = 150 miles\n2. **Second leg:** 80 mph × 1.5 hours = 120 miles\n\n**Total Distance:** 150 + 120 = **270 miles**",
];

// Mock verification result for the "Run Verification" button
export const MOCK_VERIFICATION_RESULT: VerificationResult = {
  verdict: "mismatch",
  confidence: 98,
  reasoning:
    "The agent claims to be GPT-5 but self-identifies as 'Gemini 3.6 Flash' in the identity challenge. The formatting style matches Gemini, not GPT-5.",
  suspected_actual_model: "Gemini 3.6 Flash",
};
