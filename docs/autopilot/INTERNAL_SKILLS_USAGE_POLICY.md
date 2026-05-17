# Internal Skills Usage Policy

Internal NeuroChess skills provide reusable procedures for Codex and future
automation. They are not new authority layers and they do not loosen existing
safety gates.

## Why Internal Skills Exist

The pack exists to:

- reduce repeated prompt bulk;
- make mission review more deterministic;
- preserve safe lessons from audited external skills;
- keep NeuroChess-specific product and desktop UX rules close to execution.

## How To Reference Skills

Future prompts may reference a skill by name when the mission needs that
procedure. Examples:

- use `mission-contract-shadow-plan` before executing a bounded mission;
- use `backend-readonly-proof` for backend read-only tests;
- use `frontend-visual-review` for screenshot-backed UI review;
- use `neurochess-product-north-star` for product-value gating;
- use `neurochess-testing-visual-proof` for browser smoke evidence and contact
  sheets;
- use `neurochess-security-repo-hygiene` for Git, script, local config,
  external skill, package, or CI safety checks;
- use `neurochess-product-ux-critic` for product friction, first 30 seconds
  clarity, and desktop UX critique;
- use `neurochess-learning-loop-accelerator` when work should advance active
  chess improvement.

Referencing a skill does not authorize work outside the current mission
contract.

## External Skill Boundary

External skills are not active. External patterns may influence internal skills
only after quarantine, audit, classification, extraction, and rewrite into
NeuroChess-owned procedures.

Do not copy external skills directly into `.agents/skills/`. Do not run external
skill scripts. Do not install external skill dependencies.

## Night Mode

Night Mode may later use internal skills to reduce prompt bulk and improve
review quality. A16L2 still does not enable live Night Mode skill activation.
Future Night Mode selection can use testing visual proof for frontend branches,
security repo hygiene for every run, product UX critique for mission choice, and
learning-loop acceleration for player-facing work. The local Control Plane,
Mission Contract, Prompt Firewall, Shadow Plan, Product-Safe Night Mode policy,
and red-tier quarantine remain ahead of skills.
