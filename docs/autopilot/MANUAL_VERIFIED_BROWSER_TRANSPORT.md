# Manual Verified Browser Transport

## Operator Flow

1. User launches Chrome manually with the dedicated profile and CDP port:
   `--remote-debugging-port=9222`
   `--user-data-dir=C:\Users\suley\Documents\Dev\ChatGPTSupervisorChromeProfile`
2. User completes any ChatGPT human verification, login, or consent manually.
3. User opens the NeuroChess Supervisor active conversation.
4. User confirms the composer is visible.
5. Codex runs the CDP attach smoke.

## Automation Boundaries

Codex may inspect page state and send the bounded READY/echo smoke only after
the page is ready. Codex must not click human-verification controls, solve
CAPTCHA, bypass login, open generic ChatGPT fallback, or close the user-owned
Chrome session.

## Long Run Use

If CDP attach is proven stable, future long live runs can prefer manual
verified browser transport. This reduces repeated Chrome launches and lowers
the chance of verification loops during A19X/A21.
