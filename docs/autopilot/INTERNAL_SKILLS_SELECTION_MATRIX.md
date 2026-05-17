# Internal Skills Selection Matrix

This matrix defines the expected dry-run selection for common mission types.

| Mission signal | Required internal skills |
|---|---|
| Product-facing or product-enabling mission | `neurochess-product-north-star` |
| Any mission that modifies files | `mission-contract-shadow-plan` |
| Backend path or `backend-readonly-only` | `backend-readonly-proof`, `mission-contract-shadow-plan` |
| Backend tests involved | `neurochess-tdd-behavior-contract` |
| Frontend path or `frontend-readonly-only` | `frontend-visual-review`, `neurochess-desktop-game-like-interface-design`, `neurochess-react-performance-review`, `mission-contract-shadow-plan`, `neurochess-product-north-star` |
| Screenshots/contact sheet/visual brief required | `frontend-visual-review`, `neurochess-desktop-game-like-interface-design` |
| Gemini Visual Court enabled or requested | `gemini-auditor` |
| Gemini prompt audit or long-horizon critic | `gemini-auditor` |
| Night Mode or live pilot | `product-safe-night-mode`, `mission-contract-shadow-plan`, `neurochess-product-north-star` |
| Night Mode final, drain, report, or summary | `morning-intelligence-report` |
| UI/design/visual/interface/desktop/game-like/board/CTA goal | `neurochess-desktop-game-like-interface-design` |
| Morning report or run summary | `morning-intelligence-report` |

## Optional Skills

The selector may mark a skill optional when it is useful but not required for
the mission's lane. Optional skills remain procedures, not permissions.

## Product Skills

`neurochess-product-north-star` should be present for missions that create,
review, unblock, test, or report product value. It is not required for purely
mechanical automation scaffolding unless the scaffold affects Night Mode,
product selection, or product safety.
