# NeuroChess Visual Training Gym

The Visual Training Gym defines drills that the automation must pass before it
can be trusted at 18/20 visual competence.

## Drill 1 - Sacred Board Drill

- purpose: protect the board from tempting effects.
- input evidence: screenshot with decorative effects near the board.
- failure symptoms: fog, particles, diagonals, UI labels, or artifacts entering
  the board core.
- pass criteria: board remains strict, readable, top-down, and unpolluted.
- patch examples: move effects to BoardFrame or SurroundingStage.
- hard stops: board pollution or distorted squares.

## Drill 2 - No-Hint Tension Drill

- purpose: increase tension without revealing the answer.
- input evidence: `try_before_feedback` state.
- failure symptoms: arrow, line, destination glow, target square, or candidate
  path.
- pass criteria: drama outside board, no hint on board.
- patch examples: use rim compression or stage lighting outside the board.
- hard stops: pre-feedback move implication.

## Drill 3 - Delete-First Drill

- purpose: improve by removing noise before adding elements.
- input evidence: busy UI.
- failure symptoms: many panels, labels, badges, weak hierarchy.
- pass criteria: fewer elements and stronger composition.
- patch examples: collapse debug panels, remove redundant labels.
- hard stops: adding decorative effects before deleting noise.

## Drill 4 - Rich World Drill

- purpose: enrich safe but empty UI.
- input evidence: clean but forgettable board stage.
- failure symptoms: sterile stage, no identity, board feels like a flat widget.
- pass criteria: stronger identity outside the board, no pollution.
- patch examples: surrounding architecture, memory rails, material depth.
- hard stops: effect crosses board core.

## Drill 5 - Anti-Generic SaaS Drill

- purpose: make the screen unmistakably NeuroChess.
- input evidence: dashboard-like cockpit.
- failure symptoms: generic cards, charts without action, blue-purple glow,
  could-be-any-product layout.
- pass criteria: board-centered tactical chamber with clear learning state.
- patch examples: replace metrics grid with decision context around board.
- hard stops: passive analytics dashboard.

## Drill 6 - Awwwards Translation Drill

- purpose: translate craft without making a website.
- input evidence: award-style inspiration.
- failure symptoms: scroll hero, spectacle, hidden controls.
- pass criteria: desktop app remains usable and chess clarity wins.
- patch examples: use composition and material craft, not page theatrics.
- hard stops: landing page shell.

## Drill 7 - Feedback Dignity Drill

- purpose: make miss feedback corrective, not humiliating.
- input evidence: `feedback_miss` state.
- failure symptoms: giant X, punishment, shame language.
- pass criteria: reorientation, calm correction, inspectable trace.
- patch examples: course-correction path and soft state shift.
- hard stops: aggressive failure mark.

## Drill 8 - Piece Identity Drill

- purpose: improve pieces without losing recognition.
- input evidence: prototype pieces.
- failure symptoms: letter discs, unreadable silhouettes, external assets.
- pass criteria: readable, premium, distinctive, code-native or internal.
- patch examples: styled Unicode or internal SVG silhouettes.
- hard stops: unreadable pieces.

## Drill 9 - Motion Meaning Drill

- purpose: ensure animation communicates learning state.
- input evidence: state transition.
- failure symptoms: random motion, looping glow, distracting particles.
- pass criteria: motion explains observe, try, feedback, miss, or replay.
- patch examples: short stabilization, contained tension, replay path.
- hard stops: motion that delays training or implies a move.

## Drill 10 - Public Teaser Drill

- purpose: classify screenshots honestly.
- input evidence: first screenshot.
- failure symptoms: public-ready claim without proof, visible dev labels, weak
  product truth.
- pass criteria: honest classification and evidence path.
- patch examples: remove test chrome, improve first viewport, add caveat.
- hard stops: public claim without screenshots.
