# Gemini Auditor Protocol

Gemini is added as an external auditor, not as a planner. Its job is to give independent criticism of risky prompts, visual changes, and long-run reports so ChatGPT and Codex do not self-validate each other.

Role separation:

- ChatGPT is the Planner and Supervisor.
- Gemini is the Auditor, Red Team, and Visual Court.
- Codex is the Executor.
- Control Plane scripts remain the final deterministic authority.

Gemini cannot override Mission Contract, Prompt Firewall, Shadow Plan, Product-Safe Night Mode scope, Control Plane stops, or red-tier quarantine. If a deterministic gate fails, execution stops even if Gemini says APPROVE.

A16G only defines the protocol, schemas, prompts, fixtures, and local validators. It does not call Gemini live, automate Gemini login, or enable live Gemini enforcement.

Gemini modes:

- Prompt Auditor: audits a proposed MICRO_PROMPT or NC-MP/2 before execution.
- Visual Court: judges screenshots, contact sheets, and visual briefs for frontend-readonly branches.
- Long-Horizon Critic: reviews run reports, prompt ledger summaries, failure trends, and product-vs-infra drift after longer sessions.

Live Gemini responses now use JSON as the primary format because Gemini Web may flatten nested XML tags. The legacy nonce-bound `NC_GEMINI_AUDIT` XML block remains supported for old fixtures and offline protocol tests, but live smoke requests should ask for one JSON object with `schema: "NC_GEMINI_AUDIT_JSON/1"`, matching `nonce`, and `done` equal to the nonce.

Gemini responses must not contain `MICRO_PROMPT`, `codex_prompt`, or executable implementation instructions.
