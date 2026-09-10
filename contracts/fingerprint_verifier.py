# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from dataclasses import dataclass
import json


@allow_storage
@dataclass
class Agent:
    address: Address
    claimed_model: str
    description: str
    status: str  # "pending", "verified", "flagged", "inconclusive"
    responses_json: str  # JSON-encoded list of response strings
    verification_result: str  # JSON string with verdict, confidence, reasoning
    registered_at: u256
    verified_at: u256


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
        self.agent_count = u256(0)

    @gl.public.write
    def register_agent(self, claimed_model: str, description: str) -> None:
        sender = gl.message.sender_address

        if sender in self.agents:
            raise Exception("[EXPECTED] Agent already registered")

        if not claimed_model or len(claimed_model) > 200:
            raise Exception("[EXPECTED] claimed_model must be 1-200 characters")

        if not description or len(description) > 500:
            raise Exception("[EXPECTED] description must be 1-500 characters")

        agent = Agent(
            address=sender,
            claimed_model=claimed_model,
            description=description,
            status="pending",
            responses_json="[]",
            verification_result="",
            registered_at=u256(0),
            verified_at=u256(0),
        )
        self.agents[sender] = agent
        self.agent_count += u256(1)

    @gl.public.write
    def submit_responses(self, responses: list) -> None:
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

        agent.responses_json = json.dumps(responses)

    @gl.public.write
    def run_verification(self) -> None:
        sender = gl.message.sender_address

        if sender not in self.agents:
            raise Exception("[EXPECTED] Agent not registered")

        agent = self.agents[sender]

        if agent.status != "pending":
            raise Exception("[EXPECTED] Agent already verified or flagged")

        responses = json.loads(agent.responses_json)
        if not responses:
            raise Exception("[EXPECTED] No responses submitted")

        def leader_fn():
            prompt = self._make_analysis_prompt(agent.claimed_model, responses)
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            return result

        principle = "Equal if same verdict and confidence within 1500 bps."

        try:
            result = gl.eq_principle.prompt_comparative(leader_fn, principle)
            if isinstance(result, dict):
                verdict = result.get("verdict", "inconclusive")
                confidence = result.get("confidence", 0)
                reasoning = result.get("reasoning", "")
                suspected = result.get("suspected_actual_model", "unknown")
            else:
                parsed = json.loads(result)
                verdict = parsed.get("verdict", "inconclusive")
                confidence = parsed.get("confidence", 0)
                reasoning = parsed.get("reasoning", "")
                suspected = parsed.get("suspected_actual_model", "unknown")
        except Exception as e:
            raise Exception(f"[EXTERNAL] Verification failed: {e}")

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
        agent.verified_at = u256(0)

    def _make_analysis_prompt(self, claimed_model: str, responses: list) -> str:
        challenge_text = ""
        for i, c in enumerate(CHALLENGES):
            response = responses[i] if i < len(responses) else "[no response]"
            challenge_text += f"\n\nChallenge {i+1} ({c['id']}):\nPrompt: {c['prompt']}\nResponse: {response}"

        return f"""You are a model fingerprint analyst. An agent claims to be "{claimed_model}".

The agent was given {len(CHALLENGES)} challenge prompts and responded to each.{challenge_text}

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

    @gl.public.view
    def get_agent(self, address: str) -> dict:
        addr = Address(address)
        if addr not in self.agents:
            return {}
        agent = self.agents[addr]
        return {
            "address": agent.address.as_hex,
            "claimed_model": agent.claimed_model,
            "description": agent.description,
            "status": agent.status,
            "responses": json.loads(agent.responses_json) if agent.responses_json else [],
            "verification_result": agent.verification_result,
            "registered_at": int(agent.registered_at),
            "verified_at": int(agent.verified_at),
        }

    @gl.public.view
    def get_all_agents(self) -> dict:
        result = {}
        for k, v in self.agents.items():
            result[k.as_hex] = {
                "address": v.address.as_hex,
                "claimed_model": v.claimed_model,
                "description": v.description,
                "status": v.status,
                "responses": json.loads(v.responses_json) if v.responses_json else [],
                "verification_result": v.verification_result,
                "registered_at": int(v.registered_at),
                "verified_at": int(v.verified_at),
            }
        return result

    @gl.public.view
    def get_challenges(self) -> list:
        return [{"id": c["id"], "prompt": c["prompt"]} for c in CHALLENGES]

    @gl.public.view
    def get_agent_count(self) -> int:
        return int(self.agent_count)
