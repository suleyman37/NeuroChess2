# Etat du projet - NeuroChess2

Etat factuel etabli depuis le README, les documents `docs/`, les routes FastAPI
et les fichiers frontend/backend inspectes.

## Version actuelle connue

- Version officielle historique selon `README.md` : V5.1.
- Le repo contient des documents et du code lies a V5.2 universal board
  evaluation (`docs/v5_2_*`, contextes live `historical/review/final/initial`
  dans le frontend et le backend). Statut exact : unknown / to verify.
- V5.2 PGN Import Minimal est maintenant implemente comme import manuel local
  et historique minimal.
- Ambiguite de nommage : `V5.2` designe a la fois des traces universal board
  evaluation et la mission PGN Import Minimal. A clarifier humainement pour les
  prochaines versions.
- V6 : non demarree.

## Features livrees

- Backend SQLite avec migrations idempotentes.
- Integration Stockfish via `python-chess`, avec resolution du chemin Stockfish.
- Session de partie locale : coups legaux, SAN/UCI, FEN avant/apres, PGN,
  resultat.
- API FastAPI locale pour creer/lister/charger/terminer des parties et jouer
  des coups.
- Pipeline d'analyse durable `engine_analysis_v2` avec analyses shallow/deep,
  statut `pending/running/done/failed`, MultiPV et logs JSONL.
- Barre d'evaluation basee sur `eval_cp` POV Blancs et `mate_in`.
- Review post-game V4 locale sans LLM, basee sur analyses deep, avec correctifs
  V5.1.4 a V5.1.8 sur spinner, pending/stalled, batch deep, partial,
  no_significant_moments et failed deep.
- Selection Review V5.2.3 par criticite du moment :
  perte de Win% du joueur, zone avant/apres, persistance, nouveaute et
  `selection_algorithm_version = "moment_selection_criticality_v4"`.
- V5.2.4 stabilise les evaluations Review : snapshots deep stabilises,
  fenetre finale de stabilite et `reliability_score` dans la criticite.
- V5.2.x consolide la Review courante avec seuil unique
  `criticality_score >= 10.0`, temporal NMS, source UI `review_deep_snapshot`
  et `selection_algorithm_version = "moment_selection_criticality_v4"`.
- V5.3.A ajoute un score de precision Review 0-100 par couleur, base sur la
  perte de Win% et pondere par la criticite des coups, avec confiance
  `high` / `medium` / `low`. Ce score n'est pas un Elo.
- V5.3.A2 remplace la formule par `neuro_review_score_v1` : mean ponderee,
  harmonic, worst-tail et cap par pire perte, avec debug composants en DEV et
  origine d'analyse (`cached_full`, `cached_partial`, `newly_scheduled`, etc.).
- V5.3.A3 remplace la formule courante par `neuro_review_score_v1_1`,
  adoucit les caps de pire perte, expose `review_analysis_quality`, la
  couverture deep, les profondeurs moteur et un audit coup par coup en DEV.
- V5.3.A4 ajoute des profils Review time-budgeted `quick`, `standard` et
  `deep`. Une analyse standard/deep utilise un budget temps par position,
  ignore les caches legacy trop faibles et expose les settings Stockfish.
- V5.3.A4c ajoute un cycle de vie de job Review asynchrone : demarrage rapide
  avec `job_id`, progression X/Y positions, annulation cooperative,
  `force_reanalysis` et gate complete-only. Une Review standard/deep partielle
  n'affiche plus scores ni moments.
- V5.3.A4d durcit l'UX/DB Review : WAL/busy_timeout/retry, suspension du live
  dans l'onglet Review, restauration apres refresh, choix Standard/Approfondie
  pour `Relancer depuis zero` et `quick` cache de l'UI normale.
- V5.3.A4e ajoute l'etat `finalizing`, rend la finalisation Review idempotente,
  rend `GET /review/jobs/{job_id}` strictement read-only, augmente le
  `busy_timeout` SQLite a 30s et serialise les writes critiques avec retry.
- V5.3.A4f ajoute un watchdog des jobs Review : heartbeat, `stalled`,
  reconciliation depuis `position_analyses`, timeout externe Stockfish,
  traitement deterministe des positions terminales et clamp MultiPV au nombre de
  coups legaux.
- V5.3.A4g ajoute un harnais de regression Review : fake engine deterministe
  configurable par environnement, verification `board.is_valid()` avant moteur,
  retry SQLite avec jitter, endpoint Diagnostic Pack et smoke test backend pour
  le scenario deep/88-89/reprise.
- V5.3.A4g-R1 rend les endpoints GET Review status/diagnostics strictement
  read-only. Les reparations watchdog/finalize/reconcile passent par le worker
  ou par `POST /review/jobs/{job_id}/reconcile`, et le frontend affiche un etat
  derive sans POST en boucle.
- V5.3.A5-1 separe le score Review en deux metriques : une Accuracy
  Lichess-like publique (`lichess_weighted_harmonic_v1`) et un Score
  NeuroChess diagnostique regulier (`neuro_diagnostic_regularized_v1`). Le
  payload expose aussi le `diagnostic_gap` et un contrat `review_evidence_v1`,
  sans appel LLM ni categories de coups.
- V5.3.A5-1-R1 ajoute le backfill/rebuild des metriques duales pour les Reviews
  completes legacy : `POST /games/{game_id}/review/rebuild-metrics` reconstruit
  Accuracy, NeuroScore, Diagnostic Gap et Evidence JSON depuis les
  `position_analyses` existantes, sans relancer Stockfish.
- Detection d'ouverture V5 et import book local V5.1 depuis sources Lichess
  locales.
- Import PGN manuel V5.2 : preview, import, deduplication, alias utilisateur,
  stockage metadata, clocks PGN si presentes, classification ouverture best
  effort, historique minimal.
- Bridge V5.2.1 : les parties importees peuvent etre ouvertes depuis
  l'historique dans le board existant, naviguees coup par coup et envoyees
  manuellement dans le pipeline Review sans analyse massive automatique.
- V5.2.2 : l'historique devient une bibliotheque de parties avec categories
  `local_manual`, `local_ai`, `imported_user`, `imported_observed`,
  `analysis_sandbox`, `unknown`, scopes API et labels UI propres.
- Frontend React/Vite pour playtest local avec onglets partie, review, import
  PGN et historique.

## Architecture backend

- `backend/app.py` initialise FastAPI, les migrations et les services au
  lifespan.
- `backend/neurochess/api/` contient routes et schemas API.
- `backend/neurochess/data/` contient connexion SQLite, migrations, modeles et
  repositories.
- `backend/neurochess/core/` contient logique pure : session, recorder,
  evaluation display, rating/reliability et snapshots stabilises.
- `backend/neurochess/engines/` contient configuration et service Stockfish.
- `backend/neurochess/metrics/` contient les formules Review pures et
  testables. V5.3.A5-1 y centralise Win%, move accuracy Lichess-like, game
  accuracy Lichess-like, NeuroScore regulier et Diagnostic Gap.
- `backend/neurochess/llm/` existe mais semble etre un placeholder vide :
  unknown / to verify.
- `backend/neurochess/analysis_service.py` gere analyses persistantes.
  V5.2.4 ajoute `analysis_json.stabilized_eval` aux analyses deep quand la
  source le permet, avec fallback final-only `unknown`.
  V5.3.A4 ajoute les metadonnees de profil Review (`analysis_profile`,
  `requested_time_ms`, `requested_multipv`, `analysis_limit_mode`,
  `settings_json`) et transmet `analysis_limit_mode="time"` au moteur pour les
  analyses Review standard/deep.
  V5.3.A4g permet `NEUROCHESS_ENGINE_MODE=fake` pour tests/smoke et rejette les
  FEN parseables mais invalides via `board.is_valid()` avant appel moteur.
- `backend/neurochess/live_analysis_service.py` gere sessions live SSE.
- `backend/neurochess/review_service.py` gere la review post-game.
  V5.1.8 finalise le pipeline : pending seulement avec travail actif, fallback
  partial si coverage suffisante, failed deep visibles/relancables, batch
  background dimensionne sur les FEN requises.
  V5.2.4 lit les snapshots stabilises pour calculer la perte de Win% et pondere
  la criticite par `reliability_score`.
  V5.3.A2 calcule `neuro_review_score_v1` a la volee depuis les analyses deep
  done, sans migration et sans utiliser live/shallow.
  V5.3.A3 calcule `neuro_review_score_v1_1`, expose les modes qualite
  `cached` / `standard` et ajoute `review_score_audit_rows` pour auditer chaque
  coup score.
  V5.3.A4 ajoute `review_analysis_profile`, budgets 80/140/220/300 secondes en
  standard, profil deep plafonne a 450 secondes, cache quality gate et
  progression `X/Y positions` pour l'analyse Review.
  V5.3.A4e calcule les moments/scores avant la transaction finale et ecrit
  `game_reviews` / `review_moments` dans une transaction courte retryable.
  V5.3.A5-1 expose des scores separes : `*_lichess_like_accuracy`,
  `*_neuro_score` et `*_diagnostic_gap`. Les anciens `*_review_score` restent
  des alias de l'accuracy publique pour compatibilite.
- `backend/neurochess/review_job_service.py` gere les jobs Review A4c :
  creation, progression, annulation, relance forcee et finalisation seulement
  quand toutes les positions requises sont analysees.
  V5.3.A4e ajoute `finalize_review_job(job_id)`, l'etat `finalizing`, la reprise
  intelligente `88/89` ou `89/89 sans Review finale`, et evite toute ecriture
  depuis le polling de statut.
  V5.3.A4f ajoute `reconcile_review_job(job_id)`, detecte les jobs running
  stales, marque `stalled` retryable et recalcule la couverture depuis la base
  au lieu de croire aveuglement les compteurs stockes.
  V5.3.A4g ajoute `get_job_diagnostics(job_id)` pour exporter un Diagnostic Pack
  read-only avec compteurs recalcules, phase, FEN courante et settings.
- `backend/neurochess/opening_service.py` gere import/classification
  d'ouvertures.
- `backend/neurochess/opening_book_preparer.py` prepare le book local
  d'ouvertures depuis les sources TSV Lichess vers `openings_book.json`.
- `backend/neurochess/pgn_import_service.py` gere preview/import PGN,
  deduplication, alias utilisateur, insertion games/moves et historique.

## Architecture frontend

- `frontend/` est une app React + TypeScript + Vite.
- `frontend/src/App.tsx` orchestre partie, navigation, review, live analysis,
  import PGN, historique et state principal.
- `frontend/src/api/client.ts` centralise les appels API.
- `frontend/src/components/` contient les composants principaux : echiquier,
  barre d'evaluation, historique de coups, panneau review.
- `frontend/src/evaluationDisplay.ts` et `frontend/src/reviewState.ts`
  contiennent des helpers de presentation/state.
- `frontend/src/styles.css` contient le style global.

## Endpoints importants

- `GET /health`
- `POST /games`
- `GET /games`
- `GET /games/{game_id}`
- `GET /games/{game_id}/moves`
- `POST /games/{game_id}/moves`
- `POST /games/{game_id}/finish`
- `GET /analyses/by-fen`
- `GET /games/{game_id}/analyses`
- `POST /games/{game_id}/review/generate`
- `GET /games/{game_id}/review`
- `POST /games/{game_id}/review/rebuild-metrics`
- `POST /games/{game_id}/review/jobs`
- `GET /review/jobs/{job_id}`
- `GET /review/jobs/{job_id}/diagnostics`
- `POST /review/jobs/{job_id}/cancel`
- `POST /openings/import-seed`
- `POST /openings/import-book`
- `POST /games/{game_id}/opening/classify`
- `GET /games/{game_id}/opening`
- `POST /live-analysis/start`
- `POST /live-analysis/stop`
- `GET /live-analysis/stream`
- `POST /games/import-pgn/preview`
- `POST /games/import-pgn`
- `GET /games/history?scope=mine|imported|local|ai|observed|all`

## Migrations existantes

- `0001_v0_schema` : tables `games`, `moves`, `position_analyses` et index de
  base.
- `0002_v3_5_durable_analysis_pipeline` : pipeline d'analyse durable,
  `analysis_json`, `engine_version`, `multipv`, statuts et `analysis_kind`.
- `0003_v4_post_game_review` : tables `game_reviews` et `review_moments`.
- `0004_v5_opening_detection` : tables `opening_lines`,
  `opening_line_nodes`, `game_opening_classifications`.
- `0005_v5_2_pgn_import` : colonnes PGN/historique sur `games`, colonnes clock
  PGN sur `moves`, table `user_aliases`, index dedup/history.
- `0006_v5_2_2_game_history_categories` : colonne additive
  `games.game_category`, backfill prudent local/imported/observed/ai/unknown,
  index `idx_games_game_category`.
- `0007_v5_3a4_review_analysis_profiles` : colonnes additives
  `analysis_profile`, `requested_time_ms`, `requested_depth`,
  `requested_multipv`, `analysis_limit_mode`, `settings_json` sur
  `position_analyses`, plus index `idx_position_analyses_profile`.
- `0008_v5_3a4c_review_jobs` : table additive `review_jobs` pour suivre les
  jobs Review asynchrones, leur progression, leur annulation et leurs settings.
- `0009_v5_3a4d_review_job_hardening` : colonnes `failed_reason`,
  `last_error`, `retryable` et index par `game_id/profile/status` pour reprise
  et messages d'erreur propres.
- `0010_v5_3a4e_review_job_finalizing` : migration de la contrainte
  `review_jobs.status` pour accepter `finalizing` sans perdre les jobs existants.
- `0011_v5_3a4f_review_job_watchdog` : migration de la contrainte
  `review_jobs.status` pour accepter `stalled` et ajout des colonnes heartbeat /
  phase courante / FEN courante / attempts pour le watchdog.

## Harnais de regression Review

Depuis la racine :

```bash
python scripts/review_regression_smoke.py
```

Sur ce PC :

```bash
.venv\Scripts\python.exe scripts\review_regression_smoke.py
```

Le script force `NEUROCHESS_ENGINE_MODE=fake`, cree une DB temporaire, lance une
Review deep, verifie qu'une Review partielle ne montre pas score/moments,
simule un refresh par rechargement du job, force un hang sur la derniere
position, verifie `failed/stalled` retryable, puis reprend jusqu'a `completed`.

## Commandes de test backend

Depuis la racine du projet :

```bash
python -m unittest discover backend/tests
python -m unittest backend/tests/test_engine_config.py
python -m unittest backend/tests/test_database.py
python -m unittest backend/tests/test_stockfish_service.py
python -m unittest backend/tests/test_evaluation_display.py
python -m unittest backend/tests/test_analysis_reliability.py
python -m unittest backend/tests/test_rating_math.py
python -m unittest backend/tests/test_game_recorder.py
python -m unittest backend/tests/test_game_api.py
python -m unittest backend.tests.test_pgn_import_service
```

Sur ce PC, `python` global n'est pas disponible ; la commande executee en local
utilise `.venv\Scripts\python.exe`.

## Commande build frontend

Depuis `frontend/` :

```bash
npm run build
```

Equivalent detaille selon `package.json` :

```bash
tsc && vite build
```

Sur ce PC, `npm` global n'est pas disponible ; la validation locale utilise le
runtime Node fourni par Codex pour lancer `tsc` puis `vite build`.

## Bugs connus ou a verifier

- Statut exact V5.1 vs traces V5.2 universal board eval : unknown / to verify.
- Ambiguite de nommage V5.2 a clarifier pour eviter que universal board eval et
  PGN Import Minimal portent le meme libelle.
- Review V5.1.8 doit etre validee en navigateur sur trois cas : pending actif,
  failed/stalled avec details, et no_significant_moments.
- Review V5.2.3 doit etre validee en navigateur sur des parties avec tournant,
  avantage laisse filer, aggravation et aucun moment significatif.
- Review V5.2.4 doit etre validee en navigateur pour confirmer que la barre
  Review affiche `review_stabilized_deep`, ignore live/shallow et n'affiche pas
  un fallback 50 quand le snapshot manque.
- Review V5.2.x doit etre validee en navigateur pour confirmer que la barre
  affiche `review_deep_snapshot`, que `Voir sur l'echiquier` anime le coup et
  que les moments suivent `criticality_score >= 10.0` avec temporal NMS.
- Review V5.2.z doit etre validee en navigateur pour confirmer le replay
  `fen_before -> fen_after`, la barre before/after, les cas mate et le toggle
  global `Masquer l'evaluation`.
- Review V5.2.za doit etre validee en navigateur pour confirmer le replay plus
  lent, les fleches de coup, les boutons `Voir le coup joue` / `Voir le
  meilleur coup`, l'overlay de delta sur la barre et le debug replie.
- Review V5.3.A4c doit etre validee en navigateur pour confirmer le polling
  job, l'annulation cooperative, `force_reanalysis=true` et l'absence de
  score/moments quand une analyse standard/deep est incomplete.
- Review V5.3.A doit etre validee en navigateur pour confirmer le resume
  `Score de precision`, l'affichage `Mon score` / `Adversaire` quand
  `user_color` est connu, le badge indicatif en confiance low et l'absence
  d'Elo / ACPL par defaut.
- Review V5.3.A2 doit etre validee en navigateur sur une mauvaise partie
  volontaire : le score doit descendre nettement sous 90, afficher sa confiance
  et expliquer l'origine d'analyse si le cache deep rend la Review instantanee.
- Review V5.3.A3 doit etre validee en navigateur sur la partie comparee a
  Chess.com : l'UI doit afficher qualite d'analyse, couverture, confidence et
  permettre d'ouvrir le debug DEV replie pour expliquer les ecarts coup par coup.
- Review V5.3.A4 doit etre validee en navigateur pour confirmer qu'une nouvelle
  partie sans cache standard n'est plus presentee comme une analyse standard
  instantanee, que les settings Stockfish sont visibles et que la progression
  `X/Y positions` avance.
- Verification navigateur manuelle necessaire pour toute modification UI.
- Playwright n'est pas documente comme configure dans le projet.
- Les uploads multipart PGN fonctionnent avec un fallback stdlib si
  `python-multipart` n'est pas installe.
- V5.2.2 doit etre verifie en navigateur pour confirmer la lisibilite des
  cartes historique, les filtres et l'absence de `? - ?`.

## Prochaine etape recommandee

Valider d'abord V5.2.2 Game History UX en navigateur :

- verifier que `Mes parties` affiche les parties locales et importees liees a
  l'utilisateur ;
- verifier les filtres Importees, Locales, IA, Observees et Toutes ;
- confirmer qu'aucune ligne `? - ?` n'apparait ;
- ouvrir une partie locale puis une partie importee ;
- confirmer qu'aucune analyse massive et aucun score global ne sont lances ou
  affiches.

Puis revalider V5.2.1 Imported Game Analysis Bridge en navigateur :

- importer un PGN reviewable ;
- cliquer la partie depuis l'historique ;
- verifier le board, la navigation `<< < > >>`, l'ouverture et le bouton Review ;
- lancer Review manuellement ;
- confirmer que seules les deep analyses de cette partie sont creees a la
  demande.

Puis revalider V5.1.8 Review Pipeline Finalization en navigateur :

- partie reviewable avec analyses completes mais aucun moment ;
- deep failed avec coverage suffisante vers partial/no_significant_moments ;
- deep failed avec coverage insuffisante vers stalled + bouton Relancer ;
- confirmation que "analyse continue en arriere-plan" n'apparait jamais quand
  `review_work_active=false`.

Puis valider V5.2.4 Review Stabilized Engine Snapshots :

- lancer une Review sur une partie reviewable ;
- verifier que les moments exposent `eval_source_kind=review_stabilized_deep` ;
- verifier que la barre Review ne bouge pas avec le live/shallow ;
- verifier que les analyses instables sont ponderees par une fiabilite plus
  faible ;
- confirmer qu'aucune analyse massive hors partie demandee n'est lancee.

Puis valider V5.2.x Review Criticality + Stable Review Bar :

- lancer une Review sur une partie avec un vrai tournant ;
- verifier que les moments exposes ont `selection_algorithm_version=moment_selection_criticality_v4` ;
- verifier que la barre Review affiche `review_deep_snapshot` et pas live/shallow ;
- verifier que le delta rouge/vert est visible ;
- verifier que les moments proches redondants sont evites par temporal NMS ;
- verifier qu'une partie plate retourne `no_significant_moments`.

Puis valider V5.2.z Review Playback UX + Stable Bar Animation + Toggle :

- cliquer `Voir sur l'echiquier` sur un moment Review ;
- verifier que l'echiquier part de `fen_before` puis arrive sur `fen_after` ;
- verifier que la barre Review passe de before a after sans live/shallow ;
- verifier que le delta rouge/vert est visible ;
- verifier qu'un moment avec mate ne rend pas la barre indisponible ;
- activer `Masquer l'evaluation`, rafraichir et confirmer que la preference
  persiste sans casser la Review.

Puis valider V5.2.za Review Pedagogy Polish :

- cliquer `Voir le coup joue` sur une carte Review ;
- verifier que l'avant reste visible assez longtemps ;
- verifier la fleche orange/rouge et la transition lente vers l'apres ;
- verifier l'overlay de delta dans la barre ;
- cliquer `Voir le meilleur coup` ;
- verifier la fleche verte depuis la meme position avant ;
- confirmer que le debug Review est replie par defaut en dev ;
- confirmer que le toggle `Masquer l'evaluation` masque barre, valeurs et
  delta sans casser le replay.

Puis valider V5.3.A Review Score :

- lancer une Review avec analyses deep disponibles ;
- verifier le bloc `Score de precision` ;
- verifier `Mon score` / `Adversaire` si `user_color` est connu ;
- verifier `Blancs` / `Noirs` si `user_color` est inconnu ;
- verifier le badge indicatif si la confiance est low ;
- confirmer qu'aucun Elo, ACPL ou score global NeuroChess n'est affiche.

Puis valider V5.3.A2 Review Score Calibration :

- jouer ou importer une partie volontairement mauvaise ;
- lancer la Review ;
- verifier que les grosses pertes Win% font baisser le score nettement sous 90 ;
- verifier qu'une grosse gaffe applique le cap du score ;
- verifier `Analyse deja disponible` si toutes les deep etaient deja en cache ;
- en dev, ouvrir le debug score replie et verifier mean/harmonic/worst-tail/cap.

Puis valider V5.3.A3 Review Score Validation :

- relancer la partie ou Chess.com affiche environ 85 / 80 ;
- verifier si NeuroChess indique `cached`, `standard` ou score indicatif ;
- verifier la couverture `deep_done_count / required_position_count` ;
- ouvrir le debug score replie en DEV ;
- controler les coups a forte `win_loss`, leur profondeur et leur source ;
- confirmer que `neuro_review_score_v1_1` explique les caps et l'ecart eventuel ;
- confirmer qu'aucun ACPL, Elo, V5.3.B ou V6 n'est affiche.

Puis valider V5.3.A4 Time-Budgeted Review Analysis :

- lancer Review sur une partie sans cache standard/deep ;
- verifier le mode `Standard recommande` ;
- confirmer que le backend programme des analyses `analysis_limit_mode=time` ;
- verifier l'affichage `Analyse approfondie : X/Y positions` ;
- verifier que `legacy_cache_ignored_count` augmente si seuls des caches legacy
  existent ;
- relancer apres completion standard et verifier `Analyse deja disponible` ;
- confirmer qu'aucune analyse massive d'historique n'est lancee.

Puis valider V5.3.A4b Engine Profiles + Live Continuous :

- ouvrir une position et verifier que la profondeur live augmente tant que la
  FEN affichee ne change pas ;
- jouer un coup ou naviguer dans l'historique et verifier qu'une nouvelle
  session live remplace proprement l'ancienne ;
- confirmer qu'une reponse live d'une ancienne FEN n'est jamais affichee ;
- lancer une Review standard et verifier que le live est stoppe/suspendu ;
- verifier que la Review affiche Threads, Hash, MultiPV, mode `time` et X/Y
  positions ;
- verifier que standard/deep utilisent `Limit(time=...)` et pas `depth=12` ;
- verifier que `live_continuous`, shallow, quick ou legacy ne satisfont pas
  standard/deep ;
- confirmer qu'aucune V5.3.B, V6, Study Mode ou Syzygy Trainer n'est visible.

Puis valider V5.3.A4d Review UX/DB Hardening :

- lancer une analyse standard/deep longue et verifier que la progression X/Y
  reste visible sans `Failed to fetch` normal ;
- confirmer que le live affiche `Live suspendu pendant la Review` ou reste
  arrete quand l'onglet Review est actif ;
- faire F5 pendant un job Review et verifier que la partie, l'onglet Review et
  le job en cours sont restaures ;
- provoquer ou simuler un lock transitoire : le message principal doit etre
  lisible et proposer `Reprendre`, avec l'erreur brute seulement en debug ;
- cliquer `Relancer depuis zero` et verifier le choix Standard recommandee /
  Approfondie ;
- confirmer que `Rapide` n'est plus propose dans l'UI normale ;
- verifier qu'une Review incomplete/failed/cancelled ne montre pas score ou
  moments.

Puis valider V5.3.A4e Deep Review Finalization Lock Fix :

- relancer une analyse approfondie sur la partie qui echouait a `88/89` ;
- verifier que la progression atteint `89/89` ;
- verifier l'etat `Finalisation de la Review...` si visible ;
- confirmer que score/moments apparaissent uniquement apres `completed` ;
- si un verrou SQLite transitoire revient, cliquer `Reprendre` et verifier que
  seules les positions manquantes/finalisation sont reprises ;
- verifier qu'un job a `89/89` sans Review finale se termine sans relancer
  Stockfish ;
- ouvrir deux onglets et confirmer que le second retrouve le job actif au lieu
  de creer un deuxieme job deep ;
- faire F5 pendant `finalizing` et verifier que l'etat est restaure sans score
  partiel.

Puis valider V5.3.A4f Review Job Watchdog + Last Position Recovery :

- relancer l'analyse deep de la partie qui restait bloquee a `88/89` ;
- verifier qu'elle passe a `89/89 -> finalizing -> completed` ou bien
  `stalled/failed retryable`, mais jamais `running` infini ;
- cliquer `Reprendre` et verifier que les positions deja done ne sont pas
  recalculees ;
- tester une partie finissant par mat ou pat et verifier que la derniere FEN est
  traitee sans appel Stockfish ;
- verifier que l'UI affiche `Analyse bloquee temporairement` avec debug replie
  si le watchdog detecte un blocage ;
- verifier que `completed` seul affiche score/moments.

Puis valider V5.3.A5-1 Review Metric Core :

- lancer une Review complete standard/deep ;
- verifier que le resume affiche Accuracy Lichess-like, Score NeuroChess et
  Ecart diagnostique ;
- confirmer que les anciens champs `*_review_score` correspondent a l'accuracy
  publique et que `*_neuro_score` reste separe ;
- ouvrir le debug score en DEV et verifier `move_accuracy_formula_version`,
  `game_accuracy_formula_version`, `neuro_score_formula_version` et les champs
  de diagnostic loss ;
- confirmer qu'aucune categorie de coups, aucun Study Mode, aucun Elo
  NeuroChess et aucun LLM ne sont visibles.

Puis valider V5.3.A5-1-R1 Dual Score Backfill :

- ouvrir une Review complete deja calculee avant A5-1 ;
- verifier que l'UI n'affiche plus `Score NeuroChess : non disponible` sans
  explication ;
- si le message de metriques legacy apparait, cliquer `Recalculer les
  metriques` ;
- confirmer que le recalcul ne lance pas de job Stockfish et ne change pas les
  positions analysees ;
- confirmer que Accuracy Lichess-like, Score NeuroChess et Ecart diagnostique
  sont visibles apres rebuild ;
- verifier que les textes Review ne contiennent plus `prÃ`, `Ã` ou `Â`.

Ensuite valider V5.2 PGN Import Minimal en navigateur :

- preview d'un PGN simple ;
- import d'un PGN multi-parties ;
- deduplication ;
- affichage historique ;
- confirmation qu'aucune analyse Stockfish ni Review n'est lancee
  automatiquement.

Ne pas commencer V6 tant que cette validation humaine n'est pas faite.

## V5.2.PGN-R1 - Robust PGN Import

Etat : implemente.

Ajouts :

- Import Lichess `Variant="From Position"` avec `SetUp=1` + `FEN` comme
  `initial_fen`.
- Import Chess.com avec extraction de l'id depuis `Link` et stockage de
  `CurrentPosition` comme metadata, sans l'utiliser comme depart.
- Reconstruction des sessions et de `GET /games/{game_id}/moves` depuis
  `games.initial_fen`.
- Historique enrichi avec metadata PGN et badge `Position speciale`.
- Opening classification marquee `not_applicable_from_position` pour les
  positions initiales non standard.
- Fixtures et smoke `scripts/pgn_import_smoke.py` pour Chess.com et Lichess
  From Position.

A valider navigateur :

- importer un PGN Chess.com avec `CurrentPosition` ;
- verifier que l'echiquier s'ouvre depuis la position standard ;
- importer un PGN Lichess From Position ;
- verifier que l'echiquier s'ouvre depuis le FEN header ;
- lancer une Review depuis l'historique ;
- verifier que l'ouverture non applicable ne bloque pas.
