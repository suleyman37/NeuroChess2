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
| nav.open_today | Aujourd'hui | global | main navigation | primary | app shell visible | current screen is Aujourd'hui | 1 | app shell -> today | selected game, review, practice state | navigation | false | true | none | show profile en construction or import CTA | nav_open_today | Must stay actionable without becoming a dashboard. |
| nav.open_games | Mes parties | global | main navigation | secondary | app shell visible | current screen is Mes parties | n/a | app shell -> games | game library | navigation | false | false | none | show empty library/import panel | nav_open_games | Can compete with recommended plan if promoted as the only start point. |
| nav.open_review_contextual | Voir Review | app.today/app.games/app.training | contextual CTA | contextual | review exists or can be generated for selected game | no selected game and no review | n/a | current flow -> review context | game_id, review_id/job | navigation or analysis start | false | true | review_confidence_v1 | prompt to select/import game | nav_open_review_contextual | Review must not return as permanent main navigation. |
| nav.open_training | Entraînement | global | main navigation | secondary | app shell visible | current screen is Entrainement | n/a | app shell -> training | practice history | navigation | false | true | practice_result_v1 | show recommended import/review | nav_open_training | Can fragment review flow if too many modes are exposed. |
| nav.open_progress | Progression | global | main navigation | secondary | profile available | no progress module | n/a | route -> app.progress | historical metrics | navigation | false | false | headline_score_v1 | show insufficient data state | nav_open_progress | Risk of overclaiming improvement. |
| nav.open_settings | Profil / Paramètres | global | header/top-right | secondary | app shell visible | none | n/a | header -> profile privacy panel | local app state | opens/closes panel | false | false | none | stay current screen | nav_open_settings | Must stay outside the main Plan2 nav. |
| profile.export_data | Exporter mes données | app.settings | Profile/Privacy panel | secondary | profile panel open | export already running | n/a | profile panel -> export status | local DB export | downloads `neurochess-export.json` from `GET /api/export` | false | false | none | show export error | profile_export_data | Export can include sensitive local PGN/history data. |
| profile.request_delete_data | Supprimer mes données | app.settings | Profile/Privacy panel | destructive | profile panel open | delete confirmation already open | n/a | profile panel -> delete confirmation | none | no deletion on first click | true | false | none | show confirmation copy | profile_request_delete_data | First click must never delete data. |
| profile.confirm_delete_data | Confirmer la suppression | app.settings | Profile/Privacy panel | destructive | confirmation input equals `SUPPRIMER` | confirmation missing or wrong | n/a | delete confirmation -> empty local profile state | local user data tables | calls `DELETE /api/user-data?confirm=SUPPRIMER` and clears local view state | true | false | none | keep data and explain confirmation | profile_confirm_delete_data | Data loss if confirmation or temp DB isolation regresses. |
| nav.quick_import_pgn | Importer PGN | global | header quick action | alternative | no active task or empty library | focused lesson/practice | n/a | route -> app.games import | clipboard/file | may create game | false | false | none | open games screen | nav_quick_import_pgn | Can interrupt current learning path. |
| today.follow_recommendation | Réviser / Voir la Review / Reprendre Practice / Importer une partie | app.today | Today hero | primary | app shell visible | none | 1 | today -> due revision Practice, review context, practice context, analysis state, or games import | selected game, review availability, practice session, revision_due_simple_v1 | navigation or due Practice start | false | true | revision_due_simple_v1, practice_result_v1 | show profile en construction or analysis in progress | today_follow_recommendation | The label must match the real available next step. |
| training.start_daily_plan | Réviser / Commencer / Reprendre | app.training | Training hero / Plan du jour | primary | due revisions, active Practice, practice-ready Review, contextual Review, or import fallback exists | analysis in progress without actionable Review | 1 | training -> due revision Practice, Review Practice, Review context, or Mes parties import | review status, practice state, practice history, revision_due_simple_v1 | starts/resumes existing Review Practice or navigates to Review/import | false | true | revision_due_simple_v1, practice_result_v1 | show `Profil en construction` or disabled analysis-in-progress state | training_start_daily_plan | Must remain the only primary action on Entrainement. |
| training.review_failed_positions | Revoir / Voir | app.training | Mes positions ratees card | secondary | active Practice or existing Practice history | no Practice history | n/a | training -> Review Practice retry or session summary | practice session id, failed_count | may start retry session for failed positions or show an existing summary | false | true | practice_result_v1 | show `Profil en construction` as status text | training_review_failed_positions | Must not become a separate Candidate Trainer or fourth mode. |
| training.start_due_revisions | Réviser | app.training | Révisions card | secondary | due_count > 0 | no due positions | n/a | training -> due revision Practice | selected game, revision_due_simple_v1 | creates due Review Practice session from due positions | false | true | revision_due_simple_v1, practice_result_v1 | show `À venir` or `Profil en construction` | training_start_due_revisions | Must stay one of the 3 Training entries, not a new mode. |
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
| review.change_analyzed_player | Moi / Blancs / Noirs / Les deux | app.review.summary | ReviewPovSelector | secondary | Review score/summary visible | `Moi` hidden when user_color unknown | n/a | Review summary/filter -> selected POV | review.user_color, annotation color | local filter/orientation preference only | false | false | none | default unknown identity to Les deux and explain color unknown | review_change_analyzed_player | `Moi` must never imply a known identity when user_color is unknown; `Les deux` must orient the board per current moment/item. |
| review.start_local_exploration | Explorer la position | app.review.board | Board area | secondary | review board has a valid FEN and no Practice session is active | Practice running or no FEN | n/a | passive board -> exploration locale | selected Review FEN | local frontend board state only | false | false | none | keep passive Review board | review_start_local_exploration | Must not imply AI/opponent or save attempts. |
| review.analyze_local_exploration_move | Analyser ce coup | app.review.board | Board exploration panel | secondary | latest local exploration move is not evaluated | exploration inactive, no latest move, analysis already running, or move already evaluated | n/a | unevaluated exploration move -> stable local feedback | fen_before, move_uci, Review context | calls `POST /api/review/explorer/evaluate-move`; may write bounded position-analysis cache only; never writes Practice attempts, training items, `due_at`, or Daily Plan | false | false | try_move_model_version | show `À recalculer` / `Non évalué` if stable analysis is unavailable | review_analyze_local_exploration_move | Must not become Practice or imply a saved exercise. |
| review.flip_local_exploration_board | Tourner l'échiquier | app.review.board | Board exploration panel | secondary | exploration active | exploration inactive | n/a | local board orientation white <-> black | local board orientation state | local frontend state only | false | false | none | keep current orientation if unavailable | review_flip_local_exploration_board | Must not change analyzed player, selected POV, Review moment side, or Practice orientation. |
| review.live_analysis_position | Analyse live | app.review.board | Board evaluation strip | contextual | Review board or Review exploration has a valid displayed FEN and no Review job/Practice challenge is active | Review job running or active Practice challenge | n/a | displayed FEN -> lightweight live eval | current displayed FEN | starts/stops live analysis session only | false | false | none | show pause/unavailable copy | review_live_analysis_position | Must never create Review jobs, training items, attempts, due_at, or answer spoilers in Practice. |
| review.undo_local_exploration | Annuler le coup | app.review.board | Board exploration panel | secondary | exploration move history not empty | exploration inactive | n/a | exploration current FEN -> previous FEN | local exploration history | local frontend board state only | false | false | none | show calm no-move message | review_undo_local_exploration | Must not alter Review/Practice data. |
| review.reset_local_exploration | Reinitialiser | app.review.board | Board exploration panel | secondary | exploration active | exploration inactive | n/a | exploration current FEN -> base Review FEN | base Review FEN | local frontend board state only | false | false | none | stay on current exploration state if reset fails | review_reset_local_exploration | Must not alter Review/Practice data. |
| review.exit_local_exploration | Quitter l'exploration | app.review.board | Board exploration panel | alternative | exploration active | exploration inactive | n/a | exploration -> passive Review board | none | local frontend state cleared | false | false | none | stay in exploration if close fails | review_exit_local_exploration | Must not create a hidden fourth mode. |
| review.open_opening_summary | Voir l'ouverture | app.review.summary | Opening module | contextual | opening evidence exists | no opening evidence | n/a | summary -> opening detail | opening_reality_evidence_v1 | navigation | false | false | opening_reality_evidence_v1 | hide action | review_open_opening_summary | Opening can distract from main lesson. |
| lesson.try_move | Essayer | app.review.learn.challenge | ReviewLessonPanel | primary | try_move_supported | unsupported | 1 | challenge -> try | fen_before, legal moves | enters attempt mode | false | true | criticality_score_v1 | show correction as primary | lesson_try_move | Must keep solution hidden. |
| lesson.show_hint | Indice | app.review.learn.challenge | ReviewLessonPanel | secondary | challenge active | correction/training | n/a | challenge -> hint_shown | annotation | reveals non-solution hint | false | false | none | hide if no hint | lesson_show_hint | Hint must not leak best move. |
| lesson.show_correction | Voir la correction | app.review.learn.challenge | ReviewLessonPanel | secondary | challenge active | correction visible | n/a | challenge -> correction | annotation, best move | reveals correction | false | false | pv_contrast_evidence_v1 | show played/correction card | lesson_show_correction | Early reveal can reduce practice value. |
| lesson.show_played_move | Voir ton coup | app.review.learn.correction | ReviewLessonPanel | contextual | correction active | challenge | n/a | correction subview | played move | displays played move | false | false | win_loss_v1 | keep narrative card | lesson_show_played_move | Should not become separate visible step again. |
| lesson.show_line | Voir la ligne / Lire la ligne jouee / Lire la ligne solution | app.review.learn.correction | ReviewLineComparison + ReviewPvStepper | secondary/contextual | correction active, playable PV exists | challenge or no playable line | n/a | correction -> line comparison -> visible line playback | pv_contrast_evidence_v1 | opens contextual line actions; selected line shows active context, step label, current move, controls, and board/FEN change on next step | false | false | pv_contrast_evidence_v1 | hide or disable with calm unavailable copy | lesson_show_line | PV can overwhelm users; a visible line button must never be a no-op. |
| lesson.retry | Réessayer | app.review.learn.correction | ReviewLessonPanel | secondary | try supported | unsupported | n/a | correction -> challenge/try | fen_before | resets attempt | false | true | practice_result_v1 | hide if unsupported | lesson_retry | Too much retry can delay progression. |
| lesson.continue | Continuer | app.review.learn.correction | ReviewLessonPanel | primary | correction active | challenge | 1 | correction -> training | annotation | advances lesson | false | true | criticality_score_v1 | show next moment if no training | lesson_continue | Must remain the dominant correction CTA. |
| lesson.next_moment | Moment suivant | app.review.learn.training | ReviewLessonPanel | secondary | more moments exist | no moments | n/a | training -> next challenge | annotation list | selects next moment | false | false | criticality_score_v1 | wrap to first moment | lesson_next_moment | Can skip practice recommendation. |
| practice.start_session | Commencer | app.review.training | ReviewPracticePanel | primary | no active session, items exist | no items | 1 | training -> session running | practice items | creates session | false | true | criticality_score_v1, practice_result_v1 | explain no items | practice_start_session | Must not start empty sessions. |
| practice.resume_session | Reprendre | app.review.training | ReviewPracticeHistory | primary | paused session exists | no paused session | 1 | history -> session running | session_id | resumes session | false | true | practice_result_v1 | start new session | practice_resume_session | Multiple sessions can confuse. |
| practice.abandon_session | Quitter | app.review.training | ReviewPracticePanel | secondary | session active | no session | n/a | running -> launch/history | session_id | marks abandoned | true | true | practice_result_v1 | stay session | practice_abandon_session | Loss of session continuity. |
| practice.submit_attempt | Valider | app.review.training | Board interaction | primary | awaiting attempt | not awaiting | 1 | awaiting -> attempted | attempted_uci, item | records attempt | false | true | practice_result_v1 | show illegal feedback | practice_submit_attempt | Board input must be clear. |
| practice.reveal_solution | Voir la correction | app.review.training | ReviewPracticePanel | secondary | item active | solution shown | n/a | item -> solution_revealed | best_move | records reveal | false | true | practice_result_v1 | hide after reveal | practice_reveal_solution | Can become an easy escape. |
| practice.skip_item | Passer | app.review.training | ReviewPracticePanel | alternative | item active | completed | n/a | item -> next | item_id | records skip | false | true | practice_result_v1 | next item or summary | practice_skip_item | Skip overuse reduces learning. |
| practice.next_item_after_success | Position suivante / Terminer la session | app.review.training | ReviewPracticePanel | primary | current item has best/very_good/acceptable feedback | wrong/illegal attempt or no feedback | 1 | current item -> next item or session complete | session_id, item index, practice feedback | local state transition only; next resets board/feedback/user move/line playback; finish completes visible session state | false | true | practice_result_v1 | keep retry/correction for wrong/illegal | practice_next_item_after_success | A success/accepted state must not leave the user hunting for the next action. |
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

- P1 Degraded States / Anti-Tilt note: recovery actions are now registered as
  state-driven UI actions, not new product modes. `games.import_pgn` may show
  `IMPORT_EMPTY_PGN`, `IMPORT_INVALID_PGN`, `IMPORT_ILLEGAL_MOVES`, or
  `IMPORT_DUPLICATE_GAME` via `StateNotice`. `training.start_daily_plan` may
  show `DAILY_PLAN_EMPTY`, `DAILY_PLAN_PARTIAL`, or
  `DAILY_PLAN_CREATE_FAILED`. `practice.submit_attempt` may show
  `PRACTICE_ATTEMPT_SAVE_FAILED`, `PRACTICE_ILLEGAL_MOVE`, or
  `ANTI_TILT_REPEATED_WRONG`. These notices keep one primary action, collapsed
  technical details, and no hidden training side effect unless the user starts
  or resumes Practice explicitly.

- V5.6 Daily Plan note: `today.follow_recommendation` and
  `training.start_daily_plan` now prefer the deterministic backend Daily Plan
  when one exists. `training.start_daily_plan` calls
  `POST /api/training/daily-plan` or
  `POST /api/training/daily-plan/practice`, remains the only primary action on
  `app.training`, and must never expose `selection_score`, ETV, SkillTrace
  mastery, Candidate Trainer, or Transfer Gap.

- P0 Core board interaction note: `practice.submit_attempt` is now proven in
  browser by click-click board input for correct, wrong legal, and illegal
  attempts. `practice.reveal_solution` remains a fallback and is also
  browser-proven to persist `reveal_used=true`. Review/Daily Plan Practice
  attempts remain backend-authored through
  `POST /review/practice/sessions/{session_id}/attempts`.
- P0 Practice feedback trust note: `practice.submit_attempt` and Review
  `lesson.try_move` now use backend canonical move classification. If the
  normalized attempted move equals the normalized best move or accepted moves,
  the action must return/display success or accepted feedback, never a problem
  label or missed-best reproach. Legacy unparseable Review data must ask for
  reanalysis/rebuild instead of saving a false wrong attempt.

- P0 real-runtime exploration note: `review.start_local_exploration`,
  `review.undo_local_exploration`, `review.reset_local_exploration`, and
  `review.exit_local_exploration` are local-only Review board actions. They
  must never call the Practice attempt endpoint, create `due_at`, or update
  `learning_summary`.
- P1 Explorer stable feedback note: `review.analyze_local_exploration_move`
  evaluates only the latest local exploration move through the explicit
  side-effect-safe Explorer endpoint. It may create bounded position-analysis
  cache rows, but must never create Practice attempts, training items, `due_at`,
  or Daily Plan rows. `review.flip_local_exploration_board` is pure UI state.

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
