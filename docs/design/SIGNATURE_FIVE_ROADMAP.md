# Signature Five Roadmap

Status: A20AR selected, not tripled, not integrated, not promoted.

## Selected Components

### sacred_board_chamber

- Current status: `STATUS_1_PROBED`
- Marker: `MARKED_FOR_TRIPLED_NEXT`
- Next target route: `/app?visualProbe=sacred_board_chamber&evidence=primary`
- First tripled variant mission: `A20AS_TRIPLED_VARIANTS_FOR_TOP_2_SIGNATURES`
- Key risks: chamber atmosphere can crowd the board if variants add too much frame density.
- Required screenshots: primary, main surface, board crop, detail frame crop.
- Success criteria: board remains undistorted, atmosphere stays outside legal squares, one variant becomes clearly NeuroChess-specific.
- Integration risk: medium, because it may become the visual shell around real Review/Practice boards.

### decision_feedback_language

- Current status: `STATUS_1_PROBED`
- Marker: `MARKED_FOR_TRIPLED_NEXT`
- Next target route: `/app?visualProbe=decision_feedback_language&evidence=primary`
- First tripled variant mission: `A20AS_TRIPLED_VARIANTS_FOR_TOP_2_SIGNATURES`
- Key risks: any pre-attempt line, glow, or arrow becomes a spoiler.
- Required screenshots: before state, committed state, post-feedback state, board crop.
- Success criteria: no hint before attempt, trace appears only after grading, board remains readable.
- Integration risk: medium-high, because feedback semantics must match backend-authoritative grading.

### critical_moment_sigil

- Current status: `STATUS_1_PROBED`
- Marker: selected for later variants
- Next target route: `/app?visualProbe=critical_moment_sigil&evidence=primary`
- First tripled variant mission: after top-two variants are judged.
- Key risks: can become a decorative logo if not tied to moment selection.
- Required screenshots: primary, sigil detail, Review moment context mock.
- Success criteria: mark communicates importance without raw criticality or engine internals.
- Integration risk: low-medium, because it can live outside the board.

### decision_pressure_field

- Current status: `STATUS_1_PROBED`
- Marker: selected for later variants
- Next target route: `/app?visualProbe=decision_pressure_field&evidence=primary`
- First tripled variant mission: after top-two variants are judged.
- Key risks: pressure can become an eval bar or best-move hint if color/position semantics drift.
- Required screenshots: primary, board crop, pressure rail detail, no-spoiler state.
- Success criteria: pressure stays peripheral and never implies best move or outcome.
- Integration risk: medium, because it sits near the board during attempts.

### memory_cabinet

- Current status: `STATUS_1_PROBED`
- Marker: selected, needs stronger variants
- Next target route: `/app?visualProbe=memory_cabinet&evidence=primary`
- First tripled variant mission: after top-two variants are judged.
- Key risks: current form may read as generic cards unless variants add chess-specific memory structure.
- Required screenshots: primary, card detail, revision-state context mock.
- Success criteria: revision objects feel specific to remembered chess patterns without fake memory claims.
- Integration risk: low-medium, because it can remain in revision/return surfaces.

## Not Yet Marked

No selected component is `STATUS_2_TRIPLED`.

No selected component is `STATUS_3_VOTED`.

No selected component is `STATUS_4_INTEGRATED`.

No selected component is `STATUS_5_PROMOTED`.

## Next Mission

`A20AS_TRIPLED_VARIANTS_FOR_TOP_2_SIGNATURES`
