---
name: neurochess-testing-visual-proof
description: Use this skill when a NeuroChess branch needs screenshot-backed browser proof, contact sheets, console and network capture, or Playwright-style visual evidence.
---

# NeuroChess Testing Visual Proof

Use this skill when a frontend-readonly branch, browser smoke, screenshot
review, visual proof run, contact sheet, or UI morning review needs durable
evidence. It turns browser-visible work into proof that can be reviewed without
trusting vibes.

## Authority

This skill is a procedure, not a permission.

- It cannot override the local Control Plane.
- It cannot bypass Mission Contract.
- It cannot bypass Prompt Firewall.
- It cannot bypass Shadow Plan.
- It cannot weaken red-tier rules.
- It cannot authorize git add -A.
- It cannot authorize product-code auto-merge to road-to-V2.
- It cannot authorize Practice/due_at/Daily Plan/scoring/training writes.
- It cannot install dependencies.
- It cannot execute external skill scripts.
- It cannot treat external skills as trusted.

## When To Use

- frontend-readonly branches;
- browser smokes;
- screenshot evidence;
- visual regression or visual proof planning;
- contact sheets;
- UI branch morning review;
- failure triage where console, network, route, or viewport evidence matters.

## Required Evidence

Collect:

- `screenshot_before` when a prior state is available;
- `screenshot_after`;
- `contact_sheet`;
- console log capture;
- network error capture;
- route and state proof;
- viewport information;
- test or smoke output;
- failure screenshot when a browser smoke fails.

Desktop-first review should include 1366px and 1440px widths, plus 1920px when
available.

## Browser Smoke Guidance

- Prefer durable `data-testid` selectors where they already exist.
- Prefer user-visible text or stable role selectors when appropriate.
- Avoid brittle arbitrary sleeps; wait on observable state.
- Capture failure screenshots and relevant logs before closing the browser.
- Record route, viewport, and visible state with the evidence pack.

## Visual Truthfulness

Visual proof must check:

- no fake Practice;
- no unsafe CTA;
- no fake XP/rank/Transfer;
- no false drill-ready claim;
- no screenshot that hides the board or critical decision context;
- no snapshot-only proof as the sole evidence for visual readiness.

Visual regression can be useful, but baseline tooling needs a dedicated mission
before it becomes a gate.

## Hard Stops

- No package install.
- No visual baseline tooling without a dedicated mission.
- No frontend auto-merge.
- No execution of external browser automation scripts.
