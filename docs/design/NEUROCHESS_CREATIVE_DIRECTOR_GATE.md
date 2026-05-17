# NeuroChess Creative Director Gate

Status: A20N rehearsal deliverable. This is a product/design gate, not a
runtime user approval dependency.

## Purpose

The Creative Director Gate prevents future autonomous visual work from drifting
into safe-but-forgettable chess UI. It turns the A20L North Star lesson into a
clear standard:

> A visual branch must protect chess truth first, then make the learning moment
> feel unmistakably NeuroChess.

This gate is mandatory for future board-stage, visual prototype, teaser, or
desktop cockpit missions before they can claim product-grade or North Star
value.

## Authority Limits

The gate cannot override:

- red-tier policy;
- Mission Contract;
- Shadow Plan;
- strict chessboard fidelity;
- anti-spoiler state semantics;
- product truth;
- branch safety;
- package-change restrictions;
- no-merge-to-road rules.

If this gate conflicts with the Sacred Board Contract, the Sacred Board
Contract wins.

## What Creative Direction Means

Creative direction is not "make it prettier." It is a decision about product
identity, learning clarity, and emotional force.

It must answer:

- What should the player feel in this state?
- What chess decision is being protected?
- What is the one primary action or interpretation?
- What visual elements support board readability?
- What visual elements support decision tension?
- What visual elements support post-feedback learning?
- What must recede because it is decorative, generic, or hint-like?

## Required Judge Stack

Every serious visual branch should pass through these judges:

1. Chess Arbiter
   - true 8x8 board;
   - uniform squares;
   - top-down or near top-down;
   - immediately readable pieces;
   - no board pollution;
   - no pre-feedback hint.

2. Product Director
   - serious desktop chess learning application;
   - one clear product intent;
   - not a generic SaaS dashboard;
   - not a Stockfish GUI clone;
   - not a website hero;
   - no fake gamification or fake science.

3. Art Director
   - memorable identity;
   - board as artifact;
   - premium atmosphere;
   - emotional clarity;
   - state meaning visible without debug labels;
   - game-like feedback without cheap reward systems.

4. Creative Director
   - combines the previous three into a final direction call;
   - decides whether the branch is a real NeuroChess direction or only a safe
     prototype;
   - records concrete visible reasons, not generic praise.

## Mandatory Inputs

A Creative Director review needs:

- screenshot or contact-sheet evidence;
- viewport list;
- route and state list;
- board fidelity result;
- anti-spoiler result;
- product-grade result;
- visual ambition result;
- forbidden-claim check;
- evidence path outside the repo;
- known visual debt.

No screenshot means no product-grade visual claim.

## Awwwards-Grade Translation

For NeuroChess, Awwwards-grade does not mean scroll spectacle, landing-page
composition, or decorative 3D. It means craft in a desktop application:

- precise composition;
- memorable first viewport;
- product-specific visual identity;
- meaningful motion;
- high-quality interaction states;
- strong hierarchy;
- premium material depth;
- no generic card-grid layout;
- no effect that weakens chess clarity.

## Pass Levels

`SAFE_PROTOTYPE`

- hard gates pass;
- useful experiment;
- not yet product-grade or memorable.

`PRODUCT_GRADE_DIRECTION`

- hard gates pass;
- serious desktop application feel;
- board is central;
- no cheap UI dominance;
- state meaning is understandable.

`NORTH_STAR_CANDIDATE`

- product-grade direction plus memorable identity;
- screenshot deserves human review as a possible future direction;
- still not automatically approved for merge.

`GAME_CHANGER_CANDIDATE`

- North Star candidate with unusually strong identity and learning clarity;
- can only be claimed after screenshot evidence and human review;
- never produced by autonomous scoring alone.

## Blockers

Immediate block:

- distorted board;
- non-uniform square perception;
- unreadable pieces;
- pre-feedback move path, target, destination glow, or answer-like trace;
- decorative artifact on the board core;
- fake XP, rank, Elo, Transfer, neuroscience, or Practice-ready claim;
- generic SaaS dashboard;
- Stockfish GUI clone;
- CSS demo feeling;
- DEV-HUD dominance;
- motion without learning purpose;
- visual spectacle that competes with the board.

## Required Output

A Creative Director decision must include:

- verdict;
- branch and commit;
- evidence path;
- strongest visible strengths;
- strongest visible weaknesses;
- hard-gate result;
- product-grade result;
- ambition result;
- whether human review is required;
- whether product consolidation is allowed;
- next recommended mission.

Allowed verdicts:

- `NORTH_STAR_CANDIDATE_REVIEW`
- `PRODUCT_GRADE_WITH_VISUAL_DEBT`
- `SAFE_PROTOTYPE_ONLY`
- `ART_DIRECTION_REWORK_REQUIRED`
- `BLOCKED_BY_CHESS_FIDELITY`
- `BLOCKED_BY_STATE_SEMANTICS`
- `QUARANTINE_REQUIRED`

## Runtime Rule

The Creative Director Gate must not ask the user for approval during an
autonomous run. If the gate cannot decide safely, it returns
`NEEDS_HUMAN_REVIEW_AFTER_RUN`.
