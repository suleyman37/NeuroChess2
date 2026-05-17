# ChatGPT Project Navigation

## Purpose

A12C hardens ChatGPT Web supervision by requiring an explicit Project URL for
Project-scoped rollover flows. The bridge must not randomly search the sidebar,
guess a Project, or silently fall back to generic ChatGPT when the mission
requires the `NeuroChess Supervisor` Project.

## Required Project Configuration

`ops/autopilot/config.json` contains the tracked defaults:

```json
"chatgpt_project": {
  "enabled": true,
  "project_name": "NeuroChess Supervisor",
  "project_url": "",
  "require_project_url": true,
  "verify_project_name": true,
  "allow_generic_chat_fallback": false
}
```

If `project_url` is empty and Project mode is enabled, live Project rollover
smokes must stop with `PROJECT_URL_MISSING` unless a local gitignored config or
environment variable supplies the URL.

Local URL lookup order:

1. `ops/autopilot/local/chatgpt_sessions.local.json` active session URL, when a
   human has already opened a verified Project conversation.
2. `ops/autopilot/local/chatgpt_project.local.json`
3. `NEUROCHESS_CHATGPT_PROJECT_URL`
4. tracked `ops/autopilot/config.json`

The local file may follow this shape:

```json
{
  "chatgpt_project": {
    "project_url": "https://chatgpt.com/g/PROJECT_ID/project"
  }
}
```

The real local file must not be committed.

An active Project conversation may be bound locally with
`ops/autopilot/set_chatgpt_active_session_url.ps1`. The helper writes only to
`ops/autopilot/local/chatgpt_sessions.local.json`, which is gitignored. The
active session URL must remain inside the `NeuroChess Supervisor` Project path
and contain a `/c/` conversation segment. Reports should record that the active
session URL is configured, but should not print the full value in committed
docs.

## Bridge Behavior

When Project mode is enabled:

1. Launch Chrome with the dedicated supervisor profile.
2. Prefer a gitignored active Project conversation URL when present; otherwise
   resolve `chatgpt_project.project_url` from local config, environment, then
   tracked config.
3. Require the resolved Project URL when `require_project_url` is true.
4. Navigate directly to the configured URL.
5. Wait for the page to load.
6. Verify the page is usable and appears Project-scoped.
7. Stop with `PROJECT_CONTEXT_UNVERIFIED` if the page cannot be verified.
8. Send the READY request only after Project context verification passes.

The bridge must not:

- click random sidebar Project names;
- use generic chat fallback when fallback is disabled;
- automate login;
- bypass CAPTCHA or 2FA;
- ask for a MICRO_PROMPT during READY smoke.

## Verification Signals

Project context may be considered usable when one or more strong signals exist:

- the page contains `NeuroChess Supervisor`;
- the page title contains `NeuroChess Supervisor`;
- the URL remains on the configured Project URL after navigation.

If the page redirects to login, generic ChatGPT, or another non-Project context,
the bridge must stop before sending.
