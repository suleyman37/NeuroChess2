# NeuroChess2 Action Registry

This registry is the product governance source of truth for visible and hidden
actions in NeuroChess. It exists to prevent action sprawl, duplicate buttons,
and screens that ask the user to make too many decisions.

## Action Types

- `primary`: the main action of a screen.
- `secondary`: visible supporting action, maximum two per screen.
- `alternative`: visible escape hatch that preserves user autonomy.
- `contextual`: action tied to one object, row, move, or line.
- `advanced`: hidden in advanced options by default.
- `destructive`: risky action that requires confirmation.
- `debug`: never visible in normal UI.

## Governance Rules

- One screen equals one visible primary action.
- A screen may show at most two visible secondary actions.
- A prescriptive screen must provide an alternative action such as "Faire autre chose".
- Advanced actions are hidden by default.
- Debug actions are never visible in normal UI.
- Destructive actions require confirmation.
- User labels must use simple verbs.
- Do not duplicate actions with different labels.
- If an unavailable action teaches nothing, hide it instead of showing a disabled button.

## Labels to Avoid

- "PV Contrast"
- "NeuroScore"
- "Mode Review"
- "Evidence"
- "Standard recommandé" when "Lancer l'analyse recommandée" is already present

## Preferred Labels

- "Essayer"
- "Voir la correction"
- "S'entraîner"
- "Reprendre"
- "Importer PGN"
- "Lancer l'analyse"

## Registry

| action_id | label_user | screen | component | action_type | visible_when | hidden_when | primary_rank | state_transition | data_dependencies | side_effects | requires_confirmation | drives_training | metric_dependencies | fallback_behavior | telemetry_event | known_risks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| nav.logo_home | Accueil | global | NeuroChessLogo | secondary | app shell visible | none | n/a | route -> public.landing | none | navigation | false | false | none | stay on current screen if route fails | nav_logo_home | Can distract during focused work. |
| nav.open_cockpit | Cockpit | global | main navigation | primary | authenticated app | current screen is cockpit | 1 | route -> app.cockpit | user profile | navigation | false | false | none | keep current route | nav_open_cockpit | Too many nav destinations can dilute guidance. |
| nav.open_games | Parties | global | main navigation | secondary | authenticated app | none | n/a | route -> app.games | game library | navigation | false | false | none | show empty library | nav_open_games | Can compete with recommended plan. |
| nav.open_review | Review | global | main navigation | secondary | selected game exists | no selected game | n/a | route -> review area | game_id | navigation | false | false | review_confidence_v1 | prompt to select/import game | nav_open_review | May expose incomplete Review too early. |
| nav.open_training | Entraînement | global | main navigation | secondary | training available | no training surface | n/a | route -> app.training | practice history | navigation | false | true | practice_result_v1 | show recommended import/review | nav_open_training | Can fragment review flow. |
| nav.open_progress | Progression | global | main navigation | secondary | profile available | no progress module | n/a | route -> app.progress | historical metrics | navigation | false | false | headline_score_v1 | show insufficient data state | nav_open_progress | Risk of overclaiming improvement. |
| nav.open_settings | Réglages | global | main navigation | secondary | app shell visible | none | n/a | route -> app.settings | none | navigation | false | false | none | stay current route | nav_open_settings | Technical clutter if promoted. |
| nav.quick_import_pgn | Importer PGN | global | header quick action | alternative | no active task or empty library | focused lesson/practice | n/a | route -> app.games import | clipboard/file | may create game | false | false | none | open games screen | nav_quick_import_pgn | Can interrupt current learning path. |
| cockpit.start_recommended_plan | Commencer mon plan | app.cockpit | Cockpit | primary | plan exists | no actionable data | 1 | cockpit -> recommended next screen | review summary, practice queue | starts/resumes work | false | true | criticality_score_v1, practice_result_v1 | propose import/review | cockpit_start_recommended_plan | Over-prescription if plan evidence is weak. |
| cockpit.do_something_else | Faire autre chose | app.cockpit | Cockpit | alternative | always on prescriptive cockpit | none | n/a | open action chooser | available modules | navigation | false | false | none | show games/review/training choices | cockpit_do_something_else | Too prominent alternative can weaken guidance. |
| cockpit.resume_session | Reprendre | app.cockpit | Cockpit | secondary | active session exists | no active session | n/a | cockpit -> active practice | session_id | resumes session | false | true | practice_result_v1 | start recommended plan | cockpit_resume_session | Confusing if multiple resumable sessions. |
| cockpit.import_game | Importer une partie | app.cockpit | Cockpit | secondary | no recent game or empty state | active recommendation stronger | n/a | cockpit -> games import | PGN | may create game | false | false | none | open games | cockpit_import_game | Can compete with training plan. |
| games.import_pgn | Importer PGN | app.games | Games | primary | games screen | import already active | 1 | open import panel | file/text | may create games | false | false | none | show paste PGN | games_import_pgn | Duplicate with paste if both are primary. |
| games.paste_pgn | Coller PGN | app.games | PGN import | secondary | import panel open | file upload selected | n/a | input PGN text | clipboard/text | none until submit | false | false | none | keep input editable | games_paste_pgn | Can be redundant with import button. |
| games.start_local_game | Jouer localement | app.games | Games | secondary | no import in progress | active review path | n/a | create local game | none | creates game | false | false | none | show error | games_start_local_game | Can distract from review/training purpose. |
| games.open_game | Ouvrir | app.games | Game card | contextual | game row visible | none | n/a | open game | game_id | loads game | false | false | none | stay in library | games_open_game | Too many row actions can crowd cards. |
| games.analyze_game | Analyser | app.games | Game card | contextual | game complete, no review | game too short | n/a | game -> review.empty | game_id | may start review path | false | false | none | explain not reviewable | games_analyze_game | Must not imply instant score. |
| games.open_review | Voir Review | app.games | Game card | contextual | review exists | no review | n/a | game -> review.summary | game_id, review_id | loads review | false | false | review_confidence_v1 | offer analysis | games_open_review | May show stale review if status unclear. |
| games.continue_training | Continuer entraînement | app.games | Game card | contextual | practice session exists | no session | n/a | game -> practice | session_id | resumes session | false | true | practice_result_v1 | open review summary | games_continue_training | Context can be ambiguous across games. |
| games.delete_game | Supprimer | app.games | Game card menu | destructive | game row menu open | never as primary | n/a | delete game | game_id | deletes data | true | false | none | cancel deletion | games_delete_game | Data loss. |
| review.start_recommended_analysis | Lancer l'analyse | app.review.empty | Review empty | primary | game reviewable, no job | job running | 1 | empty -> running_job | game_id, profile | starts review job | false | false | review_confidence_v1 | explain not reviewable | review_start_recommended_analysis | Can look like engine setting if label is technical. |
| review.open_advanced_analysis_options | Options avancées | app.review.empty | Review empty | secondary | review empty | normal summary | n/a | reveal advanced options | game_id | none | false | false | none | keep recommended action visible | review_open_advanced_analysis_options | Can expose deep/reset too early. |
| review.cancel_review_job | Annuler | app.review.running_job | Job status | secondary | job running | no active job | n/a | running_job -> cancelled | job_id | cancels job | true | false | none | keep polling state | review_cancel_review_job | Accidental cancellation. |
| review.resume_review_job | Reprendre | app.review.running_job | Job status | primary | retryable stalled job | no stalled job | 1 | stalled -> running_job | job_id | resumes job | false | false | none | show reconcile option | review_resume_review_job | Could hide real failure cause. |
| review.force_reanalysis | Relancer l'analyse | app.advanced_options | Analysis options | advanced | advanced open | normal UI | n/a | review -> running_job | game_id, profile | starts forced job | true | false | none | keep existing review | review_force_reanalysis | Expensive and confusing. |
| review.reconcile_job | Vérifier | app.review.running_job | Job status | secondary | job needs reconcile | job healthy | n/a | job -> finalizing/done | job_id | reconciles status | false | false | review_confidence_v1 | show current job | review_reconcile_job | May sound like magic repair. |
| review.start_practice | S'entraîner sur cette Review | app.review.summary | Review summary | primary | practice eligible items exist | no eligible items | 1 | summary -> training | review_id, items | starts practice | false | true | criticality_score_v1, practice_result_v1 | show why unavailable | review_start_practice | Must not be disabled without explanation. |
| review.open_key_lesson | Voir la leçon clé | app.review.summary | Review summary | secondary | key moment exists | no annotations | n/a | summary -> learn.challenge | annotation | selects lesson | false | false | criticality_score_v1 | open explorer | review_open_key_lesson | Can compete with training CTA. |
| review.open_explorer | Explorer | app.review.summary | Review summary | secondary | review exists | none | n/a | summary -> explorer | review data | navigation | false | false | none | stay summary | review_open_explorer | Can expose too much detail. |
| review.open_opening_summary | Voir l'ouverture | app.review.summary | Opening module | contextual | opening evidence exists | no opening evidence | n/a | summary -> opening detail | opening_reality_evidence_v1 | navigation | false | false | opening_reality_evidence_v1 | hide action | review_open_opening_summary | Opening can distract from main lesson. |
| lesson.try_move | Essayer | app.review.learn.challenge | ReviewLessonPanel | primary | try_move_supported | unsupported | 1 | challenge -> try | fen_before, legal moves | enters attempt mode | false | true | criticality_score_v1 | show correction as primary | lesson_try_move | Must keep solution hidden. |
| lesson.show_hint | Indice | app.review.learn.challenge | ReviewLessonPanel | secondary | challenge active | correction/training | n/a | challenge -> hint_shown | annotation | reveals non-solution hint | false | false | none | hide if no hint | lesson_show_hint | Hint must not leak best move. |
| lesson.show_correction | Voir la correction | app.review.learn.challenge | ReviewLessonPanel | secondary | challenge active | correction visible | n/a | challenge -> correction | annotation, best move | reveals correction | false | false | pv_contrast_evidence_v1 | show played/correction card | lesson_show_correction | Early reveal can reduce practice value. |
| lesson.show_played_move | Voir ton coup | app.review.learn.correction | ReviewLessonPanel | contextual | correction active | challenge | n/a | correction subview | played move | displays played move | false | false | win_loss_v1 | keep narrative card | lesson_show_played_move | Should not become separate visible step again. |
| lesson.show_line | Voir la ligne | app.review.learn.correction | ReviewLineComparison | secondary | correction active, PV exists | challenge | n/a | correction -> line comparison | pv_contrast_evidence_v1 | opens line view | false | false | pv_contrast_evidence_v1 | hide if unavailable | lesson_show_line | PV can overwhelm users. |
| lesson.retry | Réessayer | app.review.learn.correction | ReviewLessonPanel | secondary | try supported | unsupported | n/a | correction -> challenge/try | fen_before | resets attempt | false | true | practice_result_v1 | hide if unsupported | lesson_retry | Too much retry can delay progression. |
| lesson.continue | Continuer | app.review.learn.correction | ReviewLessonPanel | primary | correction active | challenge | 1 | correction -> training | annotation | advances lesson | false | true | criticality_score_v1 | show next moment if no training | lesson_continue | Must remain the dominant correction CTA. |
| lesson.next_moment | Moment suivant | app.review.learn.training | ReviewLessonPanel | secondary | more moments exist | no moments | n/a | training -> next challenge | annotation list | selects next moment | false | false | criticality_score_v1 | wrap to first moment | lesson_next_moment | Can skip practice recommendation. |
| practice.start_session | Commencer | app.review.training | ReviewPracticePanel | primary | no active session, items exist | no items | 1 | training -> session running | practice items | creates session | false | true | criticality_score_v1, practice_result_v1 | explain no items | practice_start_session | Must not start empty sessions. |
| practice.resume_session | Reprendre | app.review.training | ReviewPracticeHistory | primary | paused session exists | no paused session | 1 | history -> session running | session_id | resumes session | false | true | practice_result_v1 | start new session | practice_resume_session | Multiple sessions can confuse. |
| practice.abandon_session | Quitter | app.review.training | ReviewPracticePanel | secondary | session active | no session | n/a | running -> launch/history | session_id | marks abandoned | true | true | practice_result_v1 | stay session | practice_abandon_session | Loss of session continuity. |
| practice.submit_attempt | Valider | app.review.training | Board interaction | primary | awaiting attempt | not awaiting | 1 | awaiting -> attempted | attempted_uci, item | records attempt | false | true | practice_result_v1 | show illegal feedback | practice_submit_attempt | Board input must be clear. |
| practice.reveal_solution | Voir la correction | app.review.training | ReviewPracticePanel | secondary | item active | solution shown | n/a | item -> solution_revealed | best_move | records reveal | false | true | practice_result_v1 | hide after reveal | practice_reveal_solution | Can become an easy escape. |
| practice.skip_item | Passer | app.review.training | ReviewPracticePanel | alternative | item active | completed | n/a | item -> next | item_id | records skip | false | true | practice_result_v1 | next item or summary | practice_skip_item | Skip overuse reduces learning. |
| practice.retry_failed | Revoir les ratées | app.review.training | ReviewPracticeHistory | primary | failed items exist | no failures | 1 | summary/history -> session | summary | creates retry session | false | true | practice_result_v1 | hide if none | practice_retry_failed | Can feel punitive if label is harsh. |
| practice.redo_all | Tout refaire | app.review.training | ReviewPracticePanel | secondary | completed session | no session | n/a | summary -> new session | session items | creates new session | false | true | practice_result_v1 | hide if unavailable | practice_redo_all | Repetition without spacing can fatigue. |
| practice.view_summary | Voir résumé | app.review.training | ReviewPracticeHistory | contextual | session exists | none | n/a | history -> summary | session_id | loads summary | false | false | practice_result_v1 | show unavailable | practice_view_summary | Summary can overfocus on score. |
| explorer.select_move | Sélectionner | app.review.explorer | ReviewExplorerPanel | contextual | move row visible | none | n/a | explorer -> selected move | ply | highlights move | false | false | none | stay selection | explorer_select_move | Too many selected states can confuse. |
| explorer.open_lesson_for_move | Voir la leçon | app.review.explorer | ReviewExplorerPanel | primary | annotation selected | no annotation | 1 | explorer -> learn.challenge | annotation | opens lesson | false | false | criticality_score_v1 | show empty state | explorer_open_lesson_for_move | Could bypass summary guidance. |
| explorer.add_to_training | Ajouter à l'entraînement | app.review.explorer | ReviewExplorerPanel | contextual | future training engine available | not available | n/a | selected -> training queue | annotation | adds item | false | true | domain_scores, criticality_score_v1 | hide until implemented | explorer_add_to_training | Future feature must avoid manual clutter. |
| explorer.replay_line | Rejouer la ligne | app.review.explorer | ReviewPvStepper | contextual | PV exists | no PV | n/a | selected -> line replay | pv_line | starts replay | false | false | pv_contrast_evidence_v1 | hide if no PV | explorer_replay_line | Can become engine-lab first. |
| opening.review_exit | Revoir la sortie | app.review.explorer | ReviewOpeningPanel | contextual | opening exit exists | no opening evidence | n/a | opening -> board exit | opening evidence | displays exit | false | false | opening_reality_evidence_v1 | hide action | opening_review_exit | Opening details can distract. |
| opening.show_linked_moment | Voir le moment lié | app.review.explorer | ReviewOpeningPanel | contextual | linked moment exists | no linked moment | n/a | opening -> learn.challenge | linked annotation | selects moment | false | false | opening_reality_evidence_v1 | explain no issue | opening_show_linked_moment | Must not imply opening caused every error. |
| opening.save_intention_note | Enregistrer | app.review.explorer | ReviewOpeningPanel | secondary | note edited | no note field | n/a | note -> saved | text note | writes local note | false | false | none | keep draft | opening_save_intention_note | Notes can become clutter. |
| advanced.run_deep_analysis | Analyse approfondie | app.advanced_options | ReviewTechnicalDetails | advanced | advanced open | normal UI | n/a | options -> job | game_id, profile | starts deep job | false | false | none | keep standard analysis | advanced_run_deep_analysis | Expensive and technical. |
| advanced.reset_analysis | Réinitialiser l'analyse | app.advanced_options | ReviewTechnicalDetails | destructive | advanced open | normal UI | n/a | review -> empty/running | game_id | clears/rebuilds review | true | false | none | cancel reset | advanced_reset_analysis | Data loss or confusion. |
| advanced.rebuild_metrics | Recalculer les métriques | app.advanced_options | ReviewTechnicalDetails | advanced | metrics need rebuild | not needed | n/a | review -> updated metrics | review data | recomputes metrics only | false | false | metric registry | hide if current | advanced_rebuild_metrics | Could look like engine reanalysis. |
| advanced.show_engine_settings | Voir réglages moteur | app.advanced_options | ReviewTechnicalDetails | advanced | advanced open | normal UI | n/a | reveal settings | engine config | none | false | false | reliability_weight_v1 | keep collapsed | advanced_show_engine_settings | Encourages tuning over learning. |
| advanced.show_score_debug | Voir debug score | app.advanced_options | ReviewScoreDetails | debug | dev/debug mode | normal UI | n/a | reveal debug | score internals | none | false | false | neuro_score_raw_v1, diagnostic_gap_v1 | hide | advanced_show_score_debug | Raw metrics can mislead. |
| advanced.show_pv_evidence | Voir preuves PV | app.advanced_options | ReviewPvContrastDebugList | debug | dev/debug mode or lab advanced | normal UI | n/a | reveal PV evidence | pv_contrast_evidence_v1 | none | false | false | pv_contrast_evidence_v1 | hide | advanced_show_pv_evidence | Evidence JSON can overwhelm. |
| advanced.clear_cache | Vider le cache | app.advanced_options | Settings/Debug | destructive | advanced debug mode | normal UI | n/a | cache -> empty | cache keys | clears cache | true | false | none | cancel clear | advanced_clear_cache | Can remove useful state. |

## Screen-Level Limits

- Primary action count must be exactly one for prescriptive screens.
- Secondary action count must not exceed two.
- Contextual row actions are allowed, but must not visually compete with the screen primary action.
- Advanced and debug actions belong behind disclosure controls.
- V5.4 Review polish applies these limits visually: Summary has one dominant training CTA, Learn exposes at most three actions per public state, Training is state-driven, and Explorer keeps technical actions contextual or folded.

## Rules for future Codex missions

- Any new metric must be added to the Metric Registry.
- Any new action must be added to Action Registry.
- Any new screen or tab must be added to Screen Contracts.
- If a mission introduces or uses an action without updating this registry, the mission is incomplete.
