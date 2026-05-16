# Gemini Auditor Authority Limits

Gemini is not a planner and not a second chief. It audits, narrows, rejects,
quarantines, judges visual evidence, or writes report-only criticism.

Gemini cannot:

- generate Codex prompts;
- bypass deterministic gates;
- approve red-tier work outside quarantine;
- approve product-code auto-merge to `road-to-V2`;
- override Mission Contract mismatch;
- override Prompt Firewall rejection;
- override Shadow Plan mismatch;
- override Product-Safe Night Mode policy;
- override Control Plane stop conditions.

Priority order:

1. Control Plane hard stops.
2. Mission Contract.
3. Prompt Firewall.
4. Shadow Plan.
5. Red-tier and quarantine policy.
6. Product-Safe Night Mode scope policy.
7. Gemini audit decision.
8. ChatGPT Planner recommendation.

If Gemini says `APPROVE` while a deterministic gate fails, the local action is
`STOP_DETERMINISTIC_GATE`.
