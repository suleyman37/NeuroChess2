# Safe Live Visual Court Policy

Live visual court mode is optional. Dry-run fixture mode and manual packet mode
are the default safe paths.

## Core Policy

- live mode cannot be required for mission success;
- live mode may use only approved existing sessions;
- no credential automation;
- no CAPTCHA bypass;
- no human-verification bypass;
- no "I am human" automation;
- stop on consent, login, 2FA, or manual checks;
- record all live calls;
- validate every response;
- placeholder or generic responses are insufficient;
- live output never overrides deterministic hard gates.

## Stop Rule

If Gemini, ChatGPT, or any browser session asks for login, CAPTCHA, 2FA,
consent, human verification, or manual "I am human" action:

`STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED`

Do not bypass. Fall back to `MANUAL_PACKET_MODE` or `OFFLINE_FIXTURE_MODE`.

## Evidence Required For Live Mode

- bridge mode report;
- safety report;
- prompt files;
- raw judge JSON files;
- validation results;
- merged visual court summary;
- Creative Director verdict;
- next mission prompt.

Live response text is not evidence until it validates as structured judge JSON.
