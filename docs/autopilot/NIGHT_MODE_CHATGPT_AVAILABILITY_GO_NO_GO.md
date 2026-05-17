# Night Mode ChatGPT Availability GO/NO-GO

## GO

Before A19X, A21, or any longer live run, all checks must pass:

- active session URL configured in gitignored local session file;
- dedicated Chrome profile lock clear;
- bridge availability is `READY`;
- no human verification detected;
- no loading interstitial detected;
- composer visible;
- Project context is `NeuroChess Supervisor`;
- READY smoke PASS with nonce-bound DONE;
- generic ChatGPT fallback disabled.

## NO-GO

Do not start product work if any of these are true:

- `STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED`;
- `STOP_PROJECT_LOADING_INTERSTITIAL`;
- `STOP_COMPOSER_NOT_FOUND`;
- `STOP_WRONG_CHATGPT_PROJECT_CONTEXT`;
- READY response missing or invalid;
- active session URL missing;
- dedicated profile locked.

NO-GO means stop with a report and use the manual resume protocol. It does not
authorize Night Mode, product work, or browser workaround clicking.
