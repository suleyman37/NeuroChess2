# Plan Context Min

Ultra-condensed working memory for Plan1, Plan2, and Plan3. If this file
conflicts with Plan1, Plan2, or Plan3, the source plans win.

## Product Promise

NeuroChess turns a player's real chess games into a mathematical diagnosis, a
guided pedagogical Review, and a personalized training loop.

The promise is not "here is the best move." The promise is:

- what your games reveal about how you decide;
- what to work on now;
- the exercise to do;
- whether you learned it;
- whether it transfers back into real games.

The word "Neuro" is a product metaphor. NeuroChess does not measure the brain,
medical state, intelligence, or neuroplasticity. It measures decisions, errors,
declared intentions when available, practice attempts, response times, hints,
reveals, progress, and future transfer signals.

## Plan3 Execution Doctrine

Plan3 governs execution order. It does not replace Plan1/Plan2 product truth.

- One Codex mission = one precise objective = one controlled diff = relevant
  tests = a final report.
- Never apply Plan3 as one huge refactor or all-at-once roadmap.
- V1 real loop includes `training_items`, `practice_attempts`,
  `practice_result_event_v1`, `simple_spaced_repetition_v1`, deterministic
  Daily Plan, Privacy/export/delete, and QA release discipline.
- SkillTrace Beta is V1 shadow mode only: store/update/log internally, no visible
  mastery score, and no strong Daily Plan influence until V1.1 exit criteria.
- NeuroMonitor, Cognitive Map, brain/cortex/atlas visuals are outside V1 normal
  UI; compact progress only.
- Do not call V1 simple scheduling "FSRS-lite"; the official V1 name is
  `simple_spaced_repetition_v1`. Real FSRS belongs V2/V3.
- V1 UI is French. New strings should be centralized as Plan3 i18n hygiene,
  without adding a language switch.
- Stockfish cache must be strict: same FEN, engine hash/version, compatible
  profile, multipv, quality status, formula version, and metric version.
- V1 exit criteria include a complete import -> analyze -> Review -> Practice ->
  Daily Plan -> J+3 revision flow, critical tests/smokes passing, export/delete,
  and users understanding the next useful action.

## Central Loop

V1 must keep the loop tight:

1. Import or open a real game.
2. Analyze with backend-authoritative Stockfish.
3. Convert engine output to Win%, win_loss, accuracy, coach NeuroScore, and key
   moments.
4. Show a calm Review Summary.
5. Let the user understand through quick reading or a full lesson.
6. Turn selected moments into Practice.
7. Record attempts.
8. Bring positions back for review later.

Long-term loop:

real game -> positions -> engine eval -> Win% -> chance loss -> accuracy ->
coach NeuroScore -> critical moments -> diagnosis -> training items -> attempts
-> user model -> recommended plan -> future games -> transfer validation.

## V1 Architecture

- Backend is authoritative for chess rules, FEN/SAN/UCI, Stockfish analysis,
  Review scoring, moment selection, try-move grading, and Practice decisions.
- Frontend presents state and sends user actions; it must not decide final
  grading.
- Canonical eval is `eval_cp` POV White.
- `mate_in` is POV White.
- Deep Review analysis is the durable Review source.
- Live/shallow analysis must not be mixed into stabilized Review truth.
- Engine analysis must remain versioned by engine, engine version, depth/time,
  MultiPV, analysis kind, profile, and schema/formula versions.
- Formulas live in backend/docs, not in `frontend/src/App.tsx`.

## Navigation V1

Plan2 navigation target:

1. Aujourd'hui
2. Mes parties
3. Entrainement

Profile/Settings sits top right.

Review is not a permanent main tab. It opens from Aujourd'hui, Mes parties, or
Entrainement. The board must not be the permanent center of the app. One page
equals one main intention; one prescriptive screen gets one primary action.

Current app still has legacy tab structure; transition must be incremental.

## Review V1 UX

Review is a journey:

Summary -> Lecture rapide or Lecon complete -> S'entrainer -> Explorer only if
needed.

Summary must show:

- coach NeuroScore /100 as the main score;
- one clear human interpretation;
- reference precision collapsed/secondary;
- up to 3 key moments;
- one training card;
- a discreet advanced details link.

Normal Summary must not show:

- raw `criticality_score`;
- `diagnostic_gap`;
- `neuro_score_diag`;
- raw PV;
- Evidence JSON;
- Stockfish WDL;
- uncalibrated domain score /100;
- brain/cortex/atlas visuals;
- competing CTAs.

## Metrics: Visible vs Internal

Visible in V1:

- coach NeuroScore (`coach_neuro_score_v1`);
- reference precision (`game_accuracy_lichess_like_v1` or aligned equivalent);
- clear qualitative labels;
- simple key-moment tags;
- practice counts/session outcome.

Indirect/user-friendly:

- Win%;
- player_win_percent;
- win_loss translated into impact language;
- move_accuracy only as support, not as the core truth.

Internal/action/audit:

- raw criticality;
- Diagnostic Gap;
- NeuroDiagnostic / `neuro_score_diag`;
- raw domain scores;
- tail risk;
- Stockfish WDL;
- Evidence JSON;
- ETV terms;
- reliability/debug rows.

## Explicit V1 Features

- PGN import/manual game source.
- Stockfish backend analysis.
- Win% and player POV Win%.
- win_loss/chance loss.
- move accuracy and game/reference accuracy.
- coach NeuroScore visible.
- criticality/moment selection as internal driver.
- taxonomy V0 / simple pedagogical tags.
- Review Summary.
- Lecture rapide.
- Lecon complete.
- Practice from Review positions.
- practice_result_event style attempt logging.
- SkillTrace Beta shadow mode when implemented, not visible and not prescriptive
  in V1.
- `simple_spaced_repetition_v1` for plain due/review timing.
- Deterministic Plan du jour / daily training direction.
- Mes positions ratees.
- Revisions.
- Profile/Settings minimal including data/privacy/settings.
- Privacy/export/delete before V1 external release.
- Anti-tilt.
- Degraded states.
- Partial offline for calculated Reviews/Practice/import queue.
- Compact progress in Aujourd'hui.

## V2/V3/Research Or Hidden

- Candidate Trainer: V2 opt-in, not V1 normal UI.
- Intent Layer: optional; deep/candidates modes are not normal V1.
- LLM coach: V3/future only with verifier and evidence grounding.
- Transfer Gap: V2, only after enough data.
- Domain scores: only when calibrated and sufficient data; otherwise internal or
  qualitative.
- Real FSRS: V2/V3 only; V1 uses `simple_spaced_repetition_v1`, visible only as
  plain review timing/counts.
- ETV: internal prioritization, not visible as formula.
- Foundations 400-800: future module, not V1 core.
- Detailed Progression page: V2; V1 uses compact card.
- Full offline/cloud/sync/freemium/social/club/coach: future.
- Brain/atlas/cortex/cognitive spectacular visuals: research only, not V1 UI.

## V1 Interdictions

- No normal UI technical dashboard.
- No brain measurement claim.
- No raw formulas in beginner/normal screens.
- No raw Evidence JSON or debug payload in normal Review.
- No LLM, Candidate Trainer, Intent Deep, Transfer Gap, or calibrated domain
  score as visible V1 truth.
- No multiple competing primary CTAs on a prescriptive screen.
- No decorative feature that weakens clarity, action, Review, Practice, or
  progression.
- No formula changes without explicit decision and tests.

## Done Definition For A NeuroChess Feature

A feature is done only when:

- it is justified by Plan1/Plan2 or explicitly marked V2/V3/research;
- visible UI respects one intention and one primary action;
- backend remains authoritative for chess/scoring/training decisions;
- internal metrics stay internal or folded in debug/advanced contexts;
- docs/registries are updated when metrics, actions, screens, or plan alignment
  change;
- tests/builds relevant to the changed behavior have run or blockers are
  documented;
- `tools/plan_guard.py` passes for UI-boundary checks.
