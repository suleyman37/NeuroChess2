---
name: neurochess-react-performance-review
description: Use this skill for NeuroChess React, TypeScript, and Vite frontend quality reviews focused on component boundaries, render performance, state shape, desktop responsiveness, and safe screenshot behavior.
---

# NeuroChess React Performance Review

Use this skill for frontend quality review on React/TypeScript/Vite branches.
It adapts safe ideas from audited React and composition skills without
installing external packages.

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

## Desktop Performance Rule

NeuroChess frontend is PC / desktop-first, not mobile-first. Board
interactions, side panels, keyboard/mouse controls, and analysis context must
stay responsive at 1366px, 1440px, and 1920px desktop widths.

## Review Checklist

Check:

- component boundaries;
- unnecessary re-renders;
- useEffect cascades;
- state locality;
- derived state risks;
- stable props where needed;
- accessibility states;
- loading, empty, error, disabled, hover, focus, and active states;
- whether splitting a huge component improves clarity;
- bundle and render performance awareness;
- layout stability during board interaction;
- screenshot behavior.

## Constraints

- No dependency install without explicit mission approval.
- No shadcn package or component install unless the mission explicitly
  authorizes it.
- No broad frontend refactor at night.
- No package file edits unless explicitly allowed.

React quality is judged by tests, build, typecheck, and screenshot behavior, not
by abstract cleanliness.
