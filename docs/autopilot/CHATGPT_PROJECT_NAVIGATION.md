# ChatGPT Project Navigation

## Purpose

A12C hardens ChatGPT Web supervision by requiring an explicit Project URL for
Project-scoped rollover flows. The bridge must not randomly search the sidebar,
guess a Project, or silently fall back to generic ChatGPT when the mission
requires the `NeuroChess Supervisor` Project.

## Required Project Configuration

`ops/autopilot/config.json` contains:

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
smokes must stop with `PROJECT_URL_MISSING`.

## Bridge Behavior

When Project mode is enabled:

1. Launch Chrome with the dedicated supervisor profile.
2. Require `chatgpt_project.project_url` when `require_project_url` is true.
3. Navigate directly to the configured URL.
4. Wait for the page to load.
5. Verify the page is usable and appears Project-scoped.
6. Stop with `PROJECT_CONTEXT_UNVERIFIED` if the page cannot be verified.
7. Send the READY request only after Project context verification passes.

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
