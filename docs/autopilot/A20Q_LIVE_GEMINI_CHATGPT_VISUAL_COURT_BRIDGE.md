# A20Q Live Gemini ChatGPT Visual Court Bridge

## Purpose

The Visual Court Bridge lets NeuroChess combine Gemini visual perception,
ChatGPT product/art-direction reasoning, Codex patch feasibility, hard-gate
vetoes, and Creative Director synthesis without making external judges final
authority.

The bridge exists because A20P proved that Codex plus offline visual training
can improve a real artifact, but the system still needs a safe way to import
or collect external visual critique before any 18/20 design automation claim.

## Modes

`OFFLINE_FIXTURE_MODE`

- default mode;
- uses fixture judge outputs only;
- no browser;
- no live ChatGPT;
- no live Gemini;
- validates, merges, selects a verdict, and generates the next prompt.

`MANUAL_PACKET_MODE`

- generates prompts, packets, and manual input templates;
- an operator can paste Gemini or ChatGPT outputs into files;
- the system validates files before merge;
- no automated sending.

`SAFE_LIVE_READONLY_MODE`

- optional and not required for mission success;
- may use only already approved session infrastructure;
- read-only prompt submission and response collection only;
- must stop on login, CAPTCHA, 2FA, consent, or human verification;
- no bypass and no credential automation.

## Default Mode

Default mode is `OFFLINE_FIXTURE_MODE`, with `MANUAL_PACKET_MODE` as the normal
human-operated bridge. Live mode is a future capability, not a dependency.

## Live Mode Restrictions

If live Gemini or ChatGPT requires human verification, login, CAPTCHA, 2FA,
consent, or manual "I am human" action:

`STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED`

The bridge must not bypass. The allowed fallback is `MANUAL_PACKET_MODE` or
`OFFLINE_FIXTURE_MODE`.

## Browser And CDP Restrictions

- no credential automation;
- no login automation;
- no CAPTCHA bypass;
- no consent bypass;
- no scraping account-private data;
- no raw cookies, tokens, or profile artifacts in logs;
- no automated claim that a live judge passed unless the JSON validates.

## Manual Packet Workflow

The bridge writes:

- `visual_court_packet.json`;
- `gemini_prompt.md`;
- `chatgpt_prompt.md`;
- `codex_patch_planner_prompt.md`;
- manual input JSON templates;
- merged summary;
- Creative Director verdict;
- next visual mission prompt.

An operator can run Gemini/ChatGPT manually, save the strict JSON outputs, and
rerun the bridge in `MANUAL_PACKET_MODE`.

## Evidence Requirements

Every visual court run needs:

- mission id;
- evidence path;
- screenshot or contact sheet references;
- hard-gate status;
- target visual level;
- judge output validation files;
- merged visual court summary;
- Creative Director verdict;
- safety report.

No screenshot evidence means no public-ready claim.

## Judge Output Validation

Judge outputs are rejected when they:

- omit required fields;
- return placeholder enum text;
- praise without concrete visible strengths and weaknesses;
- claim public readiness without screenshot references;
- ignore hard-gate failures;
- let Codex approve its own patch as revolutionary.

Missing judge input is `MISSING_INPUT`, not PASS.

## Placeholder Praise Rejection

Generic praise such as "looks great" or enum templates such as
`PASS_VISUAL|WARNING_VISUAL|BLOCK_VISUAL` are invalid. The bridge requires
visible details, concrete weaknesses, and explicit fatal defects when present.

## Hard-Gate Veto Rules

The following override Gemini, ChatGPT, Codex, and autonomous scoring:

- `BLOCK_CHESS_FIDELITY`;
- `BLOCK_STATE_SEMANTICS`;
- board pollution;
- pre-feedback hint;
- cheap UI block;
- generic glow overuse block;
- fake product claim.

## Conflict Resolution

When judges disagree, the Creative Director does not average opinions. It asks:

- did hard gates pass?
- are screenshots present?
- are objections concrete?
- does the direction improve product desire?
- does it preserve chess clarity?
- is the next safest action accept, patch, rework, abandon, or human review?

Conflicting judges should normally produce `patch` or `human_review_required`,
not blind accept.

## Creative Director Synthesis

Creative Director is final for art-direction synthesis but not final for
safety. It cannot override hard gates. It can choose:

- accept;
- patch;
- rework;
- abandon;
- human review;
- insufficient evidence.

## Next Mission Prompt Generation

Every bridge run must generate a next visual mission prompt with:

- objective;
- allowed paths;
- forbidden paths;
- exact stop conditions;
- evidence requirements;
- screenshot requirements;
- hard gates;
- validation commands;
- no road push;
- no merge.

## Safety Stops

Stop on:

- human verification;
- login/CAPTCHA/2FA/consent;
- hard-gate failure;
- missing screenshots for public-ready claim;
- provider placeholder praise;
- product data mutation risk;
- package mutation risk;
- road-to-V2 push or merge attempt.

## Competence Impact

A20P moved the system to 17/20. A20Q can move it to 17.5/20 if fixture and
manual bridge modes work without live judges. It can move to 18/20 only when
safe live or manually imported Gemini/ChatGPT outputs are validated and merged
on real A20P evidence.
