# A20I 3D Board Stage Visual Review

Date: 2026-05-17

Reviewed branch: `auto/a20h-dev-only-3d-board-stage-20260517`

Reviewed commit: `87b06cf Add DEV-only 3D Board Stage prototype`

Evidence root:
`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\board_stage_prototypes\A20H_dev_3d_board_stage_20260517`

## 1. Summary Verdict

Final direction decision: `ONE_SHOT_POLISH_REQUIRED`

A20H proves the code-native Board Stage direction is viable. The prototype is
desktop-first, board-centered, screenshot-testable, dependency-free, and free of
fake progress, fake science, Spline, Unity, Godot, package changes, and external
assets.

The direction should continue, but not yet move straight into a broader Golden
Screen tournament. One semantic polish pass should happen first: strengthen
state-specific visual meaning and viewport fit so the five learning states read
more immediately without relying on side-panel text.

Recommended next mission:
`A20H2_ONE_SHOT_3D_BOARD_STAGE_VISUAL_POLISH`

## 2. Evidence Reviewed

Reviewed evidence:

- `contact_sheet.png`
- `screenshot_observe_1440.png`
- `screenshot_try_1440.png`
- `screenshot_success_1440.png`
- `screenshot_miss_1440.png`
- `screenshot_replay_1440.png`
- `visual_review_brief.md`
- `browser_smoke_report.json`
- `console_log.txt`
- `gemini_visual_result.json`
- `autonomous_design_score.json`
- A20I stricter Gemini rerun under `A20I_visual_review\gemini_strict_visual_court`

Evidence completeness: complete for a DEV-only prototype. Screenshots and
contact sheet are external only and were not committed.

## 3. Branch Inspection Result

Branch exists locally and on origin.

Commit exists: `87b06cf`

Changed files:

- `frontend/src/App.tsx`
- `frontend/src/dev/board-stage/BoardStagePrototype.css`
- `frontend/src/dev/board-stage/BoardStagePrototype.tsx`
- `scripts/browser_a20h_board_stage_prototype_smoke.mjs`

Branch safety:

- No backend files touched.
- No package files touched.
- No `docs/rebuild` or `plan` files touched.
- No binary assets, screenshots, models, textures, GLB, FBX, OBJ, videos, or
  downloaded assets committed.
- Production flow impact is limited to a hidden DEV-only route flag:
  `/app?boardStage=1`, gated by `import.meta.env.DEV`.
- A20H browser smoke proved the production V1 shell still loads and main nav
  remains exactly `Aujourd'hui / Mes parties / Entrainement`.

Branch inspection classification: safe prototype branch, still separate from
`road-to-V2`.

## 4. Screenshot And Contact Sheet Assessment

The corrected contact sheet shows five distinct screenshots. The board is the
dominant visual object in each state, centered within a dark cockpit-like stage.
Pieces and squares remain readable, and the surrounding panels frame rather than
replace the board.

Strengths:

- Board centrality is strong: the smoke measured a centered board with
  `centerDelta: 0` and roughly `544x522` visible board bounds.
- The board remains stable across all states.
- The dark stage, grid, side panels, and thin vector lines create a credible
  command-center direction without package dependencies.
- The state controls, reduced motion toggle, and 2D fallback toggle are visible.
- No fake product claims or unsafe training claims are visible.

Visual debts:

- The five states are recognizable, but the differences are still subtle and
  mostly color/trace based. State meaning should be readable faster from the
  stage itself.
- The browser screenshots show a visible page scrollbar and some bottom footer
  cropping. For a stage prototype, the first desktop viewport should frame the
  whole cockpit more intentionally.
- The pieces are letter tokens. They are readable and safe, but they feel more
  utilitarian than artifact-like.
- The side panels currently feel like inspector panels. That supports Figma /
  command-center clarity, but the Messenger living-world quality is still weak.

## 5. State-By-State Review

`observe`

- Visual change: cool cyan accent, quiet grid, stable board.
- Meaning: clear enough as a calm reading state.
- Debt: the state could make the position-as-artifact feeling stronger without
  adding motion.

`try_before_feedback`

- Visual change: yellow accent, decision ring near the contested area, contained
  energy.
- Meaning: this is the best state in the prototype. It communicates tension
  without revealing the answer.
- Safety: no spoiler before attempt.

`feedback_success`

- Visual change: green accent and line trace after effort.
- Meaning: honest stabilization rather than fake reward economy.
- Debt: success could feel more like a short stabilization event and less like
  a static color variant.

`feedback_miss`

- Visual change: red accent, ring/trace and slight imbalance.
- Meaning: corrective pressure is visible and not humiliating.
- Debt: the miss state could better show "reset to clarity" after the warning.

`replay`

- Visual change: purple guided path.
- Meaning: readable as post-feedback trace.
- Safety: replay happens as a separate state and does not imply an answer before
  effort.
- Debt: replay is useful, but the path is currently a generic line. It should
  eventually be tied to real move geometry or a more inspectable decision trace.

## 6. Reference Alignment Analysis

Orano:

- Good alignment on technical grid, precision framing, and restrained accent
  colors.
- Needs more decision-critical hierarchy before it feels like a mature cockpit.

Igloo:

- Some alignment through dark atmosphere and material depth.
- Needs stronger artifact presence and more intentional negative space.

Messenger:

- Weakest alignment. The prototype is coherent but not yet a compact living
  world.

SOM:

- Board as central totem is strong.
- State impact is present but should become more immediate.

Linear / Raycast / Figma:

- Good clarity and workspace alignment. The side panels and direct controls are
  understandable.
- Risk: if this direction overuses inspector panels, it can become too tool-like.

Into the Breach:

- Good tactical board readability and state framing.
- Future work should tie traces more directly to chess move consequences.

Balatro / Hades:

- Feedback energy exists but is still early. It is not gamey or fake, which is
  good, but it does not yet have the tactile punch these references imply.

## 7. Anti-Generic Brutality Gate Result

Result: `PASS_NON_GENERIC`

No immediate block signals found:

- Not a generic SaaS dashboard.
- Not a bland rounded card grid.
- Board is central.
- No passive analytics layout.
- No fake progress economy.
- No cyberpunk default.
- No random particles.
- Visual effects are tied to learning states.

Minor warning: the side panels and footer labels can drift toward a technical
demo if future work does not make the chess decision feel more alive.

## 8. Taste Proxy Alignment

Suleyman Taste Proxy alignment: strong enough to continue.

Positive signals present:

- Desktop-first strategic cockpit.
- Board as central artifact.
- Code-native controlled scene language.
- Premium dark visual identity.
- Technical precision.
- Motion with meaning.
- Game-like but not gamey.
- No runtime user approval dependency.

Weak signals:

- Living-world quality is present only faintly.
- The state language is more "prototype inspector" than "NeuroChess place."
- Piece treatment is readable but not yet premium.

## 9. Gemini Review Result And Caveat

A20H Gemini:

- Result: `PASS_VISUAL`
- Caveat: findings were placeholder-level.

A20I stricter Gemini rerun:

- Rerun: yes.
- Status: validator PASS.
- Verdict: `PASS_VISUAL`.
- Caveat: Gemini again returned placeholder-level findings despite explicit
  instructions to cite concrete screenshot evidence.

Interpretation:

Gemini availability and strict JSON path are healthy, but its qualitative
visual critique was not reliable enough to be the primary basis for this
decision. The final decision relies more heavily on direct contact-sheet
inspection, deterministic browser smoke, branch inspection, and autonomous
design scoring.

## 10. ChatGPT Visual Review Result

ChatGPT Visual Court was not used. The mission did not require a second visual
provider after deterministic evidence, autonomous scoring, and Gemini schema
PASS. No ChatGPT live product mission was requested.

## 11. Accessibility And Fallback Assessment

Assessment: PASS for DEV-only prototype, with future proof needed before product
integration.

Evidence:

- Reduced motion toggle exists.
- 2D fallback toggle exists.
- CSS includes reduced-motion handling and effects-disabled fallback.
- Board remains meaningful even if effects are disabled.
- Critical state text is visible; state meaning is not encoded only in 3D.

Debt:

- A future polish pass should capture explicit reduced-motion and 2D-fallback
  screenshots, not only prove controls exist.

## 12. Performance, Build, And Smoke Assessment

A20H validation results:

- `git diff --check`: PASS.
- `npm run build`: PASS.
- `npx tsc --noEmit`: PASS.
- `python tools/plan_guard.py`: PASS.
- Browser smoke: PASS.
- V1 production shell check: PASS.

Browser evidence:

- No runtime page errors.
- No network 500.
- One generic 404 resource message was captured and filtered as non-fatal.

Performance risk:

- Low for prototype. Effects are CSS/SVG only, no external renderer, no asset
  load, no uncontrolled particle system, no full-screen shader.
- Future R3F/Three implementation will need a dedicated performance budget
  smoke; this CSS prototype does not prove 3D renderer performance.

## 13. Integration Risk

Risk level: medium-low for prototype branch, medium for productization.

Why low enough to continue:

- Hidden DEV-only route.
- No package changes.
- No backend changes.
- No product data mutation.
- No production tab/nav alteration beyond a dev-only conditional.

Why not merge directly:

- The route is prototype-only.
- State visuals need one semantic polish pass before this direction becomes a
  reusable product pattern.
- Evidence is at 1440px; future work should add 1366px and reduced-motion /
  fallback screenshots.

## 14. Final Direction Decision

Decision: `ONE_SHOT_POLISH_REQUIRED`

Rationale:

- The direction is worth keeping.
- The prototype proves Codex can create a board-centered, code-native stage
  without Spline, assets, package installs, or product-code merge to road.
- No red-tier or fake-claim issue was found.
- The board is central and readable.
- The stage supports learning states, but the state differences are not yet
  strong enough to carry the NeuroChess visual identity by themselves.

One-shot polish should be semantic, not pixel pushing:

- Improve first-viewport framing so the stage reads as one intentional desktop
  cockpit without visible scroll/crop in standard screenshots.
- Make state meaning more obvious from the board-stage itself, especially
  success, miss, and replay.
- Add explicit reduced-motion and 2D-fallback screenshot evidence.
- Keep no-package, no-assets, no-Spline constraints.

## 15. Recommended Next Mission

Next mission:
`A20H2_ONE_SHOT_3D_BOARD_STAGE_VISUAL_POLISH`

Do not merge A20H to `road-to-V2` before the one-shot polish review unless the
human explicitly chooses to accept the current visual debt.
