# Agent Role And Permission Matrix

## CODEX - Production Integrator

Allowed:
- apply validated patches;
- run tests and validation;
- fix TypeScript/build failures;
- commit and push non-protected mission branches;
- enforce Git hygiene;
- reject unsafe proposals.

Forbidden:
- broad exploratory UI generation when Antigravity is the better sandbox;
- accepting self-reported risk without local validation;
- broad staging;
- protected-branch push or merge.

## ANTIGRAVITY - Sandbox Explorer

Allowed:
- low-risk DEV-only frontend prototypes;
- visual variant exploration;
- SVG/CSS/JSX experiments;
- isolated tests for created components;
- external screenshots;
- Patch Proposal Packs only.

Forbidden:
- official repo modification;
- commits or pushes;
- backend/package/DB changes;
- secrets, local/runtime, browser profile data;
- V1 product behavior changes;
- package installs;
- `road-to-V2`.

## GEMINI - Visual Critic

Allowed:
- analyze isolated screenshots;
- critique board readability, hierarchy, contrast, and weirdness;
- suggest next visual patches.

Forbidden:
- direct code integration;
- using contact sheets as primary proof;
- claiming visual review without image attachment.

## CHATGPT WEB - Strategy Critic

Allowed:
- product strategy critique;
- mission challenge;
- contradiction detection;
- architecture and risk review.

Forbidden:
- blocking the run;
- acting as final authority over deterministic safety gates.

## OMEGA - Local Arbiter

Allowed:
- route tasks;
- apply weighted scoring;
- enforce hard gates;
- park failed lanes;
- trigger local fallback;
- update Failure Ledger and Protocol Memory when needed.

Forbidden:
- inflating scores without proof;
- selecting non-pixel work during a pixel bottleneck.

## HUMAN / SULEYMAN - Optional Taste Arbiter

Allowed:
- final taste vote;
- aesthetics tie-breaker;
- emergency intervention via ntfy.

Forbidden:
- becoming required for autonomous progress.
