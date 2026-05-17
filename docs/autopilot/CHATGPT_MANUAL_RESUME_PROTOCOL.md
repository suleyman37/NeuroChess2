# ChatGPT Manual Resume Protocol

Use this when the bridge reports `STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED`,
`STOP_PROJECT_LOADING_INTERSTITIAL`, or `STOP_COMPOSER_NOT_FOUND`.

## Steps

1. Open Chrome with the dedicated `ChatGPTSupervisorChromeProfile`.
2. Manually complete any login, consent, browser check, or human verification.
3. Open the `NeuroChess Supervisor` Project.
4. Open the active supervisor conversation.
5. Confirm the composer is visible and usable.
6. If the conversation URL changed, bind it with
   `ops/autopilot/set_chatgpt_active_session_url.ps1`.
7. Close the dedicated Chrome window.
8. Run the profile lock cleanup/check.
9. Run a READY-only smoke.
10. Resume automation only after READY validates with nonce-bound DONE and all
    canaries PASS.

Do not ask for a micro-prompt during manual recovery. The first successful step
after recovery is READY validation.
