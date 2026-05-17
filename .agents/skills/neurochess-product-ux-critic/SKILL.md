---
name: neurochess-product-ux-critic
description: Use this skill when judging whether a NeuroChess mission improves the real desktop player experience, reduces friction, clarifies next action, or avoids novelty without value.
---

# NeuroChess Product UX Critic

Use this skill before product-facing missions, UI planning, onboarding work,
mission prioritization, and morning review when the question is whether the
work improves the player experience instead of merely adding machinery.

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

## Product Critique

Ask:

- What player problem is this solving before any tool novelty?
- What real friction is reduced?
- What should the player do now?
- What is the first 30 seconds aha moment?
- Does this create progress over feature count?
- Does it improve a real-game learning loop?
- Does it keep cognitive load low enough for a chess decision?
- Does it make feedback truthful and actionable?

Every product mission should reduce a named friction or improve the Potential
Unlock Loop.

## Desktop UX Checks

NeuroChess is PC / desktop-first, not mobile-first. Critique for:

- board-centered flow;
- visible decision context;
- mouse and keyboard use;
- large readable panels;
- clear primary action;
- no mobile-first drift;
- no phone-sized decision layout as the primary target.

## UX Evidence

Look for:

- user journey friction;
- onboarding clarity;
- empty, loading, and error state quality;
- decision-page clarity;
- truthful CTA labels;
- whether the player can tell what happened and what to do next.

## Reject Patterns

Reject or quarantine:

- dark-pattern retention;
- fake streak or fake progress framing;
- fake neuroscience;
- fake Elo, XP, rank, or Transfer claims;
- novelty without player value;
- broad "make it better" work without evidence;
- product claims that are not supported by screenshots, tests, or backend truth.
