# Gemini Model Selection Protocol

Mission: A20BC Gemini 3.5 Flash Extended Web Lane and Visual Judge Smoke.

## Preferred Target

Preferred model:

`Gemini 3.5 Flash`

Preferred reasoning mode:

`Extended`, `Thinking`, `Deep reasoning`, or a visibly equivalent mode.

## Selection Rules

The adapter may only claim exact selection when the model or mode is visible in
the current Gemini Web UI.

It must not hardcode a brittle single label. It records redacted visible labels
that match model or reasoning terms such as Gemini, Flash, Pro, Thinking,
Extended, Deep, or equivalent French UI terms.

If the exact model is unavailable, it reports:

`GEMINI_3_5_FLASH_NOT_VISIBLE`

If the selector itself is unavailable, it reports:

`GEMINI_MODEL_SELECTOR_NOT_FOUND`

If a different visible model is usable, the lane may proceed as:

`GEMINI_WEB_LANE_READY_MODEL_NOT_EXACT`

## Payment Boundary

The model selector must not:

- click upgrade or subscription prompts;
- request billing;
- call paid APIs;
- imply a plan contains a model that is not visible;
- fabricate Extended or Thinking mode.

## Output

`ops/autopilot/gemini_model_selector.ps1` writes structured JSON with:

- selector status;
- exact model visibility;
- Extended/Thinking visibility;
- selected model/mode;
- redacted visible labels;
- zero-cost confirmation.

No private account details, URLs, cookies, tokens, or secrets are logged.
