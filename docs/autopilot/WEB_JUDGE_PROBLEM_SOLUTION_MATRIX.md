# Web Judge Problem Solution Matrix

This matrix maps known ChatGPT/Gemini web-judge orchestration failures to safe actions.

| Status Code | Detection | Action | Forbidden Action | Retry Limit | Email | Stop Status |
| --- | --- | --- | --- | --- | --- | --- |
| CDP_UNREACHABLE | `127.0.0.1:9222` refused `/json/version` | Launch or attach Chrome with remote debugging, then verify `/json/version` | Kill user Chrome processes | 1 bootstrap | no | `CDP_SESSION_UNAVAILABLE` |
| AUTH_OR_CONSENT_WALL | Login, auth, or consent markers on page | Keep browser open, email user, wait for manual action, poll resume | Click consent/login or enter credentials | 0 automation retries | yes | `WAITING_FOR_HUMAN_ACTION` |
| HUMAN_VERIFICATION_REQUIRED | CAPTCHA, "I am human", human verification markers | Keep browser open, email user, wait for manual action | Click verification checkbox or solve CAPTCHA | 0 automation retries | yes | `WAITING_FOR_HUMAN_ACTION` |
| TWO_FACTOR_REQUIRED | 2FA marker or secondary auth screen | Email user and wait | Enter 2FA code | 0 automation retries | yes | `WAITING_FOR_HUMAN_ACTION` |
| CHATGPT_CONVERSATION_TOO_LONG | `message_count_sent >= 35` | Rotate to next available discussion, bootstrap before send | Send to exhausted discussion | 0 | if pool exhausted | `CHATGPT_POOL_EXHAUSTED` |
| CHATGPT_DISCUSSION_NOT_BOOTSTRAPPED | `bootstrap_sent=false` | Send compact bootstrap and increment counter | Send normal prompt first | 1 | no | `BOOTSTRAP_REQUIRED` |
| EMAIL_SECRET_CACHE_MISSING | No env password and no DPAPI cache | Prompt once unless `NoPrompt`, then store encrypted cache | Print or commit password | 1 | no | `EMAIL_SECRET_CACHE_MISSING` |
| OPERATOR_PROMPT_LEAK | Script asks for paths or URL/counter interactively | Fail test and route through resolver/state | Ask operator for low-level paths | 0 | no | `OPERATOR_PROMPT_LEAK_DETECTED` |
| UPLOAD_ATTACHMENT_NOT_CONFIRMED | File input set but no attachment signal | Stop before send and report capability | Send text-only visual prompt | 0 | no | `CHATGPT_ATTACHMENT_NOT_CONFIRMED` |
| JSON_INVALID | Judge output fails schema/contract validation | One JSON-only correction maximum | Clamp scores or accept placeholder JSON | 1 | no | `JSON_INVALID` |
| SESSION_CLOSED | CDP target/page disappears | Safe reattach once; if auth-related, email user | Loop indefinitely or kill browser | 1 | conditional | `SESSION_CLOSED` |
| PAGE_NOT_EXPECTED_DISCUSSION | Current URL does not match active discussion | Navigate to active URL if safe; otherwise email user | Print private URL or use wrong discussion | 1 | conditional | `PAGE_NOT_EXPECTED_DISCUSSION` |
| MESSAGE_SEND_FAILED | Prompt not submitted or no response | Retry once, then stop with reason | Keep retrying | 1 | no | `MESSAGE_SEND_FAILED` |
| GEMINI_DISABLED_NO_URL | Gemini mode requested without URL | Mark Gemini disabled or request setup | Block ChatGPT path | 0 | optional | `GEMINI_DISABLED_NO_URL` |
