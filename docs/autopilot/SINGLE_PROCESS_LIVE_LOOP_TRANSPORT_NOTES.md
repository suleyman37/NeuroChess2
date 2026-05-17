# Single Process Live Loop Transport Notes

## Current Architecture

The historical ChatGPT bridge is one-shot:

- launch dedicated Chrome profile;
- open project/session URL;
- send one request;
- wait for one response;
- close browser context.

A18G adds a second mode in the same bridge: one process, one browser context,
one page, READY plus two non-mission messages. This mode is intentionally
bounded and does not expose a long-running daemon API.

## Why This Matters

A19X and later Night Mode runs need fewer browser restarts. Reusing the same
page lowers risk of human verification, project context drift, and accidental
conversation churn.

## What A18H Would Add

If A18G proves same-page reuse, A18H should move from smoke to controller:

- one process owns the ChatGPT page for a complete live loop;
- local Control Plane sends typed operations into that process;
- REQUEST_MORE, format repair, Strategic Pulse, and MICRO_PROMPT requests reuse
  the same page;
- DRAIN/STOP/QUARANTINE closes the transport cleanly;
- session rollover is explicit and READY-gated.

If same-page reuse is not proven, A18H should diagnose the remaining blocker
before A19X.
