# ChatGPT Project URL Setup

## Purpose

Codex does not create the ChatGPT Project and does not automate login. The user
manually opens the existing Project named `NeuroChess Supervisor`, copies its
browser URL, and stores it in a gitignored local config file with the helper
script. The tracked `ops/autopilot/config.json` must keep `project_url` empty so
the repository can start clean.

## User Steps

1. Open Chrome with the dedicated ChatGPT supervisor profile.
2. Log in manually if needed.
3. Open the ChatGPT Project named `NeuroChess Supervisor`.
4. Copy the full browser URL from the address bar.
5. Run:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/set_chatgpt_project_url.ps1 -ProjectUrl "PASTE_PROJECT_URL_HERE"
```

Accepted URL prefixes:

- `https://chatgpt.com/`
- `https://chat.openai.com/`

## What The Helper Does

The helper:

- validates the URL prefix;
- writes `ops/autopilot/local/chatgpt_project.local.json`;
- updates only local-only `chatgpt_project.project_url`;
- keeps `project_name` as `NeuroChess Supervisor`;
- keeps Project mode enabled;
- does not open a browser;
- does not call ChatGPT;
- does not commit or push.

The local file is ignored by Git. It may also be replaced temporarily by the
`NEUROCHESS_CHATGPT_PROJECT_URL` environment variable. Runtime lookup order is:

1. `ops/autopilot/local/chatgpt_project.local.json`
2. `NEUROCHESS_CHATGPT_PROJECT_URL`
3. tracked `ops/autopilot/config.json`

## After Setup

After setting the URL, `ops/autopilot/config.json` should remain clean. Rerun
the Project READY smoke mission only when a live smoke is explicitly requested.
If READY validates, the next recommended mission can proceed toward
product-safe Night Mode protocol work.
