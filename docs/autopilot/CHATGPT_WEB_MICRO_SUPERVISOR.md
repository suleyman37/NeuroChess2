# ChatGPT Web Micro-Supervisor Bridge

This bridge lets AgentOS ask ChatGPT Web for the next micro-prompt without using
the OpenAI API.

Default state is safe:

- bridge disabled in `ops/autopilot/config.json`;
- dry-run mode;
- no live send unless `-Live` is explicit;
- no Codex execution;
- no commit;
- no push.

The bridge is for supervision only. It does not run product missions by itself.

## Dry Run

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/ask_chatgpt_web.ps1 -DryRun -Fixture ops/autopilot/fixtures/supervisor_valid_response.txt
```

This builds an external evidence pack, reads the fixture response, checks the
nonce-bound DONE sentinel, validates the MICRO_PROMPT, and exits.

## Live Mode

Live mode is blocked until `chatgpt_web_bridge.enabled` is set true and the
operator passes `-Live`.

The script never automates login, stores credentials, bypasses account controls,
or sends broad prompts.

Manual setup:

1. Open Chrome with `C:\Users\suley\Documents\Dev\ChatGPTSupervisorChromeProfile`.
2. Log in manually.
3. Open a dedicated NeuroChess Supervisor conversation.
4. Select GPT-5.5 Thinking / deep thinking mode manually.
5. Run dry-run first.
6. Run live only after dry-run succeeds.
7. Inspect `extracted_micro_prompt.md` before autonomous execution is enabled.
