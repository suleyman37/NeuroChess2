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

## Contracts

| screen_id | route | question_answered | primary_user_intent | primary_action | allowed_secondary_actions | alternative_action | visible_modules | hidden_modules | forbidden_modules | empty_state | loading_state | error_state | max_primary_actions | max_secondary_actions | progressive_disclosure_level | technical_details_location |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| public.landing | `/` | Why does NeuroChess exist? | Understand the product and enter the app. | `nav.open_cockpit` / Open app | none | none | brand promise, simple value, app entry | product internals | debug, engine, raw metrics | show product promise | minimal page loading | show retry/open app fallback | 1 | 0 | Level 1 | none |
| app.cockpit | `/app` cockpit | What should I do now? | Receive guidance. | `cockpit.start_recommended_plan` | `cockpit.resume_session`, `cockpit.import_game` | `cockpit.do_something_else` | recommendation, current plan, resume state | raw metrics, advanced analysis | debug, engine settings, formula versions | invite import or review | plan loading skeleton | explain missing data | 1 | 2 | Level 1 | advanced options only |
| app.games | `/app` games | Which game do I want to import, play, or analyze? | Manage game sources. | `games.import_pgn` | `games.paste_pgn`, `games.start_local_game` | none | game library, import panel | review internals | debug, score JSON | empty library with import CTA | library/import loading | import or load error | 1 | 2 | Level 2 | game row details only |
| app.review.empty | `/app` review empty | How do I build a Review? | Start a review safely. | `review.start_recommended_analysis` | `review.open_advanced_analysis_options` | none | explanation, recommended analysis CTA | standard/deep/reset details | debug, score, moments, practice | not generated or not reviewable message | none | not reviewable or start failed | 1 | 1 | Level 2 | app.advanced_options |
| app.review.running_job | `/app` review job | Is the analysis progressing correctly? | Monitor review generation. | none or `review.resume_review_job` when stalled | `review.cancel_review_job`, `review.reconcile_job` | none | progress, job state, retryable status | final score, moments, practice | score final, practice, lesson cards | queued job message | progress indicator | stalled/failed with recovery action | 1 | 2 | Level 2 | app.advanced_options |
| app.review.summary | `/app` review summary | What does this game reveal? | Decide what to learn from the review. | `review.start_practice` | `review.open_key_lesson`, `review.open_explorer` | none | headline synthesis, priorities, takeaways, NeuroMonitor | debug, engine settings, raw score JSON | debug, options moteur, score JSON | no significant moments explanation | review loading/progress if needed | incomplete review message | 1 | 2 | Level 2 | app.review.explorer or app.advanced_options |
| app.review.learn.challenge | `/app` review learn challenge | Which move should I find? | Try solving the moment. | `lesson.try_move` | `lesson.show_hint`, `lesson.show_correction` | none | type, move title, main prompt, impact | correction, PV, best move | solution, best move, PV, best_branch, debug | no selected lesson message | none | unsupported try falls back to correction CTA | 1 | 2 | Level 2 | none |
| app.review.learn.correction | `/app` review learn correction | Why is my move a problem? | Understand the correction. | `lesson.continue` | `lesson.show_line`, `lesson.retry` | none | played move, correction, impact, main idea | full PV comparison until requested | debug, best_branch raw JSON, engine settings | no correction data message | none | missing PV hides line action | 1 | 2 | Level 2 | line comparison, explorer |
| app.review.learn.training | `/app` review learn training | How do I turn this lesson into exercise? | Convert lesson into practice. | `practice.start_session` or `lesson.next_moment` if no practice | `lesson.next_moment`, return summary | none | takeaway, next action, training CTA | advanced details | debug, raw metrics | no practice items message | none | training unavailable fallback | 1 | 2 | Level 2 | none |
| app.review.training | `/app` review training | What should I correct in this game? | Practice review items. | depends on session state: `practice.start_session`, `practice.resume_session`, `practice.retry_failed`, or `practice.redo_all` | `practice.reveal_solution`, `practice.skip_item` during item | `practice.skip_item` | current item, feedback, session summary | PV until reveal/show line | debug, raw score JSON | no eligible positions | saving/loading session | session error with retry/quit | 1 | 2 | Level 2 | summary or explorer |
| app.review.explorer | `/app` review explorer | I want to inspect the details. | Inspect and open a specific lesson. | `explorer.open_lesson_for_move` | `explorer.replay_line`, `opening.show_linked_moment` | none | sections, moves, opening, PV, folded technical details | destructive/debug options | always-visible debug, normal-flow score JSON | no annotated moves | loading review sections | unavailable evidence message | 1 | 2 | Level 3 | folded explorer details |
| app.training | `/app/training` | What should I correct now? | Follow a training program. | start recommended program | choose another training, resume session | choose another training | recommended program, domains, session queue | raw transfer gap until sufficient | precise Transfer Gap with insufficient data, debug | no program yet -> import/review | program loading | insufficient data explanation | 1 | 2 | Level 3 | advanced progress details |
| app.progress | `/app/progress` | Am I really improving? | Review progress and return to plan. | view current plan | filter period, open training | none | trends, qualitative labels, sufficient-data badges | raw formulas | precise Transfer Gap if data insufficient, debug | not enough data message | progress loading | explain unavailable data | 1 | 2 | Level 3 | advanced details |
| app.settings | `/app/settings` | How do I configure the app? | Configure preferences. | none | save preference, export data | none | preferences, account/app settings | debug by default | normal-flow debug, hidden engine controls | default settings | saving state | setting save error | 0 | 2 | Level 4 | advanced section |
| app.advanced_options | `/app/advanced` or disclosed panel | How do I control technical parameters? | Inspect or adjust technical controls. | none | advanced analysis, rebuild metrics | none | engine, cache, debug, AI/export controls if available | normal user coaching | visible by default | collapsed by default | operation progress | technical error details | 0 | 2 | Level 4 | this screen |

## Required Screen Behaviors

### public.landing

- Question: "Pourquoi NeuroChess existe ?"
- Primary action: open the application.
- Forbidden: debug, engine, raw metrics.

### app.cockpit

- Question: "Que dois-je faire maintenant ?"
- Primary action: start the user's plan.
- Alternative action: "Faire autre chose".
- Forbidden: raw metrics, debug, engine settings, formula versions.

### app.games

- Question: "Quelle partie je veux importer, jouer ou analyser ?"
- Primary action: import PGN.
- Contextual actions: open, analyze, view Review, continue training.

### app.review.empty

- Question: "Comment construire une Review ?"
- Primary action: launch recommended analysis.
- Advanced: standard/deep/reset in advanced options only.

### app.review.running_job

- Question: "L'analyse avance-t-elle correctement ?"
- Primary action: none, except resume/reconcile when action is required.
- Secondary action: cancel.
- Forbidden: final score, moments, practice.

### app.review.summary

- Question: "Qu'est-ce que cette partie révèle ?"
- Primary action: train on this Review.
- Secondary actions: key lesson, explorer.
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

### app.review.explorer

- Question: "Je veux inspecter les détails."
- Primary action: view the lesson for this move.
- Allowed: sections, moves, opening, PV, details.
- Technical details are allowed here only when folded.

### app.training

- Question: "Que dois-je corriger maintenant ?"
- Primary action: start recommended program.
- Alternative action: choose another training.

### app.progress

- Question: "Est-ce que je progresse vraiment ?"
- Primary action: view current plan.
- Forbidden: precise Transfer Gap when data is insufficient.

### app.settings

- Question: "Comment configurer l'application ?"
- Primary action: none.
- Destructive actions require confirmation.

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
- `app.review.summary` is a compact dashboard: coach NeuroScore, reference precision, qualitative label, one cognitive map, up to three priorities, up to three takeaways, and one primary CTA.
- `app.review.learn.*` keeps the three public lesson states. Dense line comparison, PV evidence, and technical variants remain folded until the user asks.
- `app.review.training` must always show a useful primary action, even before a session exists.
- `app.review.explorer` owns technical details, opening detail, analysis options, PV evidence, and debug disclosures.
- The board column may show only compact state and navigation context; it must not duplicate the full NeuroMonitor or summary dashboard.

## Rules for future Codex missions

- Any new metric must be added to the Metric Registry.
- Any new action must be added to Action Registry.
- Any new screen or tab must be added to Screen Contracts.
- If a mission introduces or uses a screen or tab without updating this document, the mission is incomplete.
