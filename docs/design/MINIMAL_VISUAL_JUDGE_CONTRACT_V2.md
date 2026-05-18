# Minimal Visual Judge Contract V2

This contract is the A20X recovery format for live visual judges. It replaces
fragile score-heavy outputs with enum-first visual judgment that is easier for
Gemini and ChatGPT to satisfy without weakening validation.

The contract applies only to visual judge outputs. Transport wrappers may still
carry nonce or safety fields, but the judge output itself must not contain
aggregate numeric scores, percentages, or 0-100 ratings.

## Required JSON

```json
{
  "contract_version": "minimal_visual_judge_v2",
  "judge": "gemini_visual_perceiver",
  "evidence_seen": true,
  "evidence_files": [
    "generation_1_patch/contact_sheet_generation_1_states.png"
  ],
  "screenshot_references": [
    "contact_sheet_generation_1_states: observe board and phase rail"
  ],
  "hard_gate_observations": {
    "board_readability": "PASS",
    "anti_spoiler": "PASS",
    "piece_readability": "PASS",
    "board_pollution": "PASS"
  },
  "public_screenshot_level": "PUBLIC_TEASER_READY_WITH_CAVEATS",
  "awwwards_app_craft_level": "PREMIUM_DIRECTION",
  "visual_competence_level": "PREMIUM_WITH_SUPERVISION",
  "top_strengths": [
    "Concrete visible strength from the contact sheet.",
    "Concrete visible strength from the contact sheet.",
    "Concrete visible strength from the contact sheet."
  ],
  "top_defects": [
    "Concrete visible defect from the contact sheet.",
    "Concrete visible defect from the contact sheet.",
    "Concrete visible defect from the contact sheet."
  ],
  "fatal_defects": [],
  "recommended_action": "HUMAN_REVIEW_REQUIRED"
}
```

Allowed `judge` values:

- `gemini_visual_perceiver`
- `chatgpt_product_art_director`

Allowed hard-gate values:

- `PASS`
- `MINOR_DEBT`
- `FAIL`
- `NOT_EVALUATED`

Allowed public screenshot levels:

- `INTERNAL_ONLY`
- `INTERNAL_NORTH_STAR_CANDIDATE`
- `PUBLIC_TEASER_READY_WITH_CAVEATS`
- `PUBLIC_TEASER_READY`
- `HERO_SCREENSHOT_READY`

Allowed Awwwards app craft levels:

- `WEAK_PROTOTYPE`
- `DECENT_APP_UI`
- `PREMIUM_DIRECTION`
- `AWWWARDS_INSPIRED_APP_CRAFT`
- `SIGNATURE_NEUROCHESS_SCREEN`

Allowed visual competence levels:

- `UNSAFE`
- `FILTERS_FAILURES`
- `SAFE_PROTOTYPE`
- `PREMIUM_WITH_SUPERVISION`
- `LIMITED_AUTONOMOUS_VISUAL_LANE_READY`
- `STRONG_AUTONOMOUS_WITH_HUMAN_REVIEW`

Allowed recommended actions:

- `ACCEPT_WITH_CAVEATS`
- `PATCH_AGAIN`
- `PIECE_IDENTITY_WORK`
- `FEEDBACK_LANGUAGE_WORK`
- `HUMAN_REVIEW_REQUIRED`
- `REJECT`
- `INSUFFICIENT_EVIDENCE`

## Validation Rules

- `evidence_seen` may be true only if the judge actually received the image or
  contact sheet.
- `evidence_files` must include an image file reference.
- `screenshot_references` must name concrete visual states or contact sheet
  regions.
- `top_strengths` and `top_defects` must each contain at least three concrete
  observations.
- Generic praise is invalid.
- Placeholder enum strings such as `PASS|MINOR_DEBT|FAIL` are invalid.
- Placeholder critique text such as `Replace with a concrete visible strength`
  is invalid.
- Public-ready claims without visual references are invalid.
- Text-only ChatGPT review is not a valid visual judge output.
- Numeric aggregate scores are not part of this contract.
- Hard gates retain veto authority.
