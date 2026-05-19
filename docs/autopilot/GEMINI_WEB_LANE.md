# Gemini Web Lane

Mission: A20BC Gemini 3.5 Flash Extended Web Lane and Visual Judge Smoke.

## Purpose

The Gemini Web lane is an optional zero-cost visual supervisor for NeuroChess.
It is allowed to critique isolated screenshots, detect visual weirdness, review
board readability, and propose advisory patch directions.

OMEGA and Mission Doctor remain authoritative. Gemini never blocks local
autonomy and is never the sole source of truth.

## Entry Points

- `ops/autopilot/gemini_web_lane_adapter.ps1`
- `ops/autopilot/gemini_model_selector.ps1`
- `ops/autopilot/gemini_visual_packet_smoke.ps1`

The adapter supports:

- `Status`
- `HealthCheck`
- `Open`
- `ClassifyPage`
- `SelectModel`
- `SendTextSmoke`
- `SendVisualPacket`
- `ParkLane`
- `DryRun`

## Local Config

Tracked example:

`ops/autopilot/gemini_web_lane.local.example.json`

Optional real config:

`ops/autopilot/local/gemini_web_lane.local.json`

The real config is gitignored and must not contain tokens, cookies, passwords,
or private account data. If it is absent, the adapter uses:

`https://gemini.google.com/app`

## Current UI Truth

Gemini uses the Browser State Truth doctrine:

- current visible composer beats historical body text;
- auth or human-action states require current foreground evidence;
- body/history text alone cannot trigger a blocker classification;
- screenshots and targeted DOM probes are external artifacts only.

## Visual Evidence

Visual packet smoke uses one isolated screenshot. It rejects contact sheets,
collages, sprite sheets, and tiny multi-up summaries as primary evidence.

If no isolated screenshot exists, the visual lane reports
`VISUAL_EVIDENCE_NOT_FOUND` and local fallback continues.

## Safety

The Gemini Web lane does not:

- call Gemini API;
- call OpenAI API;
- ask for API keys or billing;
- enter credentials;
- solve CAPTCHA, 2FA, consent, or human verification;
- print private URLs, cookies, tokens, ntfy topic, or secrets;
- commit local profile, runtime, screenshot, or QA artifact files.

## Result Semantics

- `GEMINI_3_5_FLASH_EXTENDED_WEB_LANE_READY`: composer usable and preferred
  model/mode visible.
- `GEMINI_WEB_LANE_READY_MODEL_NOT_EXACT`: composer usable, but exact model or
  reasoning mode was not visible.
- `GEMINI_WEB_LANE_AUTH_REQUIRED_PARKED`: current UI requires manual action.
- `GEMINI_WEB_LANE_PAGE_NOT_USABLE`: current UI could not prove a usable
  composer.
- `GEMINI_WEB_LANE_NOT_CONFIGURED`: no browser/CDP or config route is available.
- `GEMINI_WEB_LANE_PARTIAL_NEEDS_SECOND_PASS`: partial smoke, not enough for a
  ready verdict.
- `GEMINI_WEB_LANE_FAILED`: unsafe or failed state.
