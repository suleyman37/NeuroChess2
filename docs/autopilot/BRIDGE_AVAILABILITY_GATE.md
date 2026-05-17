# Bridge Availability Gate

## Purpose

The Bridge Availability Gate runs before any ChatGPT Web READY or micro-prompt
request. It is a deterministic local gate, not a supervisor decision.

## Send Rules

The bridge may send only when availability is `READY`:

- active Project/session URL opens;
- Project context is `NeuroChess Supervisor`;
- composer is visible and usable;
- no loading interstitial is detected;
- no human verification signal is detected.

## Stop Rules

The bridge must stop when:

- human verification is required;
- loading/interstitial remains after the bounded policy;
- composer is missing;
- context is not the configured Project;
- the page is unusable and cannot be classified.

Loading interstitials may use at most one bounded reload when policy permits.
Human verification receives zero automated bypass attempts.

## No Retry Loop

The guard exists so Night Mode and rolling loops do not spend hours waiting.
Repeated failure should produce a manual resume report, not additional browser
clicking, generic fallback, or product execution.
