# Gemini Long-Horizon Critic

Long-Horizon Critic reviews completed run evidence after longer sessions. It is for morning review and trend analysis, not live execution.

Inputs can include:

- mission_log.jsonl
- prompt ledger summary
- failure genome
- Strategic Pulse decisions
- Night Mode report
- branches and commits summary
- screenshots or contact sheets when available

Output verdict is REPORT_ONLY. Gemini may identify trends, recurring risks, weak prompt styles, product-vs-infra drift, and one strategic adjustment. It must not emit a MICRO_PROMPT, codex_prompt, or executable work item.

The Control Plane records the report and decides whether a future mission should be planned.
