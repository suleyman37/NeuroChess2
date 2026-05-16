# Gemini Decision Policy

Gemini is useful because it is outside the ChatGPT Planner and Codex Executor loop. That independence helps detect self-validation, vague prompts, unsafe UI claims, and product drift.

Gemini is not a second chief. The priority order is:

1. Mission Contract, Prompt Firewall, Shadow Plan, Control Plane.
2. Red-tier quarantine policy.
3. Night Mode scope policy.
4. Gemini audit decision.
5. ChatGPT Planner recommendation.

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
