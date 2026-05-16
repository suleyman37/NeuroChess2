# ChatGPT Project URL Setup

## Purpose

Codex does not create the ChatGPT Project and does not automate login. The user
manually opens the existing Project named `NeuroChess Supervisor`, copies its
browser URL, and stores it in `ops/autopilot/config.json` with the helper
script.

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
- updates `chatgpt_project.project_url`;
- keeps `project_name` as `NeuroChess Supervisor`;
- keeps Project mode enabled;
- does not open a browser;
- does not call ChatGPT;
- does not commit or push.

## After Setup

After setting the URL, rerun the Project READY smoke mission. If READY validates,
the next recommended mission can proceed toward product-safe Night Mode
protocol work.
