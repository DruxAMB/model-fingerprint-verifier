# { "Depends": "py-genlayer:test" }

import json
from dataclasses import dataclass
from genlayer import *


@allow_storage
@dataclass
class Agent:
    address: str
    claimed_model: str
    description: str
    status: str  # "pending", "verified", "flagged", "inconclusive"
    responses: list  # list of response strings, one per challenge
    verification_result: str  # JSON string with verdict, confidence, reasoning
    registered_at: int
    verified_at: int


CHALLENGES = [
    {
        "id": "identity",
        "prompt": "What is your name and what model are you? Answer in exactly one sentence.",
    },
    {
        "id": "formatting",
        "prompt": "List 3 benefits of exercise. Use your preferred formatting style.",
    },
    {
        "id": "reasoning",
        "prompt": "If a train travels 60 mph for 2.5 hours, then 80 mph for 1.5 hours, what's the total distance? Show your work briefly.",
    },
]


class FingerprintVerifier(gl.Contract):
    agents: TreeMap[Address, Agent]
    agent_count: u256

    def __init__(self):
        self.agent_count = 0

    def _get_challenges(self) -> list:
        """Return the pre-defined challenge prompts."""
        return [{"id": c["id"], "prompt": c["prompt"]} for c in CHALLENGES]

    def _make_analysis_prompt(self, claimed_model: str, responses: list) -> str:
        """Build the prompt for the validator LLM to analyze responses."""
        challenges = self._get_challenges()
        challenge_text = ""
        for i, c in enumerate(challenges):
            response = responses[i] if i < len(responses) else "[no response]"
            challenge_text += f"\n\nChallenge {i+1} ({c['id']}):\nPrompt: {c['prompt']}\nResponse: {response}"

        return f"""You are a model fingerprint analyst. An agent claims to be "{claimed_model}".

The agent was given {len(challenges)} challenge prompts and responded to each.{challenge_text}

Analyze these responses collectively and determine whether they are consistent with the claimed model "{claimed_model}".

Consider:
1. Does the self-identification (if any) match {claimed_model}?
2. Does the response style match what {claimed_model} would produce?
3. Are there any tells that suggest a different model?

Respond as JSON:
{{
    "verdict": "match" | "mismatch" | "inconclusive",
    "confidence": 0-100,
    "reasoning": "one sentence explanation",
    "suspected_actual_model": "your best guess or 'unknown'"
}}"""

    @gl.public.write
    def register_agent(self, claimed_model: str, description: str) -> None:
        """Register a new agent with a model claim."""
        sender = gl.message.sender_address

        if sender in self.agents:
            raise Exception("[EXPECTED] Agent already registered")

        if not claimed_model or len(claimed_model) > 200:
            raise Exception("[EXPECTED] claimed_model must be 1-200 characters")

        if not description or len(description) > 500:
            raise Exception("[EXPECTED] description must be 1-500 characters")

        agent = Agent(
            address=sender.as_hex,
            claimed_model=claimed_model,
            description=description,
            status="pending",
            responses=[],
            verification_result="",
            registered_at=0,
            verified_at=0,
        )
        self.agents[sender] = agent
        self.agent_count += 1

    @gl.public.write
    def submit_responses(self, responses: list) -> None:
        """Submit responses to the challenge prompts."""
        sender = gl.message.sender_address

        if sender not in self.agents:
            raise Exception("[EXPECTED] Agent not registered")

        agent = self.agents[sender]

        if agent.status != "pending":
            raise Exception("[EXPECTED] Agent already verified or flagged")

        if not responses or len(responses) != len(CHALLENGES):
            raise Exception(
                f"[EXPECTED] Expected {len(CHALLENGES)} responses, got {len(responses) if responses else 0}"
            )

        agent.responses = responses

    @gl.public.write
    def run_verification(self) -> None:
        """Run GenLayer consensus to verify the agent's model identity."""
        sender = gl.message.sender_address

        if sender not in self.agents:
            raise Exception("[EXPECTED] Agent not registered")

        agent = self.agents[sender]

        if agent.status != "pending":
            raise Exception("[EXPECTED] Agent already verified or flagged")

        if not agent.responses:
            raise Exception("[EXPECTED] No responses submitted")

        def leader_fn():
            prompt = self._make_analysis_prompt(agent.claimed_model, agent.responses)
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            # Normalize to stable JSON string
            parsed = json.loads(result)
            return json.dumps(parsed, sort_keys=True)

        # Use prompt_comparative for semantic equivalence
        # Validators agree if they reach the same verdict
        equivalence_rule = "Equal if same verdict and confidence within 1500 bps."

        try:
            result_str = gl.eq_principle.prompt_comparative(leader_fn, equivalence_rule)
            result = json.loads(result_str)
        except Exception as e:
            raise Exception(f"[EXTERNAL] Verification failed: {e}")

        verdict = result.get("verdict", "inconclusive")
        confidence = result.get("confidence", 0)
        reasoning = result.get("reasoning", "")
        suspected = result.get("suspected_actual_model", "unknown")

        # Update agent status based on verdict
        if verdict == "match":
            agent.status = "verified"
        elif verdict == "mismatch":
            agent.status = "flagged"
        else:
            agent.status = "inconclusive"

        agent.verification_result = json.dumps(
            {
                "verdict": verdict,
                "confidence": confidence,
                "reasoning": reasoning,
                "suspected_actual_model": suspected,
            }
        )
        agent.verified_at = 0

    @gl.public.view
    def get_agent(self, address: str) -> dict:
        """Get agent details by address."""
        addr = Address(address)
        if addr not in self.agents:
            return {}
        agent = self.agents[addr]
        return {
            "address": agent.address,
            "claimed_model": agent.claimed_model,
            "description": agent.description,
            "status": agent.status,
            "responses": agent.responses,
            "verification_result": agent.verification_result,
            "registered_at": agent.registered_at,
            "verified_at": agent.verified_at,
        }

    @gl.public.view
    def get_all_agents(self) -> dict:
        """Get all registered agents."""
        return {k.as_hex: v for k, v in self.agents.items()}

    @gl.public.view
    def get_challenges(self) -> list:
        """Return the challenge prompts."""
        return self._get_challenges()

    @gl.public.view
    def get_agent_count(self) -> int:
        """Return the total number of registered agents."""
        return self.agent_count
