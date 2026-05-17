# NeuroChess 3D Renderer Architecture

A20F recommends a code-native renderer architecture without installing packages.

Candidate stack:

- React and TypeScript remain the application layer.
- React Three Fiber is the candidate 3D renderer layer.
- Drei is an optional helper library candidate.
- React Postprocessing is an optional effects candidate.
- Theatre.js is an optional controlled animation/timeline candidate.
- WebGPU or TSL is DEV-only sandbox territory later.

Why this direction:

- compatible with React state;
- componentized;
- code-reviewable;
- screenshot-testable;
- friendly to Codex automation;
- avoids manual Spline export dependency;
- avoids Unity/Godot engine integration.

## Layering

1. Product state remains authoritative outside the renderer.
2. A Scene Language object describes visual intent.
3. A Board Stage adapter maps product state to scene language.
4. Renderer components consume scene language.
5. Effects are gated by allowed/forbidden policy.
6. Screenshot and Visual Court checks prove the board remains readable.

## Boundary

Renderer code must not own chess rules, scoring, training decisions, due dates,
Practice writes, XP/rank/Transfer, or backend authority.

The renderer is visual feedback, not product truth.
