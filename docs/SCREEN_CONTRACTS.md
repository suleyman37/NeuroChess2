# NeuroChess2 Screen Contracts

This document defines the product contract for each screen. A screen must answer
one user question, expose one primary action, and reveal complexity only when it
helps the user.

## Global Screen Rules

- Each screen answers exactly one user question.
- Each prescriptive screen has one primary action.
- Visible secondary actions are capped at two.
- Prescriptive screens must include an autonomy-preserving alternative when the user may reasonably reject the recommendation.
- Technical details belong in advanced options, explorer, or debug surfaces.
- Raw formulas, evidence JSON, engine settings, and debug panels are forbidden in normal beginner flows.

## Mobile And Accessibility V1 Minimum

- The main app shell must remain usable at a 390x844 mobile viewport without
  horizontal overflow.
- Main navigation remains exactly `Aujourd'hui`, `Mes parties`,
  `Entrainement`; Profile/Settings stays outside the main nav.
- Training remains exactly `Plan du jour`, `Mes positions ratees`,
  `Revisions`.
- Review mobile must keep the board visible and reachable before the Review
  summary, with `Explorer la position`, undo, reset, and exit controls reachable.
- Practice mobile must keep the board tappable and keep `Indice`, `Voir la
  correction`, `Passer`, and continue/next actions reachable below the board.
- Profile/Privacy mobile must keep export/delete visible and the delete
  confirmation usable.
- Keyboard V1 minimum: main nav, Import PGN, PGN textarea, Practice board,
  Practice buttons, and Profile/Settings must be reachable by Tab with visible
  focus styling.
- CSS must respect `prefers-reduced-motion`. This is a V1 minimum smoke
  contract, not a full WCAG certification.

## Contracts

| screen_id | route | question_answered | primary_user_intent | primary_action | allowed_secondary_actions | alternative_action | visible_modules | hidden_modules | forbidden_modules | empty_state | loading_state | error_state | max_primary_actions | max_secondary_actions | progressive_disclosure_level | technical_details_location |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| public.landing | `/` | Why does NeuroChess exist? | Understand the product and enter the app. | `nav.open_today` / Open app | none | none | brand promise, simple value, app entry | product internals | debug, engine, raw metrics | show product promise | minimal page loading | show retry/open app fallback | 1 | 0 | Level 1 | none |
| app.today | `/app` Aujourd'hui | What should I do now? | Receive the next useful action. | `today.follow_recommendation` | `cockpit.resume_session`, `cockpit.import_game` | none | clear recommendation, last Review, compact progress, simple due-review count | raw metrics, advanced analysis | debug, engine settings, formula versions | invite import or Review | plan loading skeleton | profile en construction | 1 | 2 | Level 1 | advanced options only |
| app.games | `/app` games | Which game do I want to import, play, or analyze? | Manage game sources. | `games.import_pgn` | `games.paste_pgn`, `games.start_local_game` | none | game library, import panel | review internals | debug, score JSON | empty library with import CTA | library/import loading | import or load error | 1 | 2 | Level 2 | game row details only |
| app.review.empty | `/app` review empty | How do I build a Review? | Start a review safely. | `review.start_recommended_analysis` | `review.open_advanced_analysis_options` | none | explanation, recommended analysis CTA | standard/deep/reset details | debug, score, moments, practice | not generated or not reviewable message | none | not reviewable or start failed | 1 | 1 | Level 2 | app.advanced_options |
| app.review.running_job | `/app` review job | Is the analysis progressing correctly? | Monitor review generation. | none or `review.resume_review_job` when stalled | `review.cancel_review_job`, `review.reconcile_job` | none | progress, job state, retryable status | final score, moments, practice | score final, practice, lesson cards | queued job message | progress indicator | stalled/failed with recovery action | 1 | 2 | Level 2 | app.advanced_options |
| app.review.summary | `/app` review summary | What does this game reveal? | Decide what to learn from the review. | `review.start_practice` | `review.open_key_lesson`, `review.open_explorer` | none | headline synthesis, up to three key moments, one training card, folded score detail | debug, engine settings, raw score JSON, research visuals | debug, options moteur, score JSON, brain/atlas/cortex visuals | no significant moments explanation | review loading/progress if needed | incomplete review message | 1 | 2 | Level 2 | app.review.explorer or app.advanced_options |
| app.review.learn.challenge | `/app` review learn challenge | Which move should I find? | Try solving the moment. | `lesson.try_move` | `lesson.show_hint`, `lesson.show_correction` | none | type, move title, main prompt, impact | correction, PV, best move | solution, best move, PV, best_branch, debug | no selected lesson message | none | unsupported try falls back to correction CTA | 1 | 2 | Level 2 | none |
| app.review.learn.correction | `/app` review learn correction | Why is my move a problem? | Understand the correction. | `lesson.continue` | `lesson.show_line`, `lesson.retry` | none | played move, correction, impact, main idea | full PV comparison until requested | debug, best_branch raw JSON, engine settings | no correction data message | none | missing PV hides line action | 1 | 2 | Level 2 | line comparison, explorer |
| app.review.learn.training | `/app` review learn training | How do I turn this lesson into exercise? | Convert lesson into practice. | `practice.start_session` or `lesson.next_moment` if no practice | `lesson.next_moment`, return summary | none | takeaway, next action, training CTA | advanced details | debug, raw metrics | no practice items message | none | training unavailable fallback | 1 | 2 | Level 2 | none |
| app.review.training | `/app` review training | What should I correct in this game? | Practice review items. | depends on session state: `practice.start_session`, `practice.resume_session`, `practice.retry_failed`, or `practice.redo_all` | `practice.reveal_solution`, `practice.skip_item` during item | `practice.skip_item` | current item, feedback, session summary | PV until reveal/show line | debug, raw score JSON | no eligible positions | saving/loading session | session error with retry/quit | 1 | 2 | Level 2 | summary or explorer |
| app.review.explorer | `/app` review explorer | I want to inspect the details. | Inspect and open a specific lesson. | `explorer.open_lesson_for_move` | `explorer.replay_line`, `opening.show_linked_moment` | none | sections, moves, opening, PV, folded technical details | destructive/debug options | always-visible debug, normal-flow score JSON | no annotated moves | loading review sections | unavailable evidence message | 1 | 2 | Level 3 | folded explorer details |
| app.training | `/app` Entrainement | What should I correct now? | Start the next simple practice session. | `training.start_daily_plan` | `training.review_failed_positions`, `training.start_due_revisions` | none | Plan du jour, Mes positions ratees, Revisions, simple due/scheduled counts | formulas, domains, Transfer Gap, FSRS/ETV/SkillTrace labels | Candidate Trainer, Intent Layer, LLM, debug | profile en construction -> import/review | lightweight loading | insufficient practice data explanation | 1 | 2 | Level 2 | folded practice details only |
| app.progress | `/app/progress` | Am I really improving? | Review progress and return to plan. | view current plan | filter period, open training | none | trends, qualitative labels, sufficient-data badges | raw formulas | precise Transfer Gap if data insufficient, debug | not enough data message | progress loading | explain unavailable data | 1 | 2 | Level 3 | advanced details |
| app.settings | header panel in `/app` | How do I control my local profile and data? | Manage minimal local settings and privacy. | none | export data, request/delete local data | none | local profile note, real preference note, engine note, privacy export/delete | debug, research metrics, fake toggles | normal-flow debug, hidden engine controls, cloud/account promises | profile en construction | export/delete progress | export/delete error with no data loss | 0 | 2 | Level 2 | none |
| app.advanced_options | `/app/advanced` or disclosed panel | How do I control technical parameters? | Inspect or adjust technical controls. | none | advanced analysis, rebuild metrics | none | engine, cache, debug, AI/export controls if available | normal user coaching | visible by default | collapsed by default | operation progress | technical error details | 0 | 2 | Level 4 | this screen |

## Required Screen Behaviors

### public.landing

- Question: "Pourquoi NeuroChess existe ?"
- Primary action: open the application.
- Forbidden: debug, engine, raw metrics.

### app.today

- V5.6 Daily Plan update: Today may use the deterministic backend Daily Plan as
  the main next action after active Practice, before falling back to Review,
  analysis, due revisions, or import. It must still show one hero and one
  primary CTA, with no debug metric or fake progress.

- Question: "Que dois-je faire maintenant ?"
- Primary action: follow the real available next step: due revision Practice,
  Review, active Practice, analysis-in-progress state, or import.
- Alternative action: none in V5.5 shell; secondary cards stay informational.
- Forbidden: raw metrics, debug, engine settings, formula versions.

### app.games

- Question: "Quelle partie je veux importer, jouer ou analyser ?"
- Primary action: import PGN.
- Contextual actions: open, analyze, view Review, continue training.
- Degraded states: empty PGN, invalid PGN, illegal PGN and duplicate import
  must render a calm `StateNotice` with one useful recovery action and collapsed
  technical details. Invalid PGN must not create a game.

### app.review.empty

- Question: "Comment construire une Review ?"
- Primary action: launch recommended analysis.
- Advanced: standard/deep/reset in advanced options only.

### app.review.running_job

- Question: "L'analyse avance-t-elle correctement ?"
- Primary action: none while progressing; `Reprendre` when the job is stalled or
  recoverable.
- Secondary action: cancel.
- Forbidden: final score, moments, practice.
- V1 no-infinite-spinner rule: a Review job screen must always show status and
  progress or a recovery action. Stale queued/running/finalizing jobs must not
  remain as timer-only UI.

### app.review.summary

- Question: "Qu'est-ce que cette partie révèle ?"
- Primary action: train on this Review.
- Secondary actions: key lesson, explorer.
- Board-side secondary action: `Explorer la position` may start local-only
  exploration from the selected Review FEN. It is not AI play, not Practice, and
  must not save attempts or update learning data.
- Live analysis may appear as a compact board eval for the displayed Review FEN
  and local exploration FEN. It pauses during standard/deep Review analysis and
  is hidden during active Practice challenge.
- Visible score: coach NeuroScore as the main score, reference precision as a
  secondary line.
- Forbidden: debug, engine options, score JSON.

### app.review.learn.challenge

- Question: "Quel coup dois-je trouver ?"
- Primary action: try.
- Secondary actions: hint, show correction.
- Forbidden: solution, best move, PV, best_branch, debug.

### app.review.learn.correction

- Question: "Pourquoi mon coup pose problème ?"
- Primary action: continue.
- Secondary actions: show line, retry.
- Visible: played move, correction, impact, main idea.

### app.review.learn.training

- Question: "Comment transformer cette leçon en exercice ?"
- Primary action: train.
- Secondary actions: next moment, return summary.

### app.review.training

- Question: "Que dois-je corriger dans cette partie ?"
- Primary action depends on session state: start session, resume session, retry failed, or redo all.
- Board interaction contract: Practice accepts real board moves by click-click
  and drag/drop support where available. Correct, wrong legal, illegal, and
  reveal attempts must persist through the backend and update `due_at` /
  `learning_summary`. See `docs/CORE_INTERACTION_CONTRACT.md`.
- Degraded states: no item, illegal move, attempt-save failure, reveal-used
  reassurance and repeated wrong attempts must use calm copy. Repeated wrong
  attempts may encourage the user to retry or reveal, but must not blame, shame,
  or introduce a separate anti-tilt product surface.

### app.review.explorer

- Question: "Je veux inspecter les détails."
- Primary action: view the lesson for this move.
- Allowed: sections, moves, opening, PV, details.
- Technical details are allowed here only when folded.

### app.training

- V5.6 Daily Plan update: `Plan du jour` is backed by durable
  `training_items` and the backend endpoints
  `GET /api/training/daily-plan/today`,
  `POST /api/training/daily-plan`, and
  `POST /api/training/daily-plan/practice`. The Training screen still has
  exactly three entries: Plan du jour, Mes positions ratees, Revisions.
  `selection_score`, ETV, SkillTrace mastery, Candidate Trainer, and Transfer
  Gap stay hidden from normal UI.

- Question: "Que dois-je corriger maintenant ?"
- Primary action: `Réviser`, `Commencer`, or `Reprendre` the real available
  Plan du jour when due revisions or Practice exist, otherwise open the
  contextual Review or import fallback.
- Secondary action: `Revoir` / `Voir` Mes positions ratees only when Practice
  history exists.
- Secondary action: `Réviser` Revisions only when simple due positions exist.
- V1 entries: Plan du jour, Mes positions ratees, Revisions.
- Revisions can show simple due/scheduled counts, `A venir`, or `profil en
  construction`, but must not expose FSRS/ETV/SkillTrace/Transfer Gap.
- Forbidden: Candidate Trainer, deep Intent Layer, LLM coach, visible Transfer
  Gap.
- Degraded states: `Plan en construction`, `Plan court aujourd'hui`, and
  `Plan indisponible` explain whether there is no durable data yet, a partial
  plan, or a failed request. These states remain inside the existing three
  Training entries and do not create a fourth mode.

### app.progress

- Question: "Est-ce que je progresse vraiment ?"
- Primary action: view current plan.
- Forbidden: precise Transfer Gap when data is insufficient.

### app.settings

- Question: "Comment contrôler mon profil local et mes données ?"
- Primary action: none.
- Must remain outside the main navigation, accessible from the header/top-right.
- Visible V1 sections: Profil local, Préférences, Moteur, Confidentialité.
- Export uses `GET /api/export` and downloads a local JSON file.
- Delete uses `DELETE /api/user-data?confirm=SUPPRIMER`.
- The first delete click must never delete data; typed `SUPPRIMER` is required.
- Destructive actions require confirmation.
- Forbidden: cloud/account promise, fake toggles, SkillTrace/ETV/Transfer Gap,
  debug metrics, brain/cortex/atlas visuals.

### app.advanced_options

- Question: "Comment contrôler les paramètres techniques ?"
- Primary action: none.
- Allowed: engine, cache, debug, AI, export.
- Forbidden: visible by default.

## Progressive Disclosure

### Level 1 - New / beginner

- Cockpit.
- One primary action.
- Few metrics.
- No debug.

### Level 2 - Engaged user

- Review with Summary / Learn / Train.
- Practice.
- Sessions.

### Level 3 - Autonomous user

- Explorer.
- Specific training.
- Domains.

### Level 4 - Power user

- Advanced options.
- Debug.
- Engine settings.
- Evidence JSON.

Rule: the app must reveal its power progressively.

## V5.4 Review UI Polish Application

- Review keeps four visible tabs: `Resume`, `Apprendre`, `S'entrainer`, `Explorer`.
- `app.review.summary` is a compact synthesis: coach NeuroScore, folded reference precision, qualitative label, up to three key moments, one training card, and one primary CTA.
- `app.review.learn.*` keeps the three public lesson states. Dense line comparison, PV evidence, and technical variants remain folded until the user asks.
- `app.review.training` must always show a useful primary action, even before a session exists.
- `app.review.explorer` owns technical details, opening detail, analysis options, PV evidence, and debug disclosures.
- The board column may show only compact state and navigation context; it must not duplicate the summary dashboard.

## Plan1/Plan2 V1 Boundary Update

- NeuroMonitor, brain, cortex, atlas, and cognitive-map visuals are forbidden in
  normal V1 UI.
- Future visual identity experiments live in `docs/RESEARCH_BACKLOG.md` until an
  explicit product decision promotes them.

## V5.5 Plan2 App Shell Application

- Main navigation is `Aujourd'hui`, `Mes parties`, `Entrainement`.
- Profile/settings stays outside main navigation.
- Review is contextual and must be opened from Aujourd'hui, Mes parties, or
  Entrainement.
- Aujourd'hui has one primary CTA and honest `profil en construction`
  fallbacks where data is not productized.
- V5.5-2 Today hero is driven only by existing Review, Practice, analysis, game,
  and import state.
- Mes parties owns PGN import, history, game opening, analysis launch, and
  contextual Review access.
- V5.5-2 Mes parties header prioritizes PGN import and history over local board
  actions.
- Entrainement V1 exposes only Plan du jour, Mes positions ratees, and
  Revisions.
- V5.5-2 Entrainement may reuse existing Practice session/history counts, while
  P1.LEARNING-LOOP-MINIMUM adds simple due/scheduled revision counts.
- P1.LEARNING-LOOP-MINIMUM keeps a single primary `Réviser` / `Commencer` /
  `Reprendre` CTA, uses Practice event history for Mes positions ratees,
  connects Revisions to simple due/scheduled counts, and keeps advanced memory
  models hidden.
- The board may appear inside Mes parties or Review context, but must not be
  the permanent center of the whole app shell.

## Rules for future Codex missions

- Any new metric must be added to the Metric Registry.
- Any new action must be added to Action Registry.
- Any new screen or tab must be added to Screen Contracts.
- If a mission introduces or uses a screen or tab without updating this document, the mission is incomplete.
