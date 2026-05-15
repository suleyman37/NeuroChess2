# Bridge Dry-Run And Live Mode

Dry-run is the default.

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/ask_chatgpt_web.ps1 -DryRun -Fixture ops/autopilot/fixtures/supervisor_valid_response.txt
```

Dry-run proves:

- no browser send;
- no live ChatGPT contact;
- no Codex execution;
- no commit;
- no push;
- protocol extraction works;
- Prompt Firewall works.

Live mode requires:

- `chatgpt_web_bridge.enabled=true`;
- explicit `-Live`;
- manual ChatGPT login already completed in the dedicated Chrome profile;
- GPT-5.5 Thinking / deep thinking mode selected manually.

`run_once.ps1 -DryRun` is now non-executing. It selects a task and writes a
summary only. It does not create a worktree, run Codex, run checks, commit, or
push.
