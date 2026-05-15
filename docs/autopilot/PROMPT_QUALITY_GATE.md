# Prompt Quality Gate

ChatGPT self-audit is not trusted.

`prompt_firewall.ps1` independently rejects a MICRO_PROMPT when it is missing
required fields, has vague language, mixes work types, touches forbidden paths,
or tries to escalate risk.

Hard rejects include:

- missing allowed or forbidden paths;
- missing max files or max diff lines;
- missing checks or stop conditions;
- quality score below 8;
- any hard self-audit FAIL;
- docs-only touching code paths;
- frontend touching backend;
- backend touching frontend;
- red-tier auto-push to `road-to-V2`;
- `/games/{game_id}/review`;
- `git add -A`;
- broad terms such as `improve`, `polish`, `refactor`, `as needed`, or
  `handle everything`.

Rejected prompts may be sent once through the format-repair prompt. A second
invalid response stops the loop.
