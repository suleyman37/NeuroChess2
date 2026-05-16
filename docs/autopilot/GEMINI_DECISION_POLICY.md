# Gemini Decision Policy

Gemini is useful because it is outside the ChatGPT Planner and Codex Executor loop. That independence helps detect self-validation, vague prompts, unsafe UI claims, and product drift.

Gemini is not a second chief. The priority order is:

1. Control Plane hard stops.
2. Mission Contract.
3. Prompt Firewall.
4. Shadow Plan.
5. Red-tier quarantine policy.
6. Night Mode scope policy.
7. Gemini audit decision.
8. ChatGPT Planner recommendation.

Decision mapping:

- APPROVE maps to CONTINUE only when deterministic gates pass.
- NARROW maps to REQUEST_PLANNER_NARROWING.
- REJECT maps to STOP_FOR_STRATEGIC_PULSE.
- QUARANTINE maps to QUARANTINE_REQUIRED.
- PASS_VISUAL maps to CONTINUE only when deterministic gates pass.
- WARNING_VISUAL maps to REQUEST_PLANNER_NARROWING.
- BLOCK_VISUAL maps to BLOCK_VISUAL_REWORK.
- REPORT_ONLY maps to RECORD_LONG_HORIZON_REPORT.

If deterministic gates fail, stop regardless of Gemini approval. If Gemini rejects or blocks, do not execute the original prompt.

The decision policy is response-format neutral. JSON is preferred for live Gemini because it survives Gemini Web formatting better than nested XML, but JSON approval still cannot bypass deterministic gates.

A16I implements this as a dry-run resolver. `APPROVE` can become `CONTINUE`
only when Control Plane, Mission Contract, Prompt Firewall, Shadow Plan,
red-tier policy, and Night Mode scope all pass. Any failed deterministic gate
returns `STOP_DETERMINISTIC_GATE`.
