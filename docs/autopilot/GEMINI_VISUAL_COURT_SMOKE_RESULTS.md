# Gemini Visual Court Smoke Results

A18F records Gemini Visual Court screenshot upload smoke results in external QA
artifacts, not in committed image files.

Report fields:

- precheck exact;
- Gemini profile lock result;
- Gemini login detected yes/no/unknown;
- Gemini model/mode verified yes/no/unknown;
- visual context pack path;
- safe image path;
- safe raw response path;
- safe extracted JSON path;
- safe validation result;
- unsafe image path;
- unsafe raw response path;
- unsafe extracted JSON path;
- unsafe validation result;
- visual code expected/seen;
- fake UI claims detected yes/no;
- Gemini produced `MICRO_PROMPT` yes/no;
- Gemini produced `codex_prompt` yes/no;
- final verdict.

Valid final verdicts:

- `PASS_GEMINI_VISUAL_COURT_SCREENSHOT_SMOKE`
- `FAIL_GEMINI_VISUAL_COURT_SCREENSHOT_SMOKE`

## A18F Result

A18F produced a controlled failure:

- dry-run fixtures passed;
- synthetic images were generated outside the repo;
- Gemini live was called for the safe smoke only;
- ChatGPT live was not called;
- no product mission executed;
- the unsafe visual canary was not run because the safe smoke did not pass.

Failure reason:

- Gemini UI did not expose a usable screenshot upload target to the current
  bounded bridge selectors;
- the bridge stopped with `STOP_GEMINI_IMAGE_UPLOAD_NOT_AVAILABLE`.

Next action:

- `A18F_REPAIR_GEMINI_VISUAL_COURT_SCREENSHOT_SMOKE`
