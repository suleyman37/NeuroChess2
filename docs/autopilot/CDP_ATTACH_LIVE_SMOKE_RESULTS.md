# CDP Attach Live Smoke Results

## Scope

A18I tests whether Codex can attach to an already-open, manually verified
ChatGPT Chrome session and reuse the existing NeuroChess Supervisor tab.

The live smoke sends:

1. READY confirmation.
2. Transport echo message 1.
3. Transport echo message 2.

No MICRO_PROMPT is requested and no product work is executed.

## Expected Pass

`PASS_CDP_ATTACH_TRANSPORT` means:

- CDP attach succeeded;
- existing Chrome was reused;
- existing page was reused;
- both echo messages returned strict JSON;
- same conversation id remained stable;
- Codex did not close Chrome.

## Live Result

PASS on 2026-05-17.

External report:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\chatgpt_cdp_attach\A18I_cdp_attach_20260517_154131`

Observed result:

- final verdict: `PASS_CDP_ATTACH_TRANSPORT`;
- CDP attach succeeded;
- existing Chrome was reused;
- existing NeuroChess Supervisor page was reused;
- READY result: `PASS`;
- message 1 result: `PASS`;
- message 2 result: `PASS`;
- same conversation id: yes;
- same page reuse: yes;
- same browser reuse: yes;
- no MICRO_PROMPT was requested;
- no product mission was executed;
- Gemini was not called;
- Codex did not close Chrome.

Before the successful run, two bounded failures were useful:

- a false `STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED` caused by scanning the
  entire conversation text for human-verification terms;
- a READY timeout caused by requiring global stop-button count to be zero even
  after the nonce-bound READY response had validated.

Both issues were repaired in the CDP attach controller. Human-verification
detection now treats conversation-history text as non-authoritative when the
project conversation and composer are present, and response capture trusts a
nonce-valid response after bounded stabilization.
