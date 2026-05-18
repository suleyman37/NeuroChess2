# NeuroChess Visual Failure Gallery

The Failure Gallery stores what went wrong so the system can detect similar
problems earlier.

## A20H / A20H2

- what failed: board geometry looked distorted, squares appeared non-uniform,
  artifacts overlapped the board, and the UI felt prototype/dev-HUD heavy.
- why it matters: a stylish chess UI is useless if the board is hard to read.
- detect earlier: strict screenshot audit for geometry, board pollution, and
  piece readability.
- avoid: top-down board first; no stage effects on legal squares.
- classification: hard block for product-grade.

## A20J

- what failed: Feedback Arena was selected too easily, Gemini was non-decisive,
  and autonomous scoring was permissive.
- why it matters: provider praise cannot override visual hard gates.
- detect earlier: require concrete verdicts and hard-gate proof.
- avoid: never trust placeholder visual responses.
- classification: hard block until reworked.

## A20J3

- what failed: safer board, but too light and still not revolutionary; pieces
  were letter discs and variants felt similar.
- why it matters: safe is not enough for the NeuroChess North Star.
- detect earlier: premium/art-direction and public teaser gates.
- avoid: pair safety with identity and emotional pull.
- classification: visual debt.

## A20L

- what failed: improved candidate, but still internal prototype; visible side
  controls and state panels remain; post-feedback language is not final
  public-grade.
- why it matters: North Star candidate is not public-ready.
- detect earlier: public screenshot shame test.
- avoid: public-ready claims without human review and screenshot proof.
- classification: visual debt, not block.

## A20N

- what failed: rehearsal was conservative; no visual/browser objective ran.
- why it matters: process can be safe without proving visual iteration.
- detect earlier: require screenshot-to-patch evidence for 18/20 claims.
- avoid: claiming visual competence from docs alone.
- classification: system limitation.

## A20P

- what failed: the first teaser patch made the route cleaner, but the first
  smoke pass exposed a board-size regression at 1366px; the design could have
  become a nicer screenshot while quietly weakening the board artifact.
- why it matters: public framing cannot starve the sacred board. A teaser mode
  that hides prototype chrome still fails if the board stops feeling central.
- detect earlier: run board geometry and screenshot checks at 1366, 1440, and
  1920 before accepting the visual delta.
- avoid: solving prototype residue by compressing the board; hide weak chrome
  and then reallocate space back to the board.
- classification: meaningful improvement after fix, with public-readiness debt.
