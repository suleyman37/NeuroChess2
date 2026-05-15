# ChatGPT Web Failure Modes

The bridge stops safely when:

- ChatGPT login is missing;
- browser selectors fail;
- composer text cannot be cleared or filled with the expected nonce;
- send button or keyboard submission fails after the bounded strategy ladder;
- Playwright is unavailable in live mode;
- response times out;
- response changes during the stability window;
- nonce is missing or wrong;
- DONE is missing, duplicated, or not final;
- response contains markdown outside the supervisor block;
- MICRO_PROMPT is broad or invalid;
- format repair fails.

Failure output goes to the external QA artifact root when available:

```text
C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot
```

Fallback generated reports under `ops/autopilot/reports/generated` are ignored
by Git.

On send failure, the bridge writes external debug artifacts when possible:

- `send_before.png`;
- `send_failed_after.png`;
- `composer_text_snapshot.txt`;
- `send_button_candidates.json`;
- `send_failed_debug.json`;
- `send_attempts.json`.
