# Gemini Visual Decision Policy

Visual Court applies to frontend-readonly branches after visual evidence exists.
It does not create prompts or implementation instructions.

Required visual evidence:

- screenshots;
- contact sheet;
- visual review brief;
- product or UX contract;
- forbidden UI claim checklist.

Verdicts:

- `PASS_VISUAL`: the visual evidence is acceptable only if screenshots, contact
  sheet, visual brief, and deterministic gates pass.
- `WARNING_VISUAL`: the branch cannot be automatically marked
  `READY_TO_REVIEW`; it requires narrowing, a small correction, or morning
  review.
- `BLOCK_VISUAL`: the branch is `NEEDS_REWORK`; no product merge to
  `road-to-V2` is allowed.

Visual claims involving unsafe Practice CTAs, XP/rank, Transfer, or false
progress must block or force rework. Gemini cannot override the product-safe
Night Mode policy.
