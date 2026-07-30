# AlertMind — Prompt Engineering Guide

## Structure

Every agent prompt consists of three parts, concatenated in `llm.service.js`:

1. **System prompt** (`src/prompts/system/system.prompt.txt`) — shared across all agents. Defines role, knowledge baseline, and strict prohibitions (no fabricated threat intel, no invented MITRE IDs).
2. **Agent-specific instructions** (`src/prompts/<agent>/<agent>.prompt.txt`) — task definition, domain knowledge, output rules.
3. **Runtime context** — built in each `*.agent.js` file, injecting the actual alert data and prior agent outputs.

## Adding a New Agent

1. Create `src/prompts/<name>/<name>.prompt.txt` with agent-specific instructions
2. Create `src/modules/ai/agents/<name>.agent.js`:
   - Define a Zod output schema
   - Build the prompt (system + instructions + context)
   - Call `llmComplete()` from `llm.service.js`
3. Register the agent in `orchestration.service.js` pipeline sequence
4. Add the agent name to `AGENT_NAME` and `AGENT_MODEL_MAP` in `ai.constants.js`

## Output Schema Enforcement

All agents use Groq's JSON mode (`response_format: { type: 'json_object' }`) combined with Zod schema validation. If output fails validation, `llm.service.js` automatically retries up to `LLM_RETRY_ATTEMPTS` times.

## Model Selection

| Task type | Model | Rationale |
|---|---|---|
| Extraction, classification (deterministic) | Llama 3.1 8B (FAST) | Lower latency, sufficient for structured extraction |
| Reasoning, hypothesis generation, report writing | Llama 3.3 70B (PRIMARY) | Higher quality reasoning needed |

## Anti-Hallucination Measures

- System prompt explicitly prohibits fabricating VT scores, AbuseIPDB ratings, threat actor names
- MITRE mapper validates technique IDs against the `MITRE_TACTICS` reference table
- QA Validator agent runs last, cross-checking IOCs in the report against extracted entities
- Temperature kept low (0.0–0.15) across all agents for determinism

## Prompt Versioning

When modifying a prompt file, increment awareness in commit messages. Prompts are not versioned via API — changes take effect immediately on next deploy. For A/B testing prompt changes, consider a feature flag gate in the agent file before rollout.
