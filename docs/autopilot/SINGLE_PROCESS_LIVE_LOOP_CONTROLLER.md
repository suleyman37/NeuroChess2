# Single-Process Live Loop Controller

## Why This Exists

A18G installed a persistent ChatGPT transport scaffold. A18G2 then reached the
NeuroChess Supervisor project session and passed READY, but message 1 did not
produce a validated JSON echo before timeout. That left same-page reuse
unproven.

A18H creates a bounded single-process controller so the same Node/Playwright
invocation owns the browser context and page across READY, message 1, message
2, response capture, and final health check.

## What It Proves

The controller is allowed to prove only transport behavior:

- one Chrome profile launch;
- one active NeuroChess Supervisor conversation URL;
- one browser context;
- one page object;
- READY response;
- two short non-mission JSON echo responses;
- same conversation id when detectable;
- composer still available after the second response.

## What It Does Not Do

- It does not run A19X.
- It does not run Night Mode.
- It does not ask for a MICRO_PROMPT.
- It does not request code, backend work, frontend work, docs/rebuild work, or
  product planning.
- It does not call Gemini.
- It does not enable unrestricted live rolling loop execution.

## A19X Readiness

A19X may proceed only if the live smoke returns `PASS_SINGLE_PROCESS_TRANSPORT`
or a deliberately accepted `PASS_ACTIVE_SESSION_REUSE_ONLY` with stable
two-message same-conversation transport. Otherwise A18H repair comes first.
