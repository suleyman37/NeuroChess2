# Internal Skills Selection Protocol

A16M defines a dry-run selector for NeuroChess internal skills. The selector
maps a mission descriptor to the internal skills that should guide review or
execution planning.

This is dry-run only. It does not activate skills live, run Night Mode, call
ChatGPT, call Gemini, or execute product work.

## Purpose

Internal skill selection should answer:

- Which NeuroChess-owned procedures are relevant?
- Which skills are required versus optional?
- Are any unsafe skill combinations present?
- Should the mission continue, repair the descriptor, or stop?

## Authority

Skills are procedures, not permissions. Selection happens before execution and
below the deterministic gates:

1. Control Plane.
2. Mission Contract.
3. Prompt Firewall.
4. Shadow Plan.
5. Product-Safe Night Mode policy.
6. Red-tier quarantine.
7. Internal skills.

If any safety gate fails, a selected skill cannot override it.

## Inputs

The selector accepts a mission descriptor containing:

- `mission_id`
- `risk_tier`
- `work_type`
- `goal`
- `allowed_paths`
- `forbidden_paths`
- `planned_read_paths`
- `planned_write_paths`
- `lane`
- optional `product_impact_review`
- optional `shadow_plan`
- optional `night_mode_phase`

## Output

The selector returns:

```json
{
  "selection_result": "PASS",
  "selected_skills": [],
  "required_skills": [],
  "optional_skills": [],
  "rejected_skills": [],
  "conflicts": [],
  "authority_reminder": "Skills are procedures, not permissions.",
  "recommended_next_action": "CONTINUE"
}
```

## External Skill Boundary

The selector may only select NeuroChess-owned internal skills under
`.agents/skills/`. External skills and raw quarantined content must never be
selected directly.
