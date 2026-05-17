---
name: neurochess-learning-loop-accelerator
description: Use this skill when a NeuroChess mission should accelerate chess improvement through active attempts, feedback, repetition, transfer verification, and real-game evidence.
---

# NeuroChess Learning Loop Accelerator

Use this skill when a mission affects learning value, review, practice,
training, feedback, onboarding, player progress, or prioritization of
player-facing work. It keeps NeuroChess focused on chess improvement rather
than passive analysis or surface UI.

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

## Potential Unlock Loop

Use the Potential Unlock Loop:

Detect -> Isolate -> Try -> Judge -> Explain -> Replay -> Re-expose -> Verify
Transfer -> Adapt

Every mission should name which step it advances. Strong missions reduce the
time from "I saw it" to "I can play it in a real game."

## Learning Rules

- Prefer learn-by-doing.
- Require active effort before explanation when possible.
- Give feedback after the player's attempt.
- Create repetition and re-exposure.
- Verify transfer using real-game or realistic decision evidence.
- Adapt the next step to the player's observed weakness.
- Use player-specific real-game evidence when available.

## Drift Checks

Avoid:

- passive reading as the default learning mode;
- generic puzzle-trainer drift;
- Stockfish-analyzer-only drift;
- UI polish that does not improve a learning step;
- fake progress;
- fake XP/rank/Transfer claims;
- explanations that remove the need for the player to try.
