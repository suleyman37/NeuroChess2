# Internal Skills Conflict Policy

Skill selection fails closed when a mission descriptor implies unsafe authority,
unsafe scope, or conflicting lanes.

## Rejected Combinations

Reject selection when:

- an external skill is selected directly;
- a skill is used to authorize forbidden scope;
- frontend and backend work are mixed without explicit fullstack sandbox policy;
- a product code mission lacks Mission Contract and Shadow Plan coverage;
- backend-readonly work lacks `backend-readonly-proof`;
- frontend UI work lacks `frontend-visual-review`;
- Night Mode lacks `product-safe-night-mode`;
- Gemini audit work lacks `gemini-auditor`;
- Gemini is treated as planner or Codex prompt generator;
- mobile-first is selected as the primary design target;
- red-tier terms appear without quarantine authorization.

## Red-Tier Limits

Sensitive terms include:

- Practice;
- due_at;
- Daily Plan;
- training_items;
- practice_attempts;
- scoring;
- XP;
- rank;
- Transfer.

Normal missions containing those terms must be rejected. A red/quarantine
mission still requires Control Plane quarantine approval before any future
execution.

## Desktop-First Design

NeuroChess design selection rejects mobile-first as the primary target.
Desktop/PC board-centered review is the default product posture.

## Deterministic Gates

No selected skill can override Control Plane, Mission Contract, Prompt Firewall,
Shadow Plan, Product-Safe Night Mode policy, or red-tier quarantine.
