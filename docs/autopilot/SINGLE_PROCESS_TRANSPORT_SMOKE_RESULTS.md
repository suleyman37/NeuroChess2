# Single-Process Transport Smoke Results

## Scope

A18H tests only ChatGPT transport stability in the bound NeuroChess Supervisor
project conversation. It uses READY plus two short JSON echo prompts.

## Expected Verdicts

- `PASS_SINGLE_PROCESS_TRANSPORT`: READY and both echoes pass, same page and
  browser reuse are proven.
- `PASS_ACTIVE_SESSION_REUSE_ONLY`: both echoes pass in the same conversation,
  but same-page instrumentation is not conclusive.
- `PARTIAL_SINGLE_PROCESS_TRANSPORT`: message 1 passes and message 2 times out.
- `FAIL_TRANSPORT_RESPONSE_TIMEOUT`: message 1 times out.
- `STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED`: verification is visible.
- `STOP_COMPOSER_NOT_FOUND`: composer is unavailable.
- `STOP_WRONG_CHATGPT_PROJECT_CONTEXT`: project/session context is wrong.

## Live Result

The first A18H live smoke opened the active NeuroChess Supervisor project
conversation through the dedicated Chrome profile, but stopped before READY
with `STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED`.

Observed outcome:

- active session URL reuse: yes;
- live ChatGPT called: yes, bounded smoke only;
- READY result: not run;
- message 1 result: not run;
- message 2 result: not run;
- same browser reuse: unknown;
- same page reuse: unknown;
- same conversation id: unknown;
- MICRO_PROMPT requested: no;
- product mission executed: no;
- Gemini called: no.

The external report under
`NeuroChess_QA_Artifacts/autopilot/single_process_live_loop/` is the source of
truth for exact diagnostics and screenshots.

Next action: repair or manually clear ChatGPT verification before rerunning
A18H. Do not proceed to A19X until this transport smoke passes or a deliberate
policy accepts active-session-only transport.
