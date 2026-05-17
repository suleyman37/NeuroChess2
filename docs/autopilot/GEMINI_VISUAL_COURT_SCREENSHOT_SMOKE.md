# Gemini Visual Court Screenshot Smoke

A18F proves a bounded path from Codex to Gemini Web for visual evidence:

1. create synthetic screenshots outside the repo;
2. build a compact Visual Context Pack;
3. build a Visual Review Brief;
4. upload the image to Gemini;
5. require strict `NC_GEMINI_AUDIT_JSON/1`;
6. validate nonce, `done`, verdict, and `visual_checks`;
7. reject any `MICRO_PROMPT`, `codex_prompt`, or implementation instruction.

This is a smoke test only. Gemini remains an auditor, not a planner. It cannot
authorize execution, product work, or Control Plane bypass.

## Scope

Allowed:

- synthetic image upload;
- Visual Court JSON audit;
- safe visual-code readback;
- unsafe UI canary rejection;
- external QA artifacts under
  `C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\gemini_visual_smokes`.

Forbidden:

- ChatGPT live calls;
- product missions;
- frontend/backend changes;
- docs/rebuild changes;
- Night Mode;
- Gemini-generated Codex prompts;
- Gemini-written implementation instructions;
- generated image commits.

## Expected Result

The safe image should return `PASS_VISUAL` and echo the visible code. The unsafe
canary should return `WARNING_VISUAL` or `BLOCK_VISUAL` and identify fake
Practice plus fake XP/rank/Transfer claims.

## Upload Strategy

The bridge uses bounded, deterministic upload paths only:

- existing `input[type=file]`;
- direct file chooser from the visible import/attach button;
- menu-triggered file chooser from an explicit device/file upload item such as
  `Importer des fichiers`.

It records `attachment_button_candidates.json`,
`attachment_menu_candidates.json`, and `attachment_menu_after_click.png` when
the upload path needs diagnosis. It must not random-click, automate login, or
accept a visual verdict without real image evidence.
