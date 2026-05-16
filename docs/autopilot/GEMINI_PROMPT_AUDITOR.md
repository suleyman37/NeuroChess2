# Gemini Prompt Auditor

Prompt Auditor is required for risky or ambiguous planner output, repeated prompt repairs, red/amber signals, product-safe Night Mode anomalies, and any prompt that looks broad enough to cause scope creep.

Inputs should be minimal:

- Supervisor Digest
- proposed MICRO_PROMPT or NC-MP/2
- Mission Contract draft when available
- Product-Safe Night Mode policy
- dangerous zones
- active constraints

Verdicts:

- APPROVE: continue only if deterministic gates pass.
- NARROW: ask the ChatGPT Planner to reduce scope or split; do not execute the original prompt.
- REJECT: stop or force Strategic Pulse.
- QUARANTINE: route to quarantine policy; no road-to-V2 product merge.

Gemini may identify missing constraints, unsafe scope, fake product value, or automation drift. Gemini must not write a final Codex prompt and must not provide implementation instructions.
