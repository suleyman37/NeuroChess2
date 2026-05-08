# DOCUMENT MAÎTRE FINAL — PLAN 3/3 NEUROCHESS
## ARCHITECTURE TECHNIQUE, ROADMAP D’EXÉCUTION, GOUVERNANCE CODEX, TESTS, RELEASE, QUALITÉ, SÉCURITÉ ET LIVRAISON

Version : Plan d’exécution technique v4.0 FINAL — 20/20 — Codex-ready
Statut : source de vérité technique, exécution, livraison et gouvernance de NeuroChess
Remplace : Plan3 v2.2
Compatibilité : à lire avec Plan1 v3.0 FINAL — Constitution scientifique et Plan2 v4.0 FINAL — UX/Product/Interface
Langue produit V1 : français
Doctrine centrale : construire la plus petite boucle complète qui prouve NeuroChess, sans scope creep, sans fake science, sans dette invisible

============================================================
AVERTISSEMENT D’USAGE POUR CODEX ET TOUT AGENT IA
============================================================

Ce document est une constitution d’exécution, pas une mission unique.

Règles absolues :

1. Ne jamais appliquer tout ce Plan 3 d’un coup.
2. Ne jamais transformer une section V2/V3 en fonctionnalité V1 sans mission explicite.
3. Ne jamais modifier Stockfish, les formules scientifiques, les métriques ou les thresholds sans mission dédiée.
4. Ne jamais ajouter une feature sans contrat utilisateur, contrat data, contrat API, tests, état vide, état loading, état erreur, recovery et rapport.
5. Ne jamais exposer en UI une métrique interdite par Plan1.
6. Ne jamais ajouter en V1 : Candidate Trainer, LLM coach, Intent Layer profond, Transfer Gap visible, ETV visible, FSRS visible, NeuroMonitor, brain, cortex, atlas.
7. Ne jamais ajouter un quatrième onglet principal en V1.
8. Ne jamais faire de refactor global opportuniste.
9. Ne jamais faire git add -A.
10. Ne jamais stage/commit par défaut.
11. Une mission Codex = un objectif précis = un diff contrôlé = tests = rapport.
12. Si Codex reçoit ce document sans mission explicite, il doit répondre :
   “Plan 3 compris. Quelle mission précise dois-je exécuter ?”

Canonical marker: PLAN3 MISSION CONTROL
Canonical marker: ONE MISSION ONE DIFF TESTS REPORT
Canonical marker: NO COMMIT NO STAGE BY DEFAULT
Canonical marker: DO NOT IMPLEMENT FULL PLAN

============================================================
0. RÔLE DES TROIS PLANS
============================================================

NeuroChess est gouverné par trois documents maîtres.

------------------------------------------------------------
0.1 Plan1
------------------------------------------------------------

Fichier canonique :

plan/Plan1.txt

Rôle :

source de vérité scientifique.

Version attendue :

Plan1 v3.0 FINAL — Codex-ready

Le Plan1 décide :

- vérité moteur ;
- Win% ;
- perte de chances ;
- score coach ;
- moments critiques ;
- training_items ;
- practice events ;
- répétition espacée ;
- SkillTrace shadow ;
- Transfer Opportunity Model ;
- claims autorisés/interdits ;
- limites neuro ;
- validation scientifique.

Règle :

Si un choix technique contredit Plan1, il est rejeté.

------------------------------------------------------------
0.2 Plan2
------------------------------------------------------------

Fichier canonique :

plan/Plan2.txt

Rôle :

source de vérité UX / produit / interface.

Version attendue :

Plan2 v4.0 FINAL — 20/20 — Codex-ready

Le Plan2 décide :

- navigation ;
- écrans ;
- boutons ;
- design system ;
- microcopy ;
- états ;
- action registry ;
- data-testid ;
- modales ;
- toasts ;
- empty states ;
- board UX ;
- exploration locale ;
- anti-tilt ;
- accessibility ;
- responsive.

Règle :

Si une implémentation crée un bouton non défini, un écran non utile, une métrique visible interdite ou une friction inutile, elle est rejetée.

------------------------------------------------------------
0.3 Plan3
------------------------------------------------------------

Fichier canonique :

plan/Plan3.md

Rôle :

source de vérité technique, exécution, tests, release, qualité, gouvernance Codex.

Le Plan3 décide :

- ordre de construction ;
- architecture technique ;
- contracts API ;
- migrations ;
- job system ;
- observability ;
- tests ;
- browser smokes ;
- release gates ;
- rollback ;
- risk register ;
- prompt template ;
- mission protocol ;
- dirty worktree protocol ;
- release candidate ;
- postmortem ;
- governance.

Règle :

Plan3 ne définit pas la science ni l’UX finale.
Plan3 définit comment on livre sans casser Plan1 et Plan2.

------------------------------------------------------------
0.4 Anciennes versions
------------------------------------------------------------

Les anciennes versions de Plan1/Plan2/Plan3, copies téléchargées, backups, résumés précédents ou mémoire modèle doivent être ignorés s’ils contredisent les fichiers canoniques dans /plan.

============================================================
1. THÈSE CENTRALE DU PLAN3
============================================================

Plan3 est le centre de commandement technique de NeuroChess.

Sa mission est simple :

transformer une vision scientifique et UX ambitieuse en une application stable, testable, livrable et évolutive.

Phrase directrice :

On construit d’abord un coach utilisable.
On ferme ensuite la boucle d’apprentissage.
On ajoute enfin les couches révolutionnaires, seulement quand elles sont mesurées.

NeuroChess doit être construit comme un vaisseau spatial :

- chaque système a un contrat ;
- chaque lancement a une checklist ;
- chaque anomalie a un recovery ;
- chaque mission a un objectif ;
- chaque diff doit pouvoir être relu ;
- chaque donnée utilisateur doit être protégée ;
- chaque retour en arrière doit être possible.

La V1 ne doit pas être une V3 amputée.

La V1 doit être :

la plus petite boucle complète qui prouve la promesse NeuroChess.

Boucle V1 :

Import PGN
→ Analyse
→ Review
→ Exploration locale
→ Practice
→ Attempt riche
→ due_at
→ Daily Plan
→ Révision
→ Progression compacte
→ Export/Delete
→ Browser QA
→ Release candidate

============================================================
2. OBJECTIFS DE LIVRAISON
============================================================

------------------------------------------------------------
2.1 Alpha utilisable
------------------------------------------------------------

Objectif :

stabiliser l’expérience principale.

Inclut :

- app shell ;
- Today ;
- Games ;
- import PGN ;
- analyse standard ;
- Review summary ;
- board Review ;
- Practice focus ;
- attempt/reveal path ;
- browser smoke minimal.

Critère :

un utilisateur interne peut importer une partie, comprendre une Review, et tenter une position.

Limite :

la boucle d’apprentissage n’est pas totalement fermée.

------------------------------------------------------------
2.2 V1 réelle
------------------------------------------------------------

Objectif :

fermer la boucle minimale NeuroChess.

Inclut :

- training_items durables ;
- practice attempts riches ;
- simple_spaced_repetition_v1 ;
- Daily Plan déterministe ;
- due reviews ;
- progression compacte ;
- Profile/Privacy ;
- export/delete ;
- board interaction réelle ;
- exploration locale ;
- états dégradés ;
- responsive minimum ;
- QA release candidate.

Critère :

NeuroChess n’est plus seulement un analyseur.
Les erreurs deviennent des exercices.
Les exercices reviennent.
L’utilisateur sait quoi faire aujourd’hui.

------------------------------------------------------------
2.3 V1.1
------------------------------------------------------------

Objectif :

fiabiliser, mesurer, polir.

Inclut :

- i18n strings centralisées ;
- mobile smoke complet ;
- accessibility pass ;
- SkillTrace shadow ;
- Good Decision Mining light ;
- benchmark diagnostic léger ;
- better degraded states ;
- performance budget observability ;
- first external user cohort.

------------------------------------------------------------
2.4 V2
------------------------------------------------------------

Objectif :

différenciation forte.

Inclut :

- Intent Light ;
- Candidate Trainer opt-in ;
- near-transfer variants ;
- motif-based repetition ;
- progression détaillée ;
- Lichess/Chess.com sync ;
- notifications douces ;
- sandbox complète ;
- Transfer Opportunity logging actif.

------------------------------------------------------------
2.5 V3
------------------------------------------------------------

Objectif :

système avancé / recherche / produit premium.

Inclut :

- LLM coach vérifié ;
- Transfer Gap visible prudent ;
- SkillTrace hiérarchique ;
- MIRT ;
- contextual bandit ;
- opening repertoire model ;
- endgame curriculum ;
- coach/club mode ;
- advanced audit.

============================================================
3. PRINCIPES D’INGÉNIERIE
============================================================

------------------------------------------------------------
3.1 Pas de feature sans contrat
------------------------------------------------------------

Chaque fonctionnalité doit avoir :

- contrat utilisateur ;
- contrat data ;
- contrat API ;
- contrat UI ;
- état vide ;
- état loading ;
- état erreur ;
- recovery ;
- tests ;
- acceptance criteria ;
- rollback plan ;
- docs ;
- source planifiée : Plan1 / Plan2 / Plan3.

Si un de ces éléments manque, la feature n’est pas prête.

------------------------------------------------------------
3.2 Pas de métrique sans registry
------------------------------------------------------------

Toute métrique doit avoir :

- metric_id ;
- formula_version ;
- purpose ;
- visible_user ;
- drives_training ;
- calibration_status ;
- limitations ;
- source_semantics ;
- owner ;
- date_added ;
- tests de non-régression.

Règle :

Une métrique non calibrée peut être stockée.
Elle ne doit pas être affichée comme vérité.

------------------------------------------------------------
3.3 Pas de bouton sans Action Registry
------------------------------------------------------------

Tout bouton doit avoir :

- action_id ;
- label_user ;
- screen ;
- visible_when ;
- hidden_when ;
- effect ;
- side_effects ;
- destructive ;
- telemetry_event ;
- confirmation_required ;
- rollback_possible ;
- test_required.

Si un bouton n’a pas de contrat, il ne doit pas être ajouté.

------------------------------------------------------------
3.4 Pas d’écran sans Screen Contract
------------------------------------------------------------

Chaque écran doit avoir :

- screen_id ;
- user_question ;
- primary_action ;
- secondary_actions ;
- empty_state ;
- loading_state ;
- error_state ;
- data_dependencies ;
- forbidden_content ;
- tests.

------------------------------------------------------------
3.5 Pas de refactor massif non ciblé
------------------------------------------------------------

Interdit :

- réécrire tout App.tsx sans nécessité ;
- modifier backend + frontend + DB + docs dans une seule mission sauf mission système explicitement prévue ;
- modifier formules en même temps que UI ;
- modifier Stockfish en même temps que Practice ;
- ajouter LLM pendant une mission Review ;
- ajouter V2 pendant sprint V1 ;
- introduire design system complet pendant bugfix ;
- “nettoyer au passage”.

Autorisé :

- refactor minimal nécessaire ;
- extraction ciblée si elle réduit un risque immédiat ;
- documentation du refactor dans le rapport.

------------------------------------------------------------
3.6 Tests avant confiance
------------------------------------------------------------

La phrase “ça marche” n’a aucune valeur sans preuve.

Toute mission doit produire :

- tests exécutés ;
- commandes exactes ;
- résultats PASS/FAIL ;
- limites honnêtes ;
- preuves browser si UI ;
- preuves API si backend ;
- preuves DB si migration.

------------------------------------------------------------
3.7 Rollback obligatoire
------------------------------------------------------------

Chaque mission doit dire :

- comment revenir en arrière ;
- quelles données seraient impactées ;
- si migration réversible ou non ;
- si rollback code suffit ;
- si export utilisateur nécessaire.

------------------------------------------------------------
3.8 Local-first et data safety
------------------------------------------------------------

La V1 est local-first.

Règles :

- ne jamais supprimer des fichiers projet via endpoint utilisateur ;
- export/delete doivent être explicites ;
- tests destructifs sur DB temp seulement ;
- migrations idempotentes ;
- sauvegarde possible avant migration sensible ;
- pas de secret dans export ;
- pas de chemins absolus inutiles dans export.

------------------------------------------------------------
3.9 Déterminisme avant intelligence
------------------------------------------------------------

V1 privilégie :

- heuristiques lisibles ;
- sélection déterministe ;
- tests stables ;
- comportements reproductibles.

Les modèles apprenants arrivent après instrumentation et validation.

------------------------------------------------------------
3.10 Recovery avant sophistication
------------------------------------------------------------

Avant toute nouvelle feature :

- l’analyse ne doit pas spinner à l’infini ;
- Practice ne doit pas perdre d’attempt ;
- Delete doit être sûr ;
- export doit marcher ;
- board doit être jouable ;
- le backend doit donner des erreurs structurées.

============================================================
4. STACK TECHNIQUE CIBLE
============================================================

------------------------------------------------------------
4.1 Frontend
------------------------------------------------------------

Stack :

- React ;
- TypeScript ;
- Vite ;
- CSS variables / design tokens ;
- composants UI propres ;
- board chess interactif ;
- hooks dédiés ;
- polling jobs ;
- structure prête pour SSE/WebSocket futur.

Responsabilités :

- expérience utilisateur ;
- navigation ;
- Review UI ;
- Practice UI ;
- board interaction ;
- Profile/Privacy ;
- états visuels ;
- erreurs lisibles ;
- calls API ;
- responsive ;
- accessibility ;
- i18n strings.

Interdit frontend :

- recalculer les formules scientifiques ;
- inventer best_move ;
- inventer tags ;
- exposer debug par défaut ;
- fake success sans backend.

------------------------------------------------------------
4.2 Backend
------------------------------------------------------------

Stack :

- Python ;
- FastAPI ou équivalent ;
- SQLite local-first V1 ;
- python-chess ;
- Stockfish local ;
- repositories/services ;
- migrations légères ;
- endpoints REST ;
- job system Review.

Responsabilités :

- vérité data ;
- import PGN ;
- parsing moves ;
- FEN ;
- analyse moteur ;
- score ;
- moments ;
- training_items ;
- practice attempts ;
- scheduling ;
- Daily Plan ;
- export/delete ;
- cache policy ;
- telemetry locale ;
- error contracts.

Interdit backend :

- répondre avec stack traces utilisateur ;
- supprimer fichiers projet via user-data ;
- mélanger engines/formules ;
- faire tourner Stockfish dans transaction longue DB ;
- ignorer timeout engine.

------------------------------------------------------------
4.3 Moteur
------------------------------------------------------------

Stockfish est la source de vérité échiquéenne.

Règles :

- engine versionné ;
- engine_hash ;
- profile versionné ;
- cache strict ;
- timeouts ;
- retries ;
- kill/restart si hang ;
- pas de LLM comme vérité.

------------------------------------------------------------
4.4 DB
------------------------------------------------------------

V1 :

SQLite local-first.

Règles :

- migrations numérotées ;
- idempotence ;
- tests migration ;
- temp DB pour tests destructifs ;
- export JSON ;
- delete confirmé ;
- pas de dépendance cloud.

------------------------------------------------------------
4.5 LLM futur
------------------------------------------------------------

Statut :

hors V1.

Règles futures :

- jamais source de vérité échiquéenne ;
- Evidence JSON obligatoire ;
- verifier obligatoire ;
- source spans ;
- pas d’intention inventée ;
- pas de ligne inventée ;
- pas de score modifié.

============================================================
5. ARCHITECTURE FRONTEND
============================================================

------------------------------------------------------------
5.1 Pages V1
------------------------------------------------------------

Pages / vues principales :

- Today ;
- Games ;
- Training ;
- Review contextuelle ;
- Practice focus ;
- Profile/Settings ;
- Import panel ;
- Demo mode ;
- Error/Recovery view.

Interdit onglet principal :

- Review ;
- Progression détaillée ;
- Profil ;
- Sandbox ;
- Candidate Trainer.

------------------------------------------------------------
5.2 State management
------------------------------------------------------------

Principes :

- état local clair ;
- pas de global store tentaculaire sans nécessité ;
- hooks dédiés ;
- API client typé ;
- transitions contrôlées.

Hooks recommandés :

- useToday ;
- useGames ;
- useReviewJob ;
- useReview ;
- usePracticeSession ;
- useDailyPlan ;
- useProfilePrivacy ;
- useEngineStatus ;
- useBoardInteraction ;
- useToast ;
- useModalConfirm.

------------------------------------------------------------
5.3 Board module
------------------------------------------------------------

Le board doit supporter :

- review_static ;
- review_exploration ;
- practice_attempt ;
- demo ;
- sandbox futur.

Contrats :

- click-click obligatoire ;
- drag/drop optionnel ;
- orientation ;
- legal highlight ;
- selected square ;
- last move ;
- illegal feedback ;
- promotion safe ;
- data-testid ;
- no crash on invalid FEN.

------------------------------------------------------------
5.4 UI state machines
------------------------------------------------------------

Le frontend doit modéliser explicitement :

- analysis states ;
- review states ;
- practice states ;
- daily plan states ;
- export/delete states ;
- import states.

Jamais :

- booléens dispersés contradictoires ;
- spinner sans timeout ;
- action sans feedback.

------------------------------------------------------------
5.5 i18n strings
------------------------------------------------------------

V1 en français.

Mais toutes les strings critiques doivent être centralisées.

Fichiers possibles :

- frontend/src/i18n/fr.ts ;
- frontend/src/i18n/strings.ts.

Interdit :

- labels d’action hardcodés partout ;
- messages d’erreur dispersés ;
- texte interdit qui échappe aux tests statiques.

============================================================
6. ARCHITECTURE BACKEND
============================================================

------------------------------------------------------------
6.1 Services
------------------------------------------------------------

Services recommandés :

- pgn_import_service ;
- game_service ;
- review_job_service ;
- engine_service ;
- analysis_cache_service ;
- review_summary_service ;
- review_moment_service ;
- training_item_service ;
- practice_service ;
- spaced_repetition_service ;
- daily_plan_service ;
- learning_summary_service ;
- privacy_service ;
- settings_service ;
- telemetry_service ;
- migration_service.

Règle :

Routes API minces.
Logique dans services testables.

------------------------------------------------------------
6.2 Repositories
------------------------------------------------------------

Chaque table critique doit avoir une couche d’accès claire ou des fonctions dédiées.

Éviter :

- SQL inline dupliqué partout ;
- migrations qui deviennent business logic ;
- endpoint qui manipule toutes les tables directement.

------------------------------------------------------------
6.3 Schemas API
------------------------------------------------------------

Chaque endpoint doit avoir :

- request schema ;
- response schema ;
- error schema ;
- examples ;
- tests.

Error contract :

{
  "error_code": "...",
  "message": "...",
  "recoverable": true,
  "recommended_action": "...",
  "debug": {}
}

Debug safe :

- pas de secret ;
- pas de stack trace brute ;
- pas de chemin absolu inutile.

------------------------------------------------------------
6.4 Background jobs
------------------------------------------------------------

Review analysis doit être un job :

- queued ;
- running ;
- stalled_resumable ;
- completed ;
- completed_with_warnings ;
- failed_recoverable ;
- failed_final.

Chaque job :

- heartbeat ;
- updated_at ;
- progress_done ;
- progress_total ;
- current_phase ;
- last_error_code ;
- retry_count ;
- engine_profile ;
- formula_version.

============================================================
7. DATA MODEL CIBLE
============================================================

Le modèle de données doit rester aligné avec Plan1.

------------------------------------------------------------
7.1 V1 tables principales
------------------------------------------------------------

V1 core :

- local_profile ;
- user_settings ;
- games ;
- moves ;
- engine_analysis ;
- review_jobs ;
- review_summaries ;
- review_moments ;
- training_items ;
- practice_sessions ;
- practice_session_items ;
- practice_attempts ;
- spaced_repetition_queue ou due_at equivalent ;
- daily_plan_items ;
- telemetry_events ;
- user_aliases si utile.

------------------------------------------------------------
7.2 Champs critiques practice_attempts
------------------------------------------------------------

Obligatoires :

- session_id ;
- item_id ;
- move_played ;
- result ;
- time_spent_ms ;
- hint_used ;
- reveal_used ;
- source_context ;
- due_at ;
- created_at.

Futurs :

- confidence_pre_attempt ;
- explanation_attempt ;
- time_to_first_move_ms ;
- wrong_streak_count ;
- anti_tilt_message_shown.

------------------------------------------------------------
7.3 training_items
------------------------------------------------------------

Doit contenir :

- id ;
- source_type ;
- source_game_id ;
- source_ply ;
- source_moment_id ;
- fen ;
- side_to_move ;
- best_move ;
- accepted_moves_json ;
- domain ;
- primary_tag ;
- criticality_score ;
- explanation_short ;
- takeaway ;
- status.

Règles :

- généré depuis review_moments ;
- max 5 par Review V1 ;
- idempotent ;
- dédup source_game_id + source_ply ;
- accepted_moves_json contient best_move minimum.

------------------------------------------------------------
7.4 daily_plan_items
------------------------------------------------------------

Champs :

- id ;
- user_id ;
- plan_date ;
- item_id ;
- order_index ;
- selection_reason ;
- selection_score ;
- source_bucket ;
- created_at.

Règle :

selection_score interne seulement.

------------------------------------------------------------
7.5 migrations
------------------------------------------------------------

Toute migration doit :

- être numérotée ;
- être idempotente si possible ;
- avoir test ;
- préserver données existantes ;
- être documentée ;
- être incluse dans export/delete si table user-data.

============================================================
8. API CONTRACTS V1
============================================================

------------------------------------------------------------
8.1 Games
------------------------------------------------------------

GET /api/games

Retour :

- list games ;
- status ;
- review_status ;
- neuro_score si disponible ;
- training_available.

POST /api/games/import/pgn

Input :

- pgn_raw ;
- source optional.

Retour :

- created games ;
- invalid games ;
- warnings ;
- duplicate info.

POST /api/games/{game_id}/analyze

Input :

- profile.

Retour :

- job_id ;
- status.

GET /api/games/{game_id}

Retour :

- metadata ;
- moves ;
- review status.

DELETE /api/games/{game_id}

Destructif.
Confirmation frontend requise.

------------------------------------------------------------
8.2 Review
------------------------------------------------------------

GET /api/review/jobs/{job_id}

Retour :

- status ;
- progress_done ;
- progress_total ;
- phase ;
- recoverable ;
- warnings ;
- timeout metadata safe.

GET /api/games/{game_id}/review

Retour :

- summary ;
- moments ;
- scores ;
- quality_status ;
- warnings ;
- training_items_available.

POST /api/games/{game_id}/review/reconcile

Répare état incohérent ou job bloqué.

POST /api/games/{game_id}/review/recompute

Action avancée.

------------------------------------------------------------
8.3 Practice
------------------------------------------------------------

POST /api/practice/sessions

Input :

- source_game_id optional ;
- mode: review / due / failed / plan ;
- max_items.

Retour :

- session_id ;
- first_item.

GET /api/practice/sessions/{session_id}

Retour :

- session ;
- items ;
- current_item.

POST /api/practice/sessions/{session_id}/attempt

Input :

- item_id ;
- move_played ;
- time_spent_ms ;
- hint_used ;
- reveal_used.

Retour :

- result ;
- feedback ;
- due_at ;
- next_state.

POST /api/practice/sessions/{session_id}/skip
POST /api/practice/sessions/{session_id}/reveal
POST /api/practice/sessions/{session_id}/complete
POST /api/practice/sessions/{session_id}/retry-failed

------------------------------------------------------------
8.4 Today
------------------------------------------------------------

GET /api/today

Retour :

- hero_state ;
- primary_action ;
- secondary_cards ;
- progress_card ;
- due_count ;
- latest_review ;
- active_session ;
- daily_plan_status.

------------------------------------------------------------
8.5 Training
------------------------------------------------------------

GET /api/training

Retour :

- daily_plan_card ;
- failed_items_card ;
- due_reviews_card ;
- counts ;
- active_session.

POST /api/training/daily-plan

Crée ou récupère le plan du jour.

GET /api/training/daily-plan/today

Retourne plan existant ou empty state.

POST /api/training/daily-plan/practice

Crée session Practice depuis plan.

------------------------------------------------------------
8.6 Settings / Privacy
------------------------------------------------------------

GET /api/settings
PATCH /api/settings
GET /api/export
DELETE /api/user-data

DELETE requires confirmation.

------------------------------------------------------------
8.7 Engine
------------------------------------------------------------

GET /api/engine/status
POST /api/engine/test
PATCH /api/engine/settings

============================================================
9. PIPELINE PGN → REVIEW → TRAINING
============================================================

------------------------------------------------------------
9.1 Import PGN
------------------------------------------------------------

Étapes :

1. recevoir PGN ;
2. valider format ;
3. parser headers ;
4. parser moves ;
5. créer game ;
6. extraire FEN before/after ;
7. stocker SAN/UCI ;
8. détecter source ;
9. détecter user_color si possible ;
10. dédupliquer ;
11. retourner status.

Erreurs :

- empty ;
- invalid ;
- illegal move ;
- too short ;
- too large ;
- duplicate.

------------------------------------------------------------
9.2 Analyse Review
------------------------------------------------------------

Étapes :

1. créer review_job ;
2. déterminer positions à analyser ;
3. vérifier cache strict ;
4. analyser positions manquantes ;
5. stocker engine_analysis ;
6. calculer white_percent ;
7. calculer player_win_percent ;
8. calculer win_loss ;
9. calculer move_accuracy ;
10. calculer reference_accuracy ;
11. calculer neuro_score_diag interne ;
12. calculer coach_neuro_score ;
13. calculer criticality_score ;
14. temporal NMS ;
15. tag taxonomy V0 ;
16. générer review_summary ;
17. générer review_moments ;
18. générer training_items ;
19. compléter job.

------------------------------------------------------------
9.3 Génération moments
------------------------------------------------------------

Pour chaque coup du joueur :

- récupérer P_before ;
- récupérer P_after ;
- calculer win_loss ;
- calculer transition ;
- calculer persistence ;
- calculer reliability ;
- calculer criticality ;
- filtrer shallow/invalid ;
- trier ;
- appliquer NMS ;
- max moments résumé.

------------------------------------------------------------
9.4 Génération training_items
------------------------------------------------------------

Depuis review_moments :

- max 5 ;
- idempotent ;
- accepted_moves_json inclut best_move ;
- source_game_id/source_ply/source_moment_id ;
- domain/primary_tag ;
- fen_before ;
- side_to_move.

------------------------------------------------------------
9.5 Practice attempt
------------------------------------------------------------

Étapes :

1. charger session ;
2. vérifier item ;
3. valider move ;
4. déterminer result ;
5. enregistrer attempt ;
6. calculer due_at ;
7. update session item ;
8. update learning summary ;
9. retourner feedback.

------------------------------------------------------------
9.6 Daily Plan
------------------------------------------------------------

Sources V1 :

1. due ;
2. failed_recent ;
3. recent_critical ;
4. diversity_fill.

Règles :

- déterministe ;
- no random ;
- no SkillTrace strong influence V1 ;
- no fake item ;
- max 5–6 items ;
- partial si pas assez.

============================================================
10. JOB SYSTEM ET FIABILITÉ ANALYSE
============================================================

------------------------------------------------------------
10.1 États
------------------------------------------------------------

review_job.status :

queued
running
stalled_resumable
completed
completed_with_warnings
failed_recoverable
failed_final

quality_status :

full
partial
degraded
invalid

------------------------------------------------------------
10.2 Heartbeat
------------------------------------------------------------

Chaque job running doit mettre à jour :

- heartbeat_at ;
- updated_at ;
- progress_done ;
- current_phase.

Si heartbeat stale :

- passer stalled_resumable ;
- exposer recovery CTA ;
- ne pas spinner infini.

------------------------------------------------------------
10.3 Timeouts
------------------------------------------------------------

Chaque position doit avoir :

- timeout_ms ;
- attempt_count ;
- last_error ;
- recoverable.

Règles :

- retry budget ;
- pas d’infinite loop ;
- timeout analysis non strict_valid ;
- fake-engine hooks test-only.

------------------------------------------------------------
10.4 Resume
------------------------------------------------------------

Resume doit :

- retry missing/timeout positions ;
- ne pas réanalyser cache strict-valid ;
- compléter si possible ;
- partial si safe ;
- failed_recoverable si impossible mais récupérable.

------------------------------------------------------------
10.5 Reconcile
------------------------------------------------------------

Reconcile répare :

- job done mais review absente ;
- job stalled mais analyses présentes ;
- progress mismatch ;
- orphan review moments ;
- cache valid mais job bloqué.

============================================================
11. STOCKFISH ET CACHE STRICT
============================================================

------------------------------------------------------------
11.1 engine_hash
------------------------------------------------------------

engine_hash =

SHA256(stockfish_binary)
+ SHA256(nnue_file_if_external or embedded)
+ version_string_reported_by_engine

Si version inconnue :

engine_version_string = unknown
cache not strict valid sauf debug override explicite.

------------------------------------------------------------
11.2 Cache key
------------------------------------------------------------

Cache compatible seulement si :

- même FEN ;
- même engine_hash ;
- même engine_version_string ;
- même nnue_hash ;
- même analysis_profile ;
- multipv suffisant ;
- formula_version compatible ;
- metric_version compatible ;
- quality_status ok.

------------------------------------------------------------
11.3 Legacy policy
------------------------------------------------------------

Si moteur/formule change :

- ancienne analyse = legacy ;
- affichable comme ancienne ;
- pas mélangée dans nouvelle Review ;
- bouton Réanalyser ;
- jamais suppression automatique.

------------------------------------------------------------
11.4 Analyse adaptative
------------------------------------------------------------

Niveaux :

live
standard_review
deep_review
foundations/future

Règle :

- standard sur positions nécessaires ;
- deep seulement sur top moments ou demande explicite ;
- pas de deep partout.

============================================================
12. TRAINING ENGINE
============================================================

------------------------------------------------------------
12.1 Sources
------------------------------------------------------------

Sources V1 :

- review_moments ;
- training_items ;
- due reviews ;
- failed recent ;
- Daily Plan.

Sources futures :

- benchmark curriculum ;
- good decisions ;
- near-transfer variants ;
- opening repertoire ;
- endgame curriculum.

------------------------------------------------------------
12.2 Daily Plan V1 deterministic
------------------------------------------------------------

Pseudo-code :

candidates = []
candidates += due_items_sorted_by_due_at()
candidates += failed_recent_sorted_by_recency_and_severity()
candidates += recent_critical_sorted_by_criticality()
candidates += diversity_fill()

dedupe item_id
dedupe source_game_id + source_ply
apply max same primary_tag <= 2 if alternatives exist
sort by bucket priority and stable keys
persist daily_plan_items
return plan

Stable keys :

- bucket priority ;
- due_at asc ;
- criticality desc ;
- created_at desc ;
- item_id asc.

------------------------------------------------------------
12.3 simple_spaced_repetition_v1
------------------------------------------------------------

Rules :

wrong / illegal => tomorrow
revealed => tomorrow
success with hint => 3 days
success without help => 7 days
skipped => no due V1

Interdit :

- appeler cela FSRS ;
- afficher FSRS ;
- exposer stability/difficulty memory.

------------------------------------------------------------
12.4 SkillTrace shadow
------------------------------------------------------------

V1/V1.1 :

- update states ;
- log recommendations ;
- no visible mastery % ;
- no strong Daily Plan influence.

Conditions avant action :

- volume attempts suffisant ;
- tags suffisants ;
- corrélation positive ;
- pas de baisse completion ;
- décision documentée.

============================================================
13. PRIVACY / SETTINGS / USER DATA
============================================================

------------------------------------------------------------
13.1 Export
------------------------------------------------------------

GET /api/export doit inclure :

- metadata ;
- games ;
- moves ;
- reviews ;
- review_moments ;
- training_items ;
- practice_sessions ;
- practice_attempts ;
- due/scheduling ;
- daily_plan_items ;
- settings ;
- profile ;
- telemetry locale si présente.

Exclure :

- secrets ;
- env ;
- chemins absolus inutiles ;
- machine-specific data sensible.

------------------------------------------------------------
13.2 Delete
------------------------------------------------------------

DELETE /api/user-data

Requires :

confirmation = SUPPRIMER or equivalent contract.

Deletes :

- user data ;
- derived inferences ;
- practice attempts ;
- training items ;
- daily plan ;
- reviews ;
- settings/profile if intended.

Must not delete :

- repo files ;
- migrations ;
- Stockfish binary ;
- plan docs ;
- source code ;
- caches non user-data unless explicitly defined.

------------------------------------------------------------
13.3 Settings
------------------------------------------------------------

Settings V1 :

- session duration ;
- coach tone ;
- help level ;
- animations ;
- timer visible ;
- language ;
- theme future ;
- Stockfish path ;
- analysis profile ;
- research opt-in.

============================================================
14. OBSERVABILITY ET RELIABILITY
============================================================

NeuroChess local-first doit quand même être observable.

Les pratiques modernes de reliability utilisent SLO, error budgets, métriques de livraison, traces, logs et événements structurés. Plan3 adopte ces concepts de façon locale et proportionnée.

------------------------------------------------------------
14.1 Signals
------------------------------------------------------------

À collecter localement ou en debug :

- app_start ;
- import_started/import_success/import_failed ;
- analysis_started/progress/stalled/completed/failed ;
- review_opened ;
- practice_started ;
- attempt_saved ;
- attempt_failed_to_save ;
- daily_plan_created ;
- export_done ;
- delete_done ;
- backend_unavailable ;
- engine_timeout.

------------------------------------------------------------
14.2 Logs structurés
------------------------------------------------------------

Chaque log critique doit avoir :

- timestamp ;
- level ;
- event_name ;
- request_id/job_id/session_id ;
- safe payload ;
- error_code ;
- recoverable.

Interdit :

- secrets ;
- raw PGN dans logs erreur visibles ;
- stack trace utilisateur ;
- chemins personnels inutiles.

------------------------------------------------------------
14.3 SLO V1 locaux
------------------------------------------------------------

Objectifs internes :

- import PGN normal success rate >= 99% sur fixtures ;
- analysis small PGN terminal state >= 99% en smoke ;
- practice attempt save success >= 99% en smoke ;
- export/delete pass >= 100% en tests temp DB ;
- no infinite spinner in browser smokes ;
- no network 500 in critical smokes unless expected and handled.

------------------------------------------------------------
14.4 Error budget
------------------------------------------------------------

Si un type d’échec critique apparaît plusieurs fois :

- stopper nouvelles features ;
- prioriser reliability ;
- créer postmortem ;
- créer mission P0.

Échecs critiques :

- données utilisateur perdues ;
- attempt non sauvegardé ;
- analyse infinie ;
- delete dangereux ;
- review incorrecte par inversion POV ;
- métrique interdite visible ;
- Stockfish cache mixé incorrectement.

------------------------------------------------------------
14.5 DORA local product metrics
------------------------------------------------------------

Suivre pour l’équipe :

- lead time for changes ;
- deployment/push frequency ;
- change failure rate ;
- failed deployment recovery time ;
- reliability fixes vs features ;
- test pass rate.

Ces métriques ne sont pas utilisateur.

============================================================
15. SECURITY ET PRIVACY ENGINEERING
============================================================

------------------------------------------------------------
15.1 Principes sécurité
------------------------------------------------------------

Même en local-first :

- validation input ;
- aucune exécution arbitraire depuis PGN ;
- path Stockfish contrôlé ;
- pas de secrets dans export ;
- CORS limité ;
- erreurs safe ;
- suppression confirmée ;
- tests destructifs en temp DB.

------------------------------------------------------------
15.2 Threat model V1
------------------------------------------------------------

Menaces :

- PGN malformé ;
- fichier énorme ;
- path traversal import/export ;
- injection via PGN metadata ;
- suppression accidentelle ;
- fuite chemins locaux ;
- endpoint delete sans confirmation ;
- engine path malveillant ;
- crash backend par FEN invalide.

Mitigations :

- validation stricte ;
- taille limite ;
- JSON escaping ;
- confirmation ;
- temp DB tests ;
- allowlist engine path future ;
- safe error contract.

------------------------------------------------------------
15.3 OWASP alignment
------------------------------------------------------------

Plan3 s’inspire des principes OWASP ASVS pour les contrôles applicatifs :

- validation ;
- session/config ;
- error handling ;
- data protection ;
- file handling ;
- API controls.

Ne pas revendiquer conformité OWASP tant qu’un audit complet n’est pas fait.

============================================================
16. TESTING STRATEGY
============================================================

------------------------------------------------------------
16.1 Pyramide de tests
------------------------------------------------------------

Niveaux :

1. Unit tests
2. Service tests
3. Repository/migration tests
4. API integration tests
5. Contract/static tests
6. Browser smokes
7. Manual QA
8. User tests

Chaque bug P0 doit idéalement produire :

- test de reproduction ;
- fix ;
- test de non-régression.

------------------------------------------------------------
16.2 Unit tests formules
------------------------------------------------------------

Couvrir :

- eval POV ;
- white_percent ;
- player_win_percent ;
- win_loss ;
- move_accuracy ;
- NeuroScore ;
- criticality components ;
- SRS.

Règle :

Pas de changement de snapshot sans mission scientifique.

------------------------------------------------------------
16.3 Backend tests
------------------------------------------------------------

Couvrir :

- PGN import ;
- illegal PGN ;
- duplicate ;
- review jobs ;
- engine timeout ;
- cache strict ;
- review generation ;
- training_items ;
- practice attempts ;
- daily plan ;
- export/delete ;
- settings ;
- learning_summary.

------------------------------------------------------------
16.4 Migration tests
------------------------------------------------------------

Couvrir :

- fresh DB ;
- existing DB ;
- repeated migration ;
- data preservation ;
- delete after migration ;
- export after migration.

------------------------------------------------------------
16.5 Frontend/static tests
------------------------------------------------------------

Couvrir :

- nav exactly 3 ;
- training exactly 3 ;
- forbidden V1 labels absent ;
- action labels present ;
- data-testid present ;
- strings centralized ;
- debug not visible default ;
- no raw metrics.

------------------------------------------------------------
16.6 Browser smokes
------------------------------------------------------------

Critical smokes :

- browser_v1_flow_smoke ;
- browser_profile_privacy_smoke ;
- browser_daily_plan_smoke ;
- browser_core_board_interaction_smoke ;
- browser_analysis_stall_recovery_smoke ;
- browser_review_exploration_real_smoke ;
- browser_real_analysis_no_infinite_loop_smoke ;
- browser_degraded_states_smoke ;
- browser_mobile_responsive_smoke ;
- browser_keyboard_accessibility_smoke.

Smokes must :

- use temp DB ;
- capture console/page/network errors ;
- fail on 500 unexpected ;
- fail on infinite spinner ;
- print evidence ;
- cleanup processes.

------------------------------------------------------------
16.7 Manual QA
------------------------------------------------------------

Manual checklist V1 :

1. start backend ;
2. start frontend ;
3. open /app ;
4. import PGN ;
5. analyze ;
6. verify terminal analysis state ;
7. open Review ;
8. explore position ;
9. start Practice ;
10. play correct move ;
11. play wrong move ;
12. reveal ;
13. verify due_at ;
14. create Daily Plan ;
15. practice from plan ;
16. export ;
17. delete temp data ;
18. reload app ;
19. mobile viewport smoke.

------------------------------------------------------------
16.8 Test data
------------------------------------------------------------

Fixtures :

- minimal valid PGN ;
- PGN invalid ;
- PGN illegal ;
- PGN duplicate ;
- real Sindarov PGN ;
- short PGN ;
- long PGN ;
- position with promotion ;
- black orientation ;
- engine timeout fake ;
- review with no moments ;
- daily plan empty ;
- daily plan partial.

------------------------------------------------------------
16.9 Test environment
------------------------------------------------------------

Use temp DB.

Never destructive tests on real DB.

Known reliable backend env may include :

PYTHONPATH manual deps
TEMP/TMP/TMPDIR temp test path
.venv_repair_local python

Commands must be reported exactly.

============================================================
17. CI / QUALITY GATES
============================================================

------------------------------------------------------------
17.1 Local gates
------------------------------------------------------------

Before commit :

- git status ;
- git diff --check ;
- plan_guard ;
- relevant unit tests ;
- frontend build/typecheck if frontend changed ;
- browser smoke if UI flow changed ;
- backend tests if backend changed ;
- migration tests if DB changed.

------------------------------------------------------------
17.2 Release candidate gates
------------------------------------------------------------

RC requires :

- full backend tests PASS ;
- frontend build PASS ;
- typecheck PASS ;
- plan_guard PASS ;
- all critical Python smokes PASS ;
- all critical browser smokes PASS ;
- export/delete PASS ;
- no forbidden UI labels ;
- no dirty critical files except planned release docs ;
- release notes ;
- rollback plan.

------------------------------------------------------------
17.3 Failure rules
------------------------------------------------------------

If a required test fails :

- do not claim success ;
- classify failure ;
- fix if in scope ;
- otherwise report blocker ;
- do not commit unless commit explicitly captures failing work for branch backup and user asks.

============================================================
18. RELEASE MANAGEMENT
============================================================

------------------------------------------------------------
18.1 Version levels
------------------------------------------------------------

Versions :

- prototype ;
- alpha_internal ;
- V1_RC ;
- V1_external_limited ;
- V1_public ;
- V1.1 ;
- V2 ;
- V3.

------------------------------------------------------------
18.2 V1 external gate
------------------------------------------------------------

External users allowed only if :

1. 3 external users complete :
   import PGN → analyze → Review → Practice → Daily Plan → revision J+3.
2. At least 2/3 return next day or J+2.
3. No blocking bug in :
   import ;
   analysis ;
   Review ;
   Practice ;
   attempt save ;
   Daily Plan ;
   export/delete.
4. Critical tests pass.
5. User understands next action.
6. Delete/export safe.
7. No fake-neuro claim.
8. No forbidden V1 feature visible.

------------------------------------------------------------
18.3 Release checklist
------------------------------------------------------------

Before release :

- update PROJECT_STATE ;
- update V1_READINESS_REPORT ;
- update QA_CHECKLIST ;
- update TEST_COVERAGE_MATRIX ;
- run full tests ;
- tag version if requested ;
- backup DB migration strategy ;
- prepare rollback ;
- write known limitations.

------------------------------------------------------------
18.4 Rollback
------------------------------------------------------------

Rollback plan includes :

- previous commit hash ;
- changed files ;
- migrations impact ;
- data impact ;
- revert command ;
- manual recovery ;
- export before destructive migration if needed.

============================================================
19. GIT GOVERNANCE
============================================================

------------------------------------------------------------
19.1 Default no commit / no stage
------------------------------------------------------------

Codex default :

- no stage ;
- no commit ;
- no push.

Except when user explicitly authorizes commit/push.

------------------------------------------------------------
19.2 Commit rules
------------------------------------------------------------

One mission = one commit unless user asks otherwise.

Commit includes only mission files.

Message format :

<verb> <scope> <summary>

Examples :

Add V1 profile privacy export delete
Stabilize V1 board interaction and practice flow
Replace Plan2 with UX constitution v4
Fix analysis job stale recovery

------------------------------------------------------------
19.3 Stage rules
------------------------------------------------------------

Never :

git add -A

Prefer explicit :

git add file1 file2

Before commit :

git diff --cached --stat
git diff --cached --check
git diff --cached --name-status

If unrelated staged :

git restore --staged <file>

Do not discard.

------------------------------------------------------------
19.4 Dirty worktree protocol
------------------------------------------------------------

If worktree dirty :

1. list dirty files ;
2. group by mission ;
3. do not touch unrelated ;
4. do not stage unrelated ;
5. ask/stop only if cannot isolate ;
6. report final dirty state.

============================================================
20. CODEX OPERATING MODEL
============================================================

------------------------------------------------------------
20.1 Mission lifecycle
------------------------------------------------------------

Every mission:

1. read relevant plans ;
2. git status ;
3. inspect current implementation ;
4. identify minimal diff ;
5. implement ;
6. test ;
7. update docs ;
8. report ;
9. no commit unless authorized.

------------------------------------------------------------
20.2 Codex must be skeptical
------------------------------------------------------------

Codex must not assume.

It must inspect:

- current schema ;
- current API ;
- current components ;
- current tests ;
- current docs ;
- current worktree.

If repo differs from plan:

- follow repo reality ;
- preserve plan doctrine ;
- report mismatch.

------------------------------------------------------------
20.3 Report format
------------------------------------------------------------

Every report includes :

1. mission name ;
2. baseline git status ;
3. files inspected ;
4. root cause / implementation summary ;
5. files changed ;
6. tests run exact commands ;
7. PASS/FAIL ;
8. evidence ;
9. limitations ;
10. next recommendation ;
11. commit/stage status.

------------------------------------------------------------
20.4 No hallucinated tests
------------------------------------------------------------

Never claim a test passed if not run.

If unavailable :

- say not available ;
- say closest equivalent ;
- explain.

============================================================
21. DOCUMENTATION SYSTEM
============================================================

Required docs :

- AGENTS.md ;
- docs/PLAN_SOURCE_OF_TRUTH.md ;
- docs/PLAN_CONTEXT_MIN.md ;
- docs/PLAN_FEATURE_BOUNDARIES.md ;
- docs/PLAN_ALIGNMENT_AUDIT.md ;
- docs/PROJECT_STATE.md ;
- docs/NEXT_PLAN_ACTIONS.md ;
- docs/API_CONTRACTS.md ;
- docs/DB_SCHEMA.md ;
- docs/ACTION_REGISTRY.md ;
- docs/SCREEN_CONTRACTS.md ;
- docs/CORE_INTERACTION_CONTRACT.md ;
- docs/DEGRADED_STATES_CONTRACT.md ;
- docs/FULL_APPLICATION_QA_AUDIT.md ;
- docs/TEST_COVERAGE_MATRIX.md ;
- docs/V1_READINESS_REPORT.md ;
- docs/QA_CHECKLIST.md ;
- docs/DECISIONS_LOG.md future ;
- docs/RELEASE_CHECKLIST.md future.

Docs rules :

- update when behavior changes ;
- no fake status ;
- no outdated readiness ;
- cite tests/evidence ;
- distinguish TODO vs done.

============================================================
22. ROADMAP EXECUTION — CURRENT MASTER SEQUENCE
============================================================

This roadmap is ordered by dependency.

------------------------------------------------------------
22.1 Foundation already required
------------------------------------------------------------

- plan source of truth stabilized ;
- Plan1 v3 ;
- Plan2 v4 ;
- Plan3 v4 ;
- AGENTS/docs updated.

------------------------------------------------------------
22.2 P0 reliability before feature work
------------------------------------------------------------

Before any new feature:

- audit dirty worktree ;
- finish runtime board/exploration/analysis repairs ;
- commit or revert coherent work ;
- ensure app real local flow works.

------------------------------------------------------------
22.3 V1 remaining likely missions
------------------------------------------------------------

Recommended sequence :

1. P0.DIRTY-WORKTREE-AUDIT-AND-RECOVERY
2. P0.REAL-RUNTIME-BOARD-EXPLORATION-AND-ANALYSIS-REPAIR
3. P1.DEGRADED-STATES-ANTI-TILT-V1
4. P1.I18N-STRINGS-CENTRALIZATION-V1
5. P1.RESPONSIVE-MOBILE-SMOKE-V1
6. P1.SKILLTRACE-BETA-SHADOW-V1
7. P1.QA-RELEASE-CANDIDATE-V1
8. P1.EXTERNAL-USER-PILOT-PREP

------------------------------------------------------------
22.4 Do not skip
------------------------------------------------------------

Do not build SkillTrace/Intent/LLM if:

- analysis can still spin ;
- board exploration broken ;
- attempts not saved ;
- Daily Plan not reliable ;
- export/delete unsafe ;
- mobile unusable ;
- degraded states missing.

============================================================
23. SPRINT CATALOGUE
============================================================

Each sprint below is a catalogue entry, not a command to execute.

------------------------------------------------------------
23.1 P0.PLAN-SOURCE-OF-TRUTH-STABILIZATION
------------------------------------------------------------

Goal :

ensure Plan1/Plan2/Plan3 canonical files and docs are aligned.

Acceptance :

- markers pass ;
- docs updated ;
- plan_guard pass ;
- only plan docs committed.

------------------------------------------------------------
23.2 P0.DIRTY-WORKTREE-AUDIT-AND-RECOVERY
------------------------------------------------------------

Goal :

classify existing dirty files and decide keep/finish/revert.

Acceptance :

- grouped dirty files ;
- no changes ;
- decision table ;
- recommended mission.

------------------------------------------------------------
23.3 P0.REAL-RUNTIME-BOARD-EXPLORATION-AND-ANALYSIS-REPAIR
------------------------------------------------------------

Goal :

fix real user board exploration and infinite analysis loop.

Acceptance :

- Review local exploration works ;
- Practice move works ;
- Daily Plan practice works ;
- analysis terminal/recoverable ;
- browser real smokes pass.

------------------------------------------------------------
23.4 P1.DEGRADED-STATES-ANTI-TILT-V1
------------------------------------------------------------

Goal :

implement calm recoverable states.

Acceptance :

- invalid PGN ;
- engine unavailable ;
- backend offline ;
- stalled analysis ;
- empty daily plan ;
- interrupted practice ;
- wrong streak anti-tilt ;
- browser degraded smoke pass.

------------------------------------------------------------
23.5 P1.I18N-STRINGS-CENTRALIZATION-V1
------------------------------------------------------------

Goal :

centralize all UI strings.

Acceptance :

- fr.ts/strings.ts ;
- no critical hardcoded labels ;
- static tests ;
- no behavior change.

------------------------------------------------------------
23.6 P1.RESPONSIVE-MOBILE-SMOKE-V1
------------------------------------------------------------

Goal :

prove mobile V1.

Acceptance :

- Today mobile ;
- Review mobile ;
- Practice mobile ;
- tap-tap board ;
- bottom nav ;
- no overflow critical ;
- browser mobile smoke.

------------------------------------------------------------
23.7 P1.SKILLTRACE-BETA-SHADOW-V1
------------------------------------------------------------

Goal :

implement shadow model without visible mastery.

Acceptance :

- states updated ;
- no Daily Plan strong influence ;
- export/delete includes ;
- tests pass ;
- no UI %.

------------------------------------------------------------
23.8 P1.QA-RELEASE-CANDIDATE-V1
------------------------------------------------------------

Goal :

prepare V1 RC.

Acceptance :

- all tests ;
- docs ;
- readiness ;
- known blockers ;
- go/no-go.

------------------------------------------------------------
23.9 V2.INTENT-LIGHT
------------------------------------------------------------

Goal :

optional lightweight intention capture.

Not V1.

------------------------------------------------------------
23.10 V2.CANDIDATE-TRAINER
------------------------------------------------------------

Goal :

candidate generation/selection/calculation mode.

Not V1.

------------------------------------------------------------
23.11 V3.LLM-COACH-VERIFIED
------------------------------------------------------------

Goal :

verified LLM explanations.

Not V1.

============================================================
24. DEFINITION OF DONE
============================================================

A mission is done only if :

1. objective satisfied ;
2. diff controlled ;
3. no unrelated files modified/staged ;
4. tests run ;
5. failures disclosed ;
6. docs updated ;
7. source plans respected ;
8. no forbidden V1 features ;
9. performance budget considered ;
10. rollback considered ;
11. report complete.

------------------------------------------------------------
24.1 Frontend DoD
------------------------------------------------------------

- loading/empty/error states ;
- data-testid ;
- accessibility ;
- mobile considered ;
- no forbidden labels ;
- browser smoke if flow critical ;
- strings centralized if user text.

------------------------------------------------------------
24.2 Backend DoD
------------------------------------------------------------

- service tests ;
- API tests ;
- error contracts ;
- migration tests if schema ;
- export/delete updated if user data ;
- no unsafe paths/secrets.

------------------------------------------------------------
24.3 Docs DoD
------------------------------------------------------------

- PROJECT_STATE updated if state changed ;
- NEXT_PLAN_ACTIONS updated ;
- QA docs updated for QA missions ;
- API/DB docs updated for contracts/schema.

============================================================
25. RISK REGISTER
============================================================

------------------------------------------------------------
25.1 Scope creep
------------------------------------------------------------

Risk :

V2/V3 features leak into V1.

Mitigation :

- plan guard ;
- prompts ;
- feature boundaries ;
- code review ;
- explicit sprint.

------------------------------------------------------------
25.2 Stockfish instability
------------------------------------------------------------

Risk :

analysis stalls, cache invalid, engine version mismatch.

Mitigation :

- timeouts ;
- retry ;
- strict cache ;
- reconcile ;
- browser stall smoke.

------------------------------------------------------------
25.3 Metric misuse
------------------------------------------------------------

Risk :

internal metrics shown as truth.

Mitigation :

- static UI tests ;
- Plan1 registry ;
- forbidden labels ;
- docs.

------------------------------------------------------------
25.4 Data loss
------------------------------------------------------------

Risk :

delete/export bug, migration corruption.

Mitigation :

- temp DB tests ;
- confirmation ;
- export before risky migration ;
- idempotent delete.

------------------------------------------------------------
25.5 UX brittleness
------------------------------------------------------------

Risk :

button broken, board dead, spinner infinite.

Mitigation :

- browser smokes ;
- state machines ;
- data-testid ;
- manual QA.

------------------------------------------------------------
25.6 Codex overreach
------------------------------------------------------------

Risk :

agent implements full plan.

Mitigation :

- warnings ;
- mission template ;
- no commit default ;
- controlled diff.

------------------------------------------------------------
25.7 Dirty worktree confusion
------------------------------------------------------------

Risk :

unrelated changes committed.

Mitigation :

- explicit git status ;
- no git add -A ;
- stage only named files ;
- audit mission.

------------------------------------------------------------
25.8 Test optimism
------------------------------------------------------------

Risk :

smokes pass but user real runtime broken.

Mitigation :

- real-runtime smokes ;
- manual checklist ;
- user-reported bugs override tests.

============================================================
26. INCIDENT RESPONSE
============================================================

Incident examples :

- user data loss ;
- delete unsafe ;
- formula inversion ;
- Stockfish cache mix ;
- attempt not saved ;
- analysis infinite ;
- forbidden metric visible ;
- app cannot start.

Incident protocol :

1. stop feature work ;
2. reproduce ;
3. preserve data ;
4. write incident note ;
5. create P0 mission ;
6. add regression test ;
7. fix ;
8. run full relevant tests ;
9. update docs ;
10. postmortem.

Postmortem template :

- incident summary ;
- user impact ;
- root cause ;
- detection ;
- recovery ;
- what worked ;
- what failed ;
- action items ;
- tests added ;
- owner ;
- due date.

No blame.

============================================================
27. DECISION LOG
============================================================

Important decisions require docs/DECISIONS_LOG.md future.

Record :

- date ;
- decision ;
- context ;
- alternatives ;
- tradeoffs ;
- owner ;
- revisit date.

Examples :

- moving SkillTrace out of shadow ;
- exposing Transfer Gap ;
- changing formula ;
- changing Stockfish profile ;
- enabling LLM ;
- enabling cloud sync ;
- changing Daily Plan heuristic.

============================================================
28. FEATURE FLAGS
============================================================

Use feature flags for risky/future features.

Flags possible :

- enable_intent_light ;
- enable_candidate_trainer ;
- enable_llm_coach ;
- enable_transfer_gap_visible ;
- enable_foundations ;
- enable_sandbox ;
- enable_skilltrace_in_plan ;
- enable_light_mode ;
- enable_notifications.

Default V1 :

all false except explicitly V1 features.

Flags must not expose forbidden features accidentally.

============================================================
29. PERFORMANCE BUDGETS
============================================================

------------------------------------------------------------
29.1 Frontend
------------------------------------------------------------

Targets :

- /app perceived load < 1.5 s ;
- screen transition < 150 ms ;
- click board response < 50 ms ;
- toast < 100 ms ;
- modal open < 120 ms ;
- mobile tap response < 80 ms.

------------------------------------------------------------
29.2 Backend
------------------------------------------------------------

Targets :

- Today < 800 ms ;
- Review loaded already computed < 1 s ;
- Practice attempt feedback < 200 ms ;
- import PGN normal perceived < 500 ms ;
- Daily Plan existing < 800 ms ;
- Daily Plan create < 1 s normal DB.

------------------------------------------------------------
29.3 Engine
------------------------------------------------------------

Targets depend machine.

Must have :

- progress ;
- timeout ;
- recovery ;
- no infinite spinner.

============================================================
30. ACCESSIBILITY ENGINEERING
============================================================

Engineering must support Plan2 accessibility.

Required tests/future checks :

- focus visible ;
- target size ;
- click-click board ;
- reduced motion ;
- keyboard minimum ;
- contrast audit ;
- ARIA labels actions.

No drag/drop-only interaction.

No color-only feedback.

============================================================
31. SOURCE CONTROL OF GENERATED ARTIFACTS
============================================================

Do not commit :

- temp DB ;
- screenshots unless explicit ;
- logs with secrets ;
- node_modules ;
- build artifacts ;
- pycache ;
- local venv ;
- downloaded Stockfish binaries unless project policy says.

Commit if mission requires :

- scripts ;
- tests ;
- docs ;
- migrations ;
- source files.

============================================================
32. CODEX PROMPT TEMPLATE
============================================================

Use this for every mission.

MISSION CODEX — <SPRINT_ID>

Repository:
C:\Users\bahij\OneDrive\Desktop\NeuroChess2_vraie\NeuroChess2

Read first:
- AGENTS.md
- docs/PLAN_SOURCE_OF_TRUTH.md
- docs/PLAN_CONTEXT_MIN.md
- plan/Plan1.txt
- plan/Plan2.txt
- plan/Plan3.md
- relevant docs

Goal:
<one precise objective>

Absolute rules:
- Do NOT commit unless explicitly authorized.
- Do NOT stage.
- Do NOT modify Stockfish/formulas/metrics unless mission says.
- Do NOT add V2/V3 features.
- Keep diff controlled.

Tasks:
1. git status
2. inspect current code
3. implement minimal diff
4. add tests
5. run validations
6. update docs
7. final report

Tests:
<exact commands>

Acceptance criteria:
<clear list>

Final report:
- files changed
- tests run
- evidence
- limitations
- final git status

============================================================
33. CANONICAL VALIDATION COMMANDS
============================================================

Adjust paths if environment differs.

Plan guard :

C:\Users\bahij\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe tools\plan_guard.py

Backend tests :

$env:PYTHONPATH=(Resolve-Path .manual_pydeps\site-packages).Path
$env:TEMP=(Resolve-Path .tmp\test-run-local).Path
$env:TMP=$env:TEMP
$env:TMPDIR=$env:TEMP
.venv_repair_local\Scripts\python.exe -m unittest discover backend/tests

Frontend :

cmd /c npm.cmd run build
cmd /c npx tsc --noEmit

Python smokes :

.venv_repair_local\Scripts\python.exe scripts\review_regression_smoke.py
.venv_repair_local\Scripts\python.exe scripts\pgn_import_smoke.py
.venv_repair_local\Scripts\python.exe scripts\pgn_sindarov_real_flow_smoke.py

Browser smokes :

cmd /c node scripts\browser_v1_flow_smoke.mjs
cmd /c node scripts\browser_profile_privacy_smoke.mjs
cmd /c node scripts\browser_daily_plan_smoke.mjs
cmd /c node scripts\browser_core_board_interaction_smoke.mjs
cmd /c node scripts\browser_analysis_stall_recovery_smoke.mjs
cmd /c node scripts\browser_review_exploration_real_smoke.mjs
cmd /c node scripts\browser_real_analysis_no_infinite_loop_smoke.mjs
cmd /c node scripts\browser_degraded_states_smoke.mjs
cmd /c node scripts\browser_mobile_responsive_smoke.mjs

Diff :

git diff --check
git status --short --branch

============================================================
34. WHAT NOT TO BUILD NOW
============================================================

V1 forbids :

- LLM coach ;
- Candidate Trainer ;
- Intent Deep ;
- Transfer Gap visible ;
- ETV visible ;
- FSRS visible ;
- NeuroMonitor ;
- brain/cortex/atlas ;
- Cognitive Map ;
- social ;
- multiplayer ;
- free-play AI ;
- cloud sync ;
- subscriptions ;
- advanced repertoire ;
- MIRT/BKT visible ;
- contextual bandit.

V1 allows :

- foundation for future ;
- shadow data ;
- internal logs ;
- docs ;
- tests ;
- feature flags off.

============================================================
35. FIRST NEXT STEP AFTER PLAN3 REPLACEMENT
============================================================

After replacing Plan3, do not start new feature immediately.

Recommended next mission :

P0.DIRTY-WORKTREE-AUDIT-AND-RECOVERY

Reason :

worktree contains dirty files from runtime/board/analysis missions.

Goal :

classify dirty files, run relevant tests, decide commit/continue/revert.

Only after that :

finish real-runtime board exploration and analysis repair.

============================================================
36. FINAL SUMMARY
============================================================

Plan1 says what is scientifically true.
Plan2 says how the user feels and acts.
Plan3 says how to build, test, ship and recover without losing the mission.

NeuroChess must be built like this :

truth before beauty
contracts before code
tests before trust
recovery before sophistication
V1 before V2
user data before convenience
small diffs before big dreams
evidence before confidence

The final promise of Plan3 :

NeuroChess will not become revolutionary because Codex implements everything.
NeuroChess will become revolutionary because every small piece is correct, tested, humane, recoverable and aligned.

============================================================
37. SOURCES AND INSPIRATIONS
============================================================

These sources inform Plan3’s engineering doctrine:

- DORA metrics: deployment frequency, lead time for changes, change failure/recovery metrics.
- Google SRE: SLOs, error budgets, incident learning, reliability as a product property.
- OpenTelemetry: telemetry as traces, metrics and logs, vendor-neutral observability.
- OWASP ASVS: application security verification requirements and secure development controls.
- Plan1 v3.0: scientific constitution.
- Plan2 v4.0: UX/product/interface constitution.

Raw source links:

- https://dora.dev/guides/dora-metrics/
- https://sre.google/sre-book/embracing-risk/
- https://sre.google/workbook/error-budget-policy/
- https://opentelemetry.io/docs/
- https://opentelemetry.io/docs/concepts/observability-primer/
- https://owasp.org/www-project-application-security-verification-standard/
- https://github.com/OWASP/ASVS

============================================================
FIN DU PLAN 3 — EXÉCUTION TECHNIQUE NEUROCHESS v4.0 FINAL 20/20 CODEX-READY
============================================================