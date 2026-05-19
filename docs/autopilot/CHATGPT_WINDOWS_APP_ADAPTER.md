# ChatGPT Windows App Adapter

Mission: A20BA

The ChatGPT Windows App Adapter is an optional supervisor transport discovery
lane for NeuroChess autopilot. It exists to test whether the installed ChatGPT
desktop app is safer or more reliable than the Chrome/CDP A-J web pool without
making GPT Web, Gemini, or any paid API a dependency.

## Transport Order

1. `chatgpt_windows_app_adapter` when the desktop app is installed, running, and
   safe to automate.
2. `chatgpt_web_a_j_pool` when Chrome/CDP is healthy.
3. `local_omega_fallback`, always available.

OpenAI API and Gemini API adapters remain disabled by default under the
zero-cost policy.

## Modes

`ops/autopilot/chatgpt_windows_app_adapter.ps1` supports:

- `Discover`: find installed packages, Start Menu entries, processes, and
  visible windows.
- `Status`: summarize installed/running/window/composer/auth/safe-send state.
- `InspectWindow`: collect a redacted Windows UI Automation summary.
- `DryRunComposer`: verify whether a composer could be used, without sending.
- `SendTestMessage`: send only after all safety checks pass.
- `ReadLastResponse`: attempt a privacy-safe response read, otherwise return
  `RESPONSE_READ_UNAVAILABLE`.
- `BuildTransportReport`: write the desktop transport report and selected
  fallback lane.

## Safety Contract

The adapter may send a message only when all are true:

- target process/window is confidently identified as ChatGPT;
- UI Automation is available;
- a message composer is detected;
- no login, CAPTCHA, 2FA, consent, or human-verification wall is detected;
- the target is high confidence;
- the send operation can use a controlled UI Automation path.

Forbidden:

- active-window blind keystrokes;
- credentials;
- login, CAPTCHA, 2FA, consent, or human-verification bypass;
- private URLs or conversation text in committed files;
- paid API calls.

If any check is uncertain, the adapter parks the lane and reports a status such
as `CHATGPT_DESKTOP_COMPOSER_NOT_FOUND` or
`CHATGPT_DESKTOP_ADAPTER_UNSAFE`.

## Redaction

Windows UI Automation can expose sidebar conversation labels and window titles.
A20BA therefore classifies UI node names as generic labels such as
`[redacted-ui-text]`, `[composer-or-chat-label]`, or
`[auth-or-human-action-label]`. The adapter keeps enough structure to reason
about safety while avoiding private conversation text.

## Integration

`ops/autopilot/supervisor_transport_fabric.ps1` checks the adapter and routes to
`local_omega_fallback` whenever the desktop lane is blocked. NeuroRelay records
the desktop transport status per iteration, but local OMEGA remains
authoritative.

## Current A20BA Result

On the A20BA machine, the ChatGPT Windows desktop app was detected as installed
and running. UI Automation could inspect the window, but no safe composer was
detected. The adapter did not send a message and parked the lane while preserving
local fallback.
