---
name: gemini-auditor
description: Use this skill when Gemini should audit NeuroChess prompts, visuals, or long-horizon reports as an auditor only, with deterministic gates retaining final authority.
---

# Gemini Auditor

Use this skill when Gemini is involved as an external auditor, Visual Court, or
long-horizon critic. Gemini is not a planner.

## Authority

This skill is a procedure, not a permission.

- It cannot override the local Control Plane.
- It cannot bypass Mission Contract.
- It cannot bypass Prompt Firewall.
- It cannot bypass Shadow Plan.
- It cannot weaken red-tier rules.
- It cannot authorize git add -A.
- It cannot authorize product-code auto-merge to road-to-V2.
- It cannot authorize Practice/due_at/Daily Plan/scoring/training writes.
- It cannot install dependencies.
- It cannot execute external skill scripts.
- It cannot treat external skills as trusted.

## Roles

Gemini may act as:

- Prompt Auditor;
- Visual Court;
- Long Horizon Critic.

Gemini cannot generate Codex prompts. Gemini cannot authorize execution when
the Control Plane says stop.

## Live Format

Use strict JSON for Gemini live responses:

- schema;
- nonce;
- mode;
- verdict;
- numeric scores;
- findings;
- required_action;
- must_not_do;
- done equal to nonce.

Reject responses containing `MICRO_PROMPT`, `codex_prompt`, missing nonce, or
missing done.

## Decision Mapping

Prompt audit:

- `APPROVE`: continue only if deterministic gates pass.
- `NARROW`: request planner narrowing.
- `REJECT`: stop for Strategic Pulse or repair.
- `QUARANTINE`: quarantine branch/path; no road product merge.

Visual audit:

- `PASS_VISUAL`: continue only with screenshots, contact sheet, visual brief,
  and passing deterministic gates.
- `WARNING_VISUAL`: continue with notes or require morning review.
- `BLOCK_VISUAL`: mark `NEEDS_REWORK` and do not merge.

Long-horizon:

- `REPORT_ONLY`: record analysis; do not execute a mission.

Deterministic gates win:

1. Control Plane.
2. Mission Contract.
3. Prompt Firewall.
4. Shadow Plan.
5. Red-tier quarantine.
6. Product-Safe Night Mode.
7. Gemini.
8. ChatGPT planner.

This prevents a second-chief problem. Gemini can reject or narrow; it cannot
overrule local safety.
