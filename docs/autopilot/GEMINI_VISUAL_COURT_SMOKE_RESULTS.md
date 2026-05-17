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

## A18F2 Result

A18F2 repaired the Gemini image upload path and passed the bounded live visual
smoke:

- Gemini composer was available;
- the `Importer un fichier` button opened an upload menu;
- the bridge selected the explicit `Importer des fichiers` menu item;
- Playwright received the menu-triggered file chooser;
- the synthetic safe image uploaded successfully;
- Gemini read the visible code exactly;
- strict JSON validation passed;
- the unsafe synthetic UI canary returned `BLOCK_VISUAL`;
- fake Practice and fake XP/rank/Transfer claims were detected;
- Gemini did not produce `MICRO_PROMPT` or `codex_prompt`;
- ChatGPT live was not called;
- no product mission executed.

Final A18F2 verdict:

- `PASS_GEMINI_VISUAL_COURT_SCREENSHOT_SMOKE`

Next action:

- `A19X_FULLSTACK_ENDURANCE_LIVE_PILOT`
