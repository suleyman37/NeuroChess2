# Dual Browser Profile Isolation

Mission: A20BD

## Purpose

ChatGPT Web and Gemini Web must run in separate browser environments. A shared
Chrome profile can silently mix account state, default Google account selection,
model availability, and service settings. A20BD separates the lanes so future
overnight supervision can distinguish "service unavailable" from "wrong account
or profile."

## Lane Contract

ChatGPT Web:

- Profile: `ops/autopilot/local/browser_profiles/chatgpt/`
- CDP port: `9222`
- Runtime state: `ops/autopilot/runtime/chatgpt_browser_state.json`
- Start mode: local A-J conversation pool when available

Gemini Web:

- Profile: `ops/autopilot/local/browser_profiles/gemini/`
- CDP port: `9223`
- Runtime state: `ops/autopilot/runtime/gemini_browser_state.json`
- Start URL: `https://gemini.google.com/app`

Both local profiles and runtime files are gitignored. The scripts redact private
URLs, account details, cookies, tokens, and secrets.

## Safety Rules

- Never share a user-data-dir, Chrome profile, CDP endpoint, or browser context
  between ChatGPT and Gemini lanes.
- Never enter credentials or switch accounts automatically.
- Never click verification, CAPTCHA, consent, 2FA, or human-verification UI.
- If a dedicated port is already reachable, treat it as ready only when the
  browser process command line matches the expected dedicated profile.
- If the profile, port, or account state is uncertain, park the lane and keep
  local OMEGA fallback available.

## Scripts

`ops/autopilot/browser_profile_manager.ps1` owns profile creation, launch,
status checks, and explicit managed-browser cleanup. It does not kill normal
user Chrome windows.

`ops/autopilot/dual_browser_session_policy.yaml` records the stable policy:
separate profile dirs, separate CDP ports, screenshot-before-verdict, no
credentials, no verification bypass, and continue-offline behavior.

`ops/autopilot/browser_lane_state.schema.json` defines the local runtime lane
state contract.
