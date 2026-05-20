# Web Visual Recovery Rule

A20BG adds one universal browser rule for live web supervisors:

**Try once, screenshot, reason from visible UI, revise once, then park and fallback.**

The rule applies whenever Codex uses a website, browser, GUI, or web app for NeuroChess supervision.

## Protocol

1. Try the obvious safe action once.
2. If it fails, stalls, or returns an ambiguous UI state, stop selector retries.
3. Capture the current service window screenshot externally.
4. Write a short visible UI analysis.
5. Choose one revised action from the screenshot.
6. If the revised action fails, capture the blocker, park the lane, send ntfy if human/account action is relevant, and continue with local OMEGA fallback.

No browser verdict is valid without screenshot evidence.

## Separate Service Windows

ChatGPT and Gemini must never share a browser profile, browser context, or CDP endpoint.

| Lane | Profile | CDP port |
| --- | --- | --- |
| ChatGPT Web | `ops/autopilot/local/browser_profiles/chatgpt/` | `9222` |
| Gemini Web | `ops/autopilot/local/browser_profiles/gemini/` | `9223` |

If Gemini is seen on the ChatGPT port, or ChatGPT is seen on the Gemini port, the run stops that lane with `SHARED_BROWSER_PROFILE_FORBIDDEN`.

## Recovery Event Shape

Each recovery event is written under the external artifact root:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\web_visual_recovery\A20BG\`

```json
{
  "service": "chatgpt|gemini|other",
  "action_attempted": "...",
  "failure_or_ambiguity": "...",
  "screenshot_before": "...",
  "visible_ui_analysis": [
    "I can see ...",
    "I cannot see ...",
    "The likely next action is ..."
  ],
  "revised_action": "...",
  "result": "success|parked|failed|fallback_used"
}
```

## Forbidden Inputs

The recovery rule forbids final browser conclusions from:

- full body text alone;
- hidden DOM text;
- old conversation history;
- old logs;
- guessed selectors;
- repeated blind click/type attempts.

Visible UI evidence comes first. DOM and locators may confirm a visible control, but they do not replace the screenshot.

## Fallback

If a web lane fails or requires human action, it is parked. OMEGA continues locally. Web supervisors remain advisory and never override Mission Doctor, V1 boundaries, or safety rules.
