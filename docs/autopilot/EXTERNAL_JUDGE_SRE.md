# External Judge SRE

`ops/autopilot/external_judge_sre.ps1` keeps ChatGPT Web and Gemini useful without making either service a dependency.

## Lanes

- `chatgpt`: strategic supervisor, mission critic, prompt improver.
- `gemini`: visual perception critic when screenshot evidence exists.
- `local fallback`: always available and continues the loop if live lanes are parked.

## Behavior

The SRE layer runs a health check before live dispatch. If a lane is available, higher-level NeuroRelay code may use its decision packet. If a lane is blocked, the SRE classifies the reason, sends or simulates an ntfy alert when action may be useful, parks the lane, and allows local fallback to continue.

It never asks the user to log in, type READY, provide URLs, enter credentials, solve CAPTCHA, or complete human verification during autonomous mode.

## Lane States

- `AVAILABLE`
- `PARKED_AUTH_REQUIRED`
- `PARKED_HUMAN_ACTION_REQUIRED`
- `PARKED_CDP_UNAVAILABLE`
- `PARKED_RATE_LIMITED`
- `PARKED_SESSION_CLOSED`
- `PARKED_UPLOAD_UNAVAILABLE`
- `PARKED_UNCLASSIFIED_PAGE_STATE`
- `FAILED_INVALID_RESPONSE`
- `SKIPPED_NOT_CONFIGURED`

## Alert Rules

ChatGPT or Gemini failures that need attention send an alert through `send_autopilot_alert.ps1`. Alerts include service, reason, mission id, lane status, and whether Codex continues offline. They exclude private URLs, secrets, ntfy topic, tokens, and credentials.

If ntfy is not configured or delivery fails, the SRE writes a local runtime alert and continues offline. Alert cooldown is 30 minutes per lane plus reason.

## Problem Coverage

The policy file covers CDP unreachable, auth or consent wall, usable ChatGPT page, unclassified page state, conversation exhaustion, Gemini not configured, Gemini auth wall, no visual evidence, invalid external response, response timeout, and ntfy alert failure.

## Integration

`supervisor_bridge.ps1` and `run_neurorelay_loop.ps1` call the SRE health check before optional live dispatch. NeuroRelay still works with zero external packets, so a web failure cannot fail the autonomous loop by itself.
