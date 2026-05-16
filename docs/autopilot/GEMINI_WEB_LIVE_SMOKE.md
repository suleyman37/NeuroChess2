# Gemini Web Live Smoke

A16H verifies that Gemini Pro Web can act as a bounded external auditor. It is not a product mission and does not enable live Gemini enforcement in the autonomous loop.

Rules:

- use `C:\Users\suley\Documents\Dev\GeminiAuditorChromeProfile`;
- never use the ChatGPT supervisor Chrome profile;
- do not automate login, CAPTCHA, or 2FA;
- send only explicit audit request files;
- require nonce-bound `NC_GEMINI_AUDIT`;
- reject `MICRO_PROMPT`, `codex_prompt`, implementation instructions, and free prose outside the block when detectable;
- save raw and extracted responses under external QA artifacts.

Dry-run command:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/ask_gemini_web.ps1 -DryRun -Fixture ops/autopilot/fixtures/gemini_live_smoke_valid_response.txt
```

Manual login setup command if needed:

```powershell
Start-Process chrome.exe -ArgumentList '--user-data-dir="C:\Users\suley\Documents\Dev\GeminiAuditorChromeProfile"', 'https://gemini.google.com/app'
```

After manual login, close that Chrome window before retrying the smoke so the profile lock check is clean.
