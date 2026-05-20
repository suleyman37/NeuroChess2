# MCP Playwright Screenshot-First Browser Control

A20BF changes the Web-lane rule from selector-first to screenshot-first, with
one additional identity rule:

`CURRENT SERVICE WINDOW SCREENSHOT > visible UI reasoning > targeted locator confirmation > historical text`

ChatGPT and Gemini must not share one browser page, profile, context, or CDP
endpoint. ChatGPT uses the dedicated ChatGPT profile/window on CDP `9222`.
Gemini uses the dedicated Gemini profile/window on CDP `9223`.

## Required Observation

Each ChatGPT or Gemini check writes a JSON observation with:

- service
- screenshot path
- service-specific CDP port
- dedicated window/profile status
- visible UI summary
- composer status
- model selector status
- upload control status
- foreground blocker status
- current UI verdict
- reasoning from screenshot
- `dom_used_only_as_confirmation: true`

DOM, accessibility snapshots, or locators can confirm a visible control. They do
not decide the current page state alone.

## Forbidden Conclusions Without Screenshot

- `PAGE_USABLE`
- `HUMAN_ACTION_REQUIRED`
- `MODEL_SELECTOR_NOT_FOUND`
- `UPLOAD_UNAVAILABLE`
- `UPLOAD_AVAILABLE`
- `COMPOSER_NOT_FOUND`
- `WRONG_ACCOUNT_OR_PLAN`
- `VISUAL_PACKET_SENT`

If the screenshot is missing, return `MCP_SCREENSHOT_REQUIRED`.
If MCP Playwright is unavailable, return `MCP_PLAYWRIGHT_UNAVAILABLE`.
If a service is checked on the other service's CDP port, return
`SHARED_BROWSER_PROFILE_FORBIDDEN`.

## Gemini Visual Packet Rule

Gemini is a visual judge only when a dedicated Gemini-window screenshot shows an
attached image or confirmed upload preview. Text smoke or composer usability is
not visual supervision.

A20BF proved the safe path:

- Gemini screenshot showed the current UI was usable.
- The visible plus/import control opened an import menu.
- The file chooser attached one isolated screenshot.
- The visual prompt was sent only after attachment confirmation.
- The response was normalized into a visual Decision Packet.

## Safety

No credentials, cookies, tokens, private URLs, account emails, account details,
or ntfy topics are logged. Login, consent, CAPTCHA, 2FA, and human verification
screens are not clicked or bypassed.
