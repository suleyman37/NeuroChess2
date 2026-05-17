# NeuroChess Code-Native 3D Board Stage

A20F defines the architecture for a code-native 3D Board Stage System. It does
not implement product frontend 3D, install packages, add assets, or replace any
route.

Core doctrine:

> The 3D serves the chess decision. If 3D reduces board readability, it must
> recede.

NeuroChess must not become a full game engine project. It must not depend on
Spline or manual 3D exports. The long-term direction is procedural,
code-reviewable, screenshot-testable 3D that Codex can understand, edit,
validate, and audit.

The chessboard remains:

- central;
- stable;
- readable;
- precise;
- preferably 2D or orthographic for learning clarity.

The 3D layer may provide:

- atmosphere;
- state feedback;
- decision tension;
- replay traces;
- memory fragments;
- visual identity.

It may not provide fake progress, fake neuroscience, fake Elo, fake
XP/rank/Transfer, or decorative spectacle without learning meaning.

## System Pieces

- `NEUROCHESS_SCENE_LANGUAGE.md`: declarative JSON contract for scenes.
- `NEUROCHESS_3D_RENDERER_ARCHITECTURE.md`: code-native renderer plan.
- `NEUROCHESS_3D_VISUAL_STATE_MACHINE.md`: allowed learning states.
- `NEUROCHESS_VISUAL_PHYSICS.md`: state-to-visual response mapping.
- `NEUROCHESS_3D_PERFORMANCE_BUDGET.md`: FPS, effects, and screenshot budget.
- `NEUROCHESS_3D_ACCESSIBILITY_FALLBACK.md`: reduced motion and 2D fallback.
- `NEUROCHESS_3D_ALLOWED_FORBIDDEN_EFFECTS.md`: effect allow/block list.
- `NEUROCHESS_3D_DEV_ONLY_PROTOTYPE_PLAN.md`: future A20G sandbox.
- `NEUROCHESS_3D_EXTERNAL_SKILLS_AUDIT_PLAN.md`: future external-skill audit.

## Screenshot And Visual Audit Strategy

Future 3D work must produce screenshot evidence at desktop widths first:

- 1366px;
- 1440px;
- 1920px when available;
- reduced-motion mode;
- low-quality fallback mode;
- failure screenshot if the scene does not render or obscures the board.

Gemini Visual Court should be asked whether the board remains central,
readable, and truthful, whether any fake progress or fake science claims are
present, and whether the 3D improves learning state clarity rather than hiding
it.

## Readiness

A20F only creates architecture and validation machinery. Live 3D remains
disabled. A future A20G may create a DEV-only prototype if it preserves the
board as the learning stage and passes visual proof.
