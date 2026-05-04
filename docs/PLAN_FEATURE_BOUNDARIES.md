# Plan Feature Boundaries

Plan status uses Plan1/Plan2/Plan3 as source of truth. "Visible UI V1" means
normal user-facing interface, not folded Explorer/debug/research docs.

| Feature | Statut selon Plan | Visible en UI V1 ? | Backend autorise ? | Conditions d'activation | Fichiers concernes si deja present | Decision |
|---|---|---:|---:|---|---|---|
| PGN import | V1 | yes | yes | User imports/copies PGN; no automatic mass analysis | `backend/neurochess/pgn_import_service.py`, `frontend/src/App.tsx` | keep |
| Stockfish analysis | V1 | yes, as status only | yes | Backend-authoritative, versioned, profile-aware | `backend/neurochess/analysis_service.py`, `backend/neurochess/engines/*` | keep |
| Win% | V1 | indirect | yes | Human-readable impact/score support, not raw engine truth alone | `backend/neurochess/metrics/review_metrics.py` | keep |
| player_win_percent | V1 | indirect | yes | Use player POV for Review explanations | `backend/neurochess/review_service.py`, `frontend/src/api/client.ts` | keep |
| win_loss | V1 | indirect | yes | Translate as impact/chance loss; avoid raw overload | `backend/neurochess/metrics/review_metrics.py`, `frontend/src/components/review/*` | keep |
| move_accuracy | V1 | indirect | yes | Support reference precision and internal scoring | `backend/neurochess/metrics/review_metrics.py` | keep |
| game_accuracy | V1 | yes, secondary | yes | Display as reference precision, collapsed/secondary | `backend/neurochess/metrics/review_metrics.py`, `ReviewCockpitSummary.tsx` | simplify |
| NeuroScore coach | V1 | yes | yes | Main Review score; heuristic and human-facing | `backend/neurochess/metrics/review_metrics.py`, `ReviewCockpitSummary.tsx` | keep |
| precision de reference | V1 | yes, secondary/collapsed | yes | Explain as reference precision, not competing main score | `ReviewCockpitSummary.tsx`, `ReviewScoreDetails.tsx` | simplify |
| criticality | V1 action interne | no raw | yes | Moment selection only; no raw score in normal UI | `backend/neurochess/review_service.py`, `frontend/src/api/client.ts` | hide |
| moment selection | V1 | yes as selected moments | yes | Max 3 key moments in Summary | `backend/neurochess/review_service.py`, `ReviewCockpitSummary.tsx` | keep |
| taxonomy V0 | V1 | yes as simple tags | yes | Simple pedagogical labels only | `backend/neurochess/metrics/pedagogy.py`, `reviewLabels.ts` | keep |
| Review summary | V1 | yes | yes | Score, one interpretation, 3 moments, training card | `frontend/src/components/review/ReviewCockpitSummary.tsx` | simplify |
| Lecture rapide | V1 | yes | yes | 3 min read, no forced exercise | `ReviewFocusTabs.tsx`, `ReviewLessonPanel.tsx` | keep |
| Lecon complete | V1 | yes | yes | Active learning path from key moments | `ReviewLessonPanel.tsx` | keep |
| Practice | V1 | yes | yes | Review-derived positions, one primary action | `review_practice_service.py`, `ReviewPracticePanel.tsx` | keep |
| practice_result_event | V1 | no direct | yes | Store attempts/results/hints/reveals/time/source/due_at | `review_practice_service.py`, API schemas/routes, tests | keep |
| SkillTrace Beta | V1 shadow | no | yes | Alpha/beta/log recommendations internally only; no mastery score or Daily Plan authority before V1.1 exit criteria | docs only / future backend | backlog |
| simple_spaced_repetition_v1 | V1 | minimal plain counts | yes | Wrong/reveal due soon, hint 3 days, clean success 7 days, repeated success multiplier later; never label as FSRS | `review_practice_service.py`, `frontend/src/App.tsx`, docs | keep |
| FSRS real | V2 / V3 | no | yes, future | Only after dedicated memory-model sprint and validation | docs only | backlog |
| ETV | V1/V2 internal | no | yes | Internal prioritization only | `docs/LEARNING_ENGINE_BLUEPRINT.md` | backlog |
| Daily Plan | V1 deterministic | yes | yes | Due items, recent failures, critical recent items, tag diversity, anti-redundancy; SkillTrace shadow observes only | `frontend/src/App.tsx`, future daily plan service | backlog |
| Aujourd'hui | V1 | yes | yes | Main "what now" screen | `frontend/src/App.tsx` | simplify |
| Mes parties | V1 | yes | yes | Game library/import/review entry | `frontend/src/App.tsx`, `pgn_import_service.py` | simplify |
| Entrainement | V1 | yes | yes | Plan du jour, missed positions, revisions only | `frontend/src/App.tsx`, Review Practice services | keep |
| Profil/Parametres | V1 | yes | yes | Minimal preferences/privacy/engine/data controls | missing/minimal | backlog |
| Anti-tilt | V1 | yes | yes | Recent loss tone and defer/review choices | missing | backlog |
| degraded states | V1 | yes | yes | Clear recovery messages, no jargon | `reviewState.ts`, `ReviewTechnicalDetails.tsx` | keep |
| offline | V1 partial | yes, badge/state | yes | Calculated Reviews/Practice/import queue only | missing | backlog |
| NeuroMonitor / brain visual | research / forbidden-user-facing | no | no for V1 UI | Research docs only; no normal UI | removed from `frontend/src` | remove |
| Cognitive Map | V1.1 / research | no | no for V1 UI | Compact progress only in V1; visual map waits for V1.1 data thresholds | removed visual files / docs | backlog |
| Candidate Trainer | V2 | no | yes, future | Opt-in only after V2 decision | not implemented visibly | backlog |
| Intent Layer | V2 opt-in | no normal | yes, limited | Skippable coach/candidates modes later | `openingIntentionNote` local note in Review Explorer | hide |
| LLM coach | V3 research | no | placeholder only | Verifier + evidence grounding required | `backend/neurochess/llm/__init__.py` | backlog |
| Transfer Gap | V2 | no | yes, future | Enough Practice and future-game data | docs only | backlog |
| domain scores | V2/research | no | yes, future | Calibrated and sufficient data only | docs/registry; removed UI heuristics | hide |
| Privacy/export/delete | V1 required | yes | yes | Profile/settings must support data export and complete delete before V1 external release | missing/minimal | backlog |
| i18n centralized strings | V1 hygiene | no separate feature | yes | V1 stays French; new UI strings should move toward centralized `fr.ts`/`strings.ts` without language switch | scattered strings in frontend | backlog |
