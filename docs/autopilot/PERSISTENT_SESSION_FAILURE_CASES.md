# Persistent Session Failure Cases

## Case A: Healthy Session

Condition: project context is correct, composer is visible, no challenge or
interstitial is present.

Action: continue on the same page.

## Case B: Composer Temporarily Missing

Condition: project context remains correct, no verification is detected, but
the composer is missing.

Action: bounded wait and at most one soft reload. If unrecovered, stop with
`STOP_COMPOSER_NOT_FOUND`.

## Case C: Loading / Interstitial

Condition: "Un instant...", "Just a moment...", browser checking, or similar
loading/verification page appears with no composer.

Action: one bounded reload only if policy permits, then
`STOP_PROJECT_LOADING_INTERSTITIAL`.

## Case D: Human Verification

Condition: "Je suis humain", "I am human", CAPTCHA, challenge, or explicit
human verification is visible.

Action: stop with `STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED`. Do not click.

## Case E: Wrong Project / Generic ChatGPT

Condition: URL or page context is no longer the NeuroChess Supervisor project
conversation.

Action: stop with `STOP_WRONG_CHATGPT_PROJECT_CONTEXT`. No generic fallback.

## Case F: Page / Browser Crash

Condition: page is closed/crashed or browser is disconnected.

Action: if no mission is active, one clean reopen of the active session URL is
allowed. If a mission is active, produce a rescue report and stop.

## Case G: Invalid Response Format

Condition: response misses nonce/DONE or violates the required schema.

Action: one format repair request maximum. Then stop with
`STOP_PROMPT_FORMAT_INVALID` if still invalid.

## Case H: REQUEST_MORE

Condition: supervisor requests evidence.

Action: answer at most two rounds, reuse the same page, provide only requested
evidence, then stop with `STOP_REQUEST_MORE_LIMIT` if exceeded.

## Case I: Session Threshold Reached

Condition: message or mission counters reach rollover thresholds.

Action: controlled rollover with handoff pack and READY validation.

## Case J: Remaining Time Too Short

Condition: not enough time remains for a useful product mission.

Action: enter DRAIN and write the report.
