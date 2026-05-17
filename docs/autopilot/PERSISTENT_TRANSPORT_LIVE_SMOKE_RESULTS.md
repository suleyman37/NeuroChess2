# Persistent Transport Live Smoke Results

## A18G Scope

A18G tests only ChatGPT transport durability. It does not ask for a
MICRO_PROMPT, does not run product work, and does not touch frontend/backend or
docs/rebuild.

Expected live sequence:

1. Open active NeuroChess Supervisor project conversation.
2. Verify bridge availability.
3. Send READY.
4. Send transport echo message 1.
5. Send transport echo message 2.
6. Verify composer remains available.
7. Record whether the same page, browser context, and conversation were reused.

## Result

The first A18G live smoke opened the dedicated ChatGPT profile and reached the
bound active NeuroChess Supervisor conversation URL, but stopped before READY
with `STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED`.

Observed outcome:

- live ChatGPT called: yes, bounded transport smoke only;
- READY sent: no;
- message 1 sent: no;
- message 2 sent: no;
- MICRO_PROMPT requested: no;
- product mission executed: no;
- live Gemini called: no;
- same-page reuse proven: no;
- same-browser reuse proven: no;
- human verification guard result: pass, stop before any prompt request.

The external A18G report under
`NeuroChess_QA_Artifacts/autopilot/persistent_chatgpt_sessions/` is the source
of truth for the exact run artifacts.

## Limits

A18G is not a daemon. It proves same-process persistence for a bounded smoke.
If future automation needs arbitrary long-running planner traffic, rerun A18G
after manual browser verification or repair the persistent transport guard
first. Do not proceed to A19X until READY plus two non-mission messages pass.
