# ChatGPT Response Capture Stability

## Problem

Long live runs need deterministic response capture. Waiting for the latest
assistant message is fragile when a conversation already contains previous
READY checks, format repairs, or old transport smoke messages.

## A18H Capture Rules

The single-process controller uses unique nonces for READY, message 1, and
message 2. Response capture:

- records the assistant message set before sending;
- sends a short prompt from the current composer;
- waits for an assistant response containing the expected nonce;
- accepts raw JSON or fenced `json` blocks;
- extracts the first valid JSON object containing the expected nonce;
- verifies `done` equals nonce;
- verifies `message_index`;
- rejects `MICRO_PROMPT`, `codex_prompt`, and `micro_prompt_requested: true`;
- waits briefly for text stability before accepting a response.

## Failure Evidence

On timeout or invalid response, the controller writes external evidence:

- raw or partial response text when available;
- validation JSON;
- current URL;
- screenshot;
- sanitized DOM summary without raw account text;
- exact stop reason.

No infinite waits are allowed. If message 1 times out, message 2 is not sent.
