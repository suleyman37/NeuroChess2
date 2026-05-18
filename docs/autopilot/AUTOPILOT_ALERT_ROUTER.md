# Autopilot Alert Router

## Purpose

The Autopilot Alert Router delivers human-action notifications for NeuroChess
automation. The primary channel is ntfy push notification to the user's iPhone.
Gmail SMTP is fallback-only and disabled by default.

## Local Config

Runtime config is stored only in:

`ops/autopilot/local/alert_router.local.json`

That file is gitignored and must not be staged or committed. The tracked
example is:

`ops/autopilot/alert_router.local.example.json`

The private ntfy topic must not appear in reports, logs, commits, or final
answers. Status output shows only a redacted topic preview.

## Setup

Initialize ntfy locally:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/setup_alert_router.ps1 -Action InitNtfy
```

If no topic is supplied, the script prompts locally:

```text
Enter ntfy topic for NeuroChess iPhone alerts
```

The topic must be at least 24 characters. Long random topics are preferred.

## Test

Send a real test notification:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/setup_alert_router.ps1 -Action Test
```

Expected status:

`ALERT_SENT_NTFY`

## Send Alert

Use:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/send_autopilot_alert.ps1 `
  -Channel auto `
  -MissionId A20_NEXT `
  -ServiceName ChatGPT `
  -Reason HUMAN_VERIFICATION_REQUIRED
```

The alert tells the user to go to the Chrome window left open by Codex, not to
close Chrome, and to complete verification manually.

## Safety

- ntfy is primary.
- Gmail SMTP is disabled unless explicitly enabled in local config.
- Gmail failure must not block live web flow if ntfy works.
- No CAPTCHA, 2FA, consent, or human verification bypass is attempted.
- No private topic, SMTP password, private ChatGPT URL, cookie, token, or
  credential is committed.
