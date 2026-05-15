# ChatGPT Web Failure Modes

The bridge stops safely when:

- ChatGPT login is missing;
- browser selectors fail;
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
