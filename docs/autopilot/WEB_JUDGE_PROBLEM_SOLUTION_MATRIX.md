# Web Judge Problem Solution Matrix

This matrix maps known ChatGPT/Gemini web-judge orchestration failures to safe actions.

| Status Code | Detection | Action | Forbidden Action | Retry Limit | Email | Stop Status |
| --- | --- | --- | --- | --- | --- | --- |
| CDP_UNREACHABLE | `127.0.0.1:9222` refused `/json/version` | Launch or attach Chrome with remote debugging, then verify `/json/version` | Kill user Chrome processes | 1 bootstrap | no | `CDP_SESSION_UNAVAILABLE` |
| AUTH_OR_CONSENT_WALL | Login, auth, or consent markers on page | Keep browser open, send ntfy iPhone alert, wait for manual action, poll resume | Click consent/login or enter credentials | 0 automation retries | Gmail fallback only if enabled | `WAITING_FOR_HUMAN_ACTION` |
| HUMAN_VERIFICATION_REQUIRED | CAPTCHA, "I am human", human verification markers | Keep browser open, send ntfy iPhone alert, wait for manual action | Click verification checkbox or solve CAPTCHA | 0 automation retries | Gmail fallback only if enabled | `WAITING_FOR_HUMAN_ACTION` |
| CAPTCHA_REQUIRED | CAPTCHA or challenge marker appears | Keep browser open, send ntfy iPhone alert, wait for manual action | Solve CAPTCHA or click verification controls | 0 automation retries | Gmail fallback only if enabled | `WAITING_FOR_HUMAN_ACTION` |
| TWO_FACTOR_REQUIRED | 2FA marker or secondary auth screen | Send ntfy iPhone alert and wait | Enter 2FA code | 0 automation retries | Gmail fallback only if enabled | `WAITING_FOR_HUMAN_ACTION` |
| CHATGPT_CONVERSATION_TOO_LONG | `message_count_sent >= 35` | Rotate to next available discussion, bootstrap before send; if no discussion remains, send ntfy alert requesting a new pool | Send to exhausted discussion | 0 | Gmail fallback only if enabled | `CHATGPT_POOL_EXHAUSTED` |
| CHATGPT_DISCUSSION_NOT_BOOTSTRAPPED | `bootstrap_sent=false` | Send compact bootstrap and increment counter | Send normal prompt first | 1 | no | `BOOTSTRAP_REQUIRED` |
| EMAIL_PREFLIGHT_FAILED | Gmail SMTP preflight fails while ntfy is ready | Record Gmail fallback unavailable and continue if ntfy works | Block live web flow on Gmail when ntfy works | 0 | fallback disabled by default | `GMAIL_FALLBACK_UNAVAILABLE` |
| ALERT_DELIVERY_FAILED | ntfy and enabled fallbacks failed | Write local runtime alert event and stop live action | Proceed to human-action-required web work without alert delivery | 0 | fallback only if enabled | `ALERT_DELIVERY_FAILED` |
| OPERATOR_PROMPT_LEAK | Script asks for paths or URL/counter interactively | Fail test and route through resolver/state | Ask operator for low-level paths | 0 | no | `OPERATOR_PROMPT_LEAK_DETECTED` |
| UPLOAD_ATTACHMENT_NOT_CONFIRMED | File input set but no attachment signal | Stop before send and report capability | Send text-only visual prompt | 0 | no | `CHATGPT_ATTACHMENT_NOT_CONFIRMED` |
| JSON_INVALID | Judge output fails schema/contract validation | One JSON-only correction maximum | Clamp scores or accept placeholder JSON | 1 | no | `JSON_INVALID` |
| SESSION_CLOSED | CDP target/page disappears | Safe reattach once; if auth-related, email user | Loop indefinitely or kill browser | 1 | conditional | `SESSION_CLOSED` |
| PAGE_NOT_EXPECTED_DISCUSSION | Current URL does not match active discussion | Navigate to active URL if safe; otherwise email user | Print private URL or use wrong discussion | 1 | conditional | `PAGE_NOT_EXPECTED_DISCUSSION` |
| MESSAGE_SEND_FAILED | Prompt not submitted or no response | Retry once, then stop with reason | Keep retrying | 1 | no | `MESSAGE_SEND_FAILED` |
| GEMINI_DISABLED_NO_URL | Gemini mode requested without URL | Mark Gemini disabled or request setup | Block ChatGPT path | 0 | optional | `GEMINI_DISABLED_NO_URL` |
| GEMINI_COMPOSER_VISIBLE_PAGE_USABLE | Gemini composer is visible, enabled, and unblocked in current UI | Classify `PAGE_USABLE`; allow bounded text or visual smoke | Classify from historical body text alone | 0 | no | `PAGE_USABLE` |
| GEMINI_MODEL_NOT_AVAILABLE_OR_NOT_IN_PLAN | Gemini Web is usable but Gemini 3.5 Flash or Extended/Thinking is not visible | Record visible model labels, use best visible model only if safe, do not attempt payment | Pretend exact model was selected or ask for billing | 0 | optional | `GEMINI_WEB_LANE_READY_MODEL_NOT_EXACT` |
| GEMINI_UPLOAD_UNAVAILABLE | Gemini composer is usable but no safe image upload path is detected | Skip visual packet, keep text/local fallback, record parked visual lane | Claim screenshot review from a text-only prompt | 0 | optional | `GEMINI_UPLOAD_UNAVAILABLE` |
| FALSE_POSITIVE_HUMAN_ACTION_REQUIRED | Blocker words appear only in historical conversation text while composer is visible | Ignore history text, capture screenshot/DOM evidence, classify `PAGE_USABLE`, continue | Send repeated ntfy alerts or park from body text alone | 0 | no | `PAGE_USABLE` |
| PAGE_USABLE_BUT_ORCHESTRATOR_WAITING | Composer is visible/enabled while orchestrator is waiting for human action | Run composer-first `ResumeCheck`; map `PAGE_USABLE` to `RESUME_READY` | Keep waiting for non-existent user action | 1 | no | `RESUME_READY` |
| HISTORY_TEXT_BLOCKER_TERMS | Body text contains CAPTCHA/verification/bypass/auth/consent words outside a current blocker | Treat those words as historical unless active overlay/direct blocker evidence exists | Classify `HUMAN_ACTION_REQUIRED` from full body text alone | 0 | no | `PAGE_USABLE_OR_UNCLASSIFIED` |
