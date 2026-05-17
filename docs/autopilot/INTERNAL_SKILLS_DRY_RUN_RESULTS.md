# Internal Skills Dry-Run Results

A16M dry-run scenarios prove that mission descriptors map to the expected
NeuroChess internal skills without activating skills live.

## Scenarios

| Fixture | Expected result |
|---|---|
| `skill_selection_docs_contract.json` | product North Star plus Mission Contract/Shadow Plan |
| `skill_selection_backend_readonly.json` | backend read-only proof, TDD behavior, contract/shadow plan |
| `skill_selection_frontend_desktop_ui.json` | frontend visual review, desktop game-like design, React performance |
| `skill_selection_frontend_visual_review.json` | frontend visual review; Gemini only when Visual Court is configured |
| `skill_selection_night_mode.json` | product-safe Night Mode, contract/shadow plan, North Star, morning report |
| `skill_selection_gemini_audit.json` | Gemini auditor, with Gemini-as-planner rejected |
| `skill_selection_morning_report.json` | morning intelligence report |
| `skill_selection_red_tier_rejected.json` | FAIL because red-tier terms appear without quarantine |
| `skill_selection_conflicting_backend_frontend.json` | FAIL because frontend/backend are mixed without fullstack sandbox policy |

## Pass Conditions

- selected skills exist on disk;
- each selected skill has `SKILL.md`, `name`, and `description`;
- no selected skill comes from external quarantine;
- authority rules remain intact;
- no live ChatGPT or Gemini call occurs;
- no product mission executes.

## Current Status

The dry-run remains disabled for live enforcement until a future Control Plane
integration mission.
