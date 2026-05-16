# Gemini Visual Court

Visual Court is used for frontend-readonly branches after screenshots and a visual review brief exist. It judges whether the UI is truthful and aligned with the product contract.

Required inputs:

- screenshot_before
- screenshot_after
- contact_sheet
- visual_review_brief
- UX or product contract
- forbidden UI claims

Verdicts:

- PASS_VISUAL: visual evidence is acceptable, subject to deterministic gates.
- WARNING_VISUAL: branch needs narrowing or follow-up review before readiness.
- BLOCK_VISUAL: mark branch NEEDS_REWORK or stop; do not mark READY_TO_REVIEW.

Checks:

- UI truthfulness
- read-only clarity
- primary CTA safety
- fake Practice, XP, rank, or Transfer claims
- visual hierarchy
- contract match

Visual Court never generates prompts or product implementation instructions.
