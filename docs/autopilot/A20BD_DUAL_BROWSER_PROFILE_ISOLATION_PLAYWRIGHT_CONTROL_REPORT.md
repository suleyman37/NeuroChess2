# A20BD Dual Browser Profile Isolation And Playwright Control Report

## 1. Mission Summary

A20BD created separate, gitignored browser profiles for ChatGPT Web and Gemini
Web, assigned dedicated CDP ports, and added screenshot-first Playwright visual
control before Web-lane verdicts.

Final verdict: `DUAL_BROWSER_PROFILES_READY_GEMINI_UPLOAD_UNAVAILABLE`

Recommended next mission:
`A20BE_GEMINI_UPLOAD_SECOND_PASS`

## 2. Why Dual Profiles Were Required

A20BC proved Gemini Web could open and pass a text smoke, but it did not prove
the correct account/model/visual lane. Sharing Chrome profile state risks using
the wrong Google account, wrong plan, or wrong model access. A20BD prevents that
by isolating ChatGPT and Gemini at profile and CDP layers.

## 3. ChatGPT Profile/CDP Status

- Profile: redacted dedicated ChatGPT profile under `ops/autopilot/local/**`
- CDP port: `9222`
- Profile gitignored: yes
- Runtime state gitignored: yes
- CDP reachable after launch: yes
- Process profile matched policy: yes
- Visual classification: `PAGE_USABLE`
- Smoke: message submitted, response text read, counter incremented; strict JSON
  was not returned, so this was treated as a bounded partial smoke, not a new
  ChatGPT readiness claim.

## 4. Gemini Profile/CDP Status

- Profile: redacted dedicated Gemini profile under `ops/autopilot/local/**`
- CDP port: `9223`
- Profile gitignored: yes
- Runtime state gitignored: yes
- CDP reachable after launch: yes
- Process profile matched policy: yes
- Visual classification: `PAGE_USABLE`
- Text smoke: `GEMINI_TEXT_SMOKE_PASS`

## 5. Proof That Profiles Are Isolated

`browser_profile_manager.ps1` enforces different profile directories and
different CDP ports. It also refuses to treat an already-open port as ready
unless the browser process command line matches the expected dedicated profile.

## 6. Playwright/MCP Visual Control Summary

MCP Playwright was not the active control surface in this run. Native Playwright
over CDP was used as the fallback. It captured external screenshots and redacted
DOM probes before classification for both services.

## 7. ChatGPT State Result

ChatGPT current UI showed a visible, enabled composer and no foreground blocker.
The classifier returned `PAGE_USABLE` even though the send button was initially
disabled before text entry; prompt submission was considered possible once input
is inserted.

## 8. Gemini State Result

Gemini current UI showed a visible, enabled composer and no foreground blocker.
The classifier returned `PAGE_USABLE`.

## 9. Gemini Model Selector Result

Model selector was not safely detected. Gemini 3.5 Flash and Extended/Thinking
mode were not visible in the captured current-UI signals. The lane remains usable
for text smoke but not exact-model certified.

## 10. Gemini Upload Control Result

Upload control was not visible. `gemini_visual_packet_smoke.ps1` selected an
isolated screenshot and rejected contact sheets, then returned
`GEMINI_UPLOAD_UNAVAILABLE`.

## 11. Text Smoke Results

- ChatGPT: submitted a safe test message and incremented the A-J counter after
  submission; response was text-read but not strict JSON.
- Gemini: `GEMINI_TEXT_SMOKE_PASS`; a normalized advisory Decision Packet was
  produced for text smoke.

## 12. Visual Smoke Results

Gemini visual packet smoke did not send an image because upload control was not
available. No visual Decision Packet was produced.

## 13. Ntfy Alert Result

No ntfy alert was sent because neither lane showed a foreground auth/human-action
blocker or account mismatch. Gemini upload unavailability was recorded as a
non-blocking lane limitation.

## 14. Integration With OMEGA/NeuroRelay

`external_judge_sre.ps1` recognizes isolated profile/account statuses and Gemini
model/upload statuses. `run_neurorelay_loop.ps1` recognizes A20BD artifacts and
recommends A20BE follow-up missions while keeping local fallback available.

## 15. What Remains For Gemini 3.5 Flash Exact Model

The Gemini lane needs a second pass that can safely inspect model-selection UI
without relying on broad body text and without changing account, plan, or billing
state.

## 16. What Remains For True ChatGPT+Gemini Overnight Run

Before a dual-supervisor true overnight run, Gemini must either expose a safe
upload control and produce one visual Decision Packet, or the run must explicitly
record Gemini as text-only/model-not-exact/visual-upload-unavailable.

## 17. No API Call Required

No Gemini API, OpenAI API, API key, billing setup, or paid service was used.

## 18. A21

A21 was not launched.

## 19. Night Mode

Night Mode was not launched.

## 20. Road Branch

`road-to-V2` was not pushed or merged.
