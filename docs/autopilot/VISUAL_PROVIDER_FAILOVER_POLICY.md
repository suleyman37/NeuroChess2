# Visual Provider Failover Policy

Gemini Visual Court is the primary visual auditor when image upload is available. ChatGPT Visual Court is secondary and may be used when extra confidence is needed.

## Gemini Primary

Gemini is mandatory for frontend E2E in A20.5/A21 unless explicitly unavailable. Gemini remains auditor-only and cannot generate Codex prompts.

## ChatGPT Secondary

Use ChatGPT Visual Court when:

- Gemini returns `WARNING_VISUAL`;
- Gemini returns `PASS_VISUAL` on high-risk UI;
- a canary fails;
- Gemini is unavailable but ChatGPT visual upload is healthy.

## Disagreement

Gemini `BLOCK_VISUAL` cannot be overridden by ChatGPT `PASS_VISUAL` without human or morning review. If either provider returns `BLOCK_VISUAL`, the branch is `NEEDS_REWORK` or `QUARANTINE_REQUIRED`.

If one provider returns `WARNING_VISUAL` and the other returns `PASS_VISUAL`, the best automatic classification is `READY_TO_REVIEW_WITH_VISUAL_DEBT`.

If no provider is available, the frontend branch cannot count as a full E2E deliverable.
