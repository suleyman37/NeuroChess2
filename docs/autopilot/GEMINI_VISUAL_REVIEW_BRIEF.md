# Gemini Visual Review Brief

Each visual audit request must include a brief with:

- `surface`
- `state`
- `desktop_target`
- `product_intent`
- `must_be_true`
- `must_not_happen`
- `north_star_question`
- `expected_visual_verdict`
- `screenshot_paths`

Safe smoke briefs verify transport and OCR-like visual readback only. They use
synthetic images and must not describe real product UI.

Unsafe canary briefs verify that Gemini detects false UI claims such as
`Practice ready`, fake XP, fake rank, fake Transfer, unsafe `Train now` CTAs,
or mobile-first cramped layout drift.

Visual Review Briefs are evidence inputs. They do not grant permission to
execute, merge, or modify product code.
