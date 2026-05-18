# Human Verification Pause Resume Email Gate

## Purpose

The Human Verification Pause/Resume Gate lets NeuroChess automation stop safely
when ChatGPT, Gemini, or another browser lane shows login, CAPTCHA, 2FA,
consent, or human verification.

It is not a bypass. It does not click verification controls. It leaves the
browser open, writes a pause-state file, sends an email alert when configured,
and waits for a human to complete the verification manually.

## Scripts

- `ops/autopilot/send_human_verification_email_alert.ps1`
- `ops/autopilot/human_verification_pause_resume_gate.ps1`
- `ops/autopilot/test_human_verification_pause_resume_email_gate.ps1`

Runtime pause state is written to:

`ops/autopilot/runtime/human_verification_pause_state.json`

That folder is gitignored except for `.gitkeep`.

## Email Configuration

Preferred configuration is environment variables:

```powershell
$env:NC_ALERT_EMAIL_TO="suleyman.bulut.pro@gmail.com"
$env:NC_ALERT_EMAIL_FROM="YOUR_SENDER_EMAIL"
$env:NC_ALERT_SMTP_HOST="smtp.gmail.com"
$env:NC_ALERT_SMTP_PORT="587"
$env:NC_ALERT_SMTP_USER="YOUR_SENDER_EMAIL"
$env:NC_ALERT_SMTP_PASSWORD="YOUR_APP_PASSWORD_OR_SMTP_PASSWORD"
$env:NC_ALERT_SMTP_USE_SSL="true"
```

For the current terminal session only, paste those commands into PowerShell
with real values. Do not commit the values.

An optional gitignored local config can be created from the committed template:

`ops/autopilot/email_alert.local.example.json`

Save the real local config as:

`ops/autopilot/local/email_alert.local.json`

That real file is ignored by git. Do not stage it.

If using Gmail SMTP, use an app password or another approved SMTP method. Do
not store the password in the repository.

## Pause Mode

Use `PauseAndAlert` when automation detects a human verification wall:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/human_verification_pause_resume_gate.ps1 `
  -Mode PauseAndAlert `
  -ServiceName ChatGPT `
  -MissionId A20AB_CHATGPT_FILE_INPUT_UPLOAD_WITH_HUMAN_RESUME `
  -Reason STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED `
  -ArtifactPath "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20AB" `
  -PauseStatePath "ops\autopilot\runtime\human_verification_pause_state.json"
```

The pause state includes:

- `status: WAITING_FOR_HUMAN_VERIFICATION`
- `browser_should_remain_open: true`
- `automation_paused: true`
- `email_alert_status`
- `resume_check_command`
- timeout metadata
- artifact path

## Resume Check

After the user manually completes verification in the already-open Chrome
window, run the resume command from the pause-state file.

The resume check can return:

- `RESUME_READY`
- `STILL_WAITING_FOR_HUMAN`
- `SESSION_CLOSED`
- `TIMEOUT_EXPIRED`
- `UNKNOWN_STATE`

The resume check must not click verification controls. It only decides whether
automation may retry after manual user action.

## Safety Guarantees

- No login automation.
- No credential entry.
- No CAPTCHA bypass.
- No 2FA automation.
- No consent bypass.
- No "I am human" automation.
- No SMTP password in reports or logs.
- No local email config committed.
- Browser should remain open while waiting.

## Readiness

The pause/resume infrastructure is available after A20AA. Email readiness
requires configured SMTP environment variables or a gitignored local config.
Dry-run output is useful for tests, but it is not enough for live READY status.
