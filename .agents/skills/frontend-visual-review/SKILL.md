---
name: frontend-visual-review
description: Use this skill for NeuroChess frontend visual review, screenshot evidence, CTA truthfulness, desktop-first board-centered layouts, and branch readiness classification.
---

# Frontend Visual Review

Use this skill when frontend work needs visual evidence, screenshot review,
Visual Court/Gemini review, CTA truthfulness checks, or morning branch
classification.

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

## Desktop-First Rule

NeuroChess is PC / desktop-first, not mobile-first.

Optimize visual review for:

- desktop browser / PC experience;
- mouse and keyboard;
- chessboard-centered layouts;
- board plus visible panels;
- large readable decision context;
- high-information but controlled density;
- 1366px, 1440px, and 1920px desktop widths when available;
- stable layout during analysis;
- visible primary action;
- fast scanability;
- no mobile-first bottom navigation as the primary UX;
- no phone-sized UI as the primary target;
- no touch-only assumptions;
- no hidden critical actions behind mobile-style menus.

Mobile resilience is secondary, not the product goal.

## Required Evidence

Frontend branches require:

- screenshots;
- contact sheet;
- visual review brief;
- ChatGPT or Gemini Visual Court if configured;
- branch classification.

Desktop screenshot targets:

- 1366px width;
- 1440px width;
- 1920px width when available.

## Review Checks

Check:

- read-only clarity;
- CTA truthfulness;
- no fake Practice;
- no false "drill ready";
- no XP/rank/Transfer claims;
- visual hierarchy;
- board visibility;
- primary action clarity;
- keyboard/mouse expectations;
- loading, empty, error, disabled, hover, focus, and active states.

Every frontend branch must classify as one:

- `PASS_VISUAL`;
- `WARNING_VISUAL`;
- `BLOCK_VISUAL`;
- `NEEDS_REWORK`.

Unsafe Practice CTAs, false training readiness, or fake progress claims require
`BLOCK_VISUAL` or `NEEDS_REWORK`.
