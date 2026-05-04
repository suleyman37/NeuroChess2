# DOCUMENT MAÎTRE FINAL — PLAN 3/3 NEUROCHESS

## ARCHITECTURE TECHNIQUE, ROADMAP D'EXÉCUTION, GOUVERNANCE CODEX, TESTS ET LIVRAISON V1

Version : Plan d'exécution technique final v2.2 — version unique transmissible à Codex
Statut : document maître opérationnel à utiliser après Plan 1 et Plan 2
Date de doctrine : après audit croisé ChatGPT / Claude Opus
Objectif : transformer la vision scientifique et UX de NeuroChess en ordre de construction concret, codable, testable, gouverné et livrable.

Note d'utilisation : ce fichier est conçu pour être le seul document maître transmis à Codex. Il est autosuffisant pour piloter l'exécution, mais Codex ne doit jamais l'appliquer en une seule fois. Codex doit lire ce document comme référence, puis exécuter uniquement le sprint explicitement demandé par l'utilisateur.

---

# 0. DÉFINITION DU PLAN 3

Le Plan 1 définit comment NeuroChess pense scientifiquement :

- Stockfish ;
- Win% ;
- win_loss ;
- précision ;
- NeuroScore coach ;
- criticality_score ;
- taxonomie ;
- Practice events ;
- SkillTrace Beta ;
- ETV ;
- Transfer Gap ;
- Intent Layer ;
- sciences cognitives de l'apprentissage ;
- validation scientifique ;
- prudence sur les claims "neuro".

Le Plan 2 définit comment l'utilisateur vit l'application :

- Aujourd'hui ;
- Mes parties ;
- Entraînement ;
- Review ;
- Lecture rapide ;
- Leçon complète ;
- Practice ;
- progression visible ;
- tonalité émotionnelle ;
- dopamine saine ;
- anti-tilt ;
- charge cognitive ;
- timing du feedback ;
- UX calme, premium, claire.

Le Plan 3 définit comment on construit réellement NeuroChess sans se perdre.

Question centrale du Plan 3 :

> Dans quel ordre exact doit-on coder NeuroChess pour passer d'un prototype avancé à une V1 utilisable, stable, testable et évolutive ?

Ce document est le plan de bataille technique.

Il doit empêcher :

- le scope creep ;
- les features codées dans le désordre ;
- les refactors massifs inutiles ;
- les changements de formules non documentés ;
- les modifications Stockfish non contrôlées ;
- les écrans ajoutés sans action claire ;
- les métriques visibles non calibrées ;
- les boutons qui perdent l'utilisateur ;
- les prompts Codex trop larges ;
- la gouvernance infinie sans livraison ;
- le "joli cerveau fake science" ;
- le passage prématuré à la V2/V3 ;
- l'exécution monolithique du plan complet au lieu d'un sprint ciblé.

Règle fondamentale :

> Une mission Codex = un objectif précis = un diff contrôlé = des tests = un rapport.

Règle complémentaire :

> Une V1 utile ne doit pas être une V3 amputée.
> Elle doit être la plus petite boucle complète qui prouve la promesse NeuroChess.

---

# 0.0 MODE D'EMPLOI CODEX — DOCUMENT UNIQUE

Ce document peut être transmis seul à Codex.

Mais règle absolue :

> Codex ne doit jamais appliquer tout ce document d'un coup.

Codex doit utiliser ce document comme :

- référence produit ;
- référence technique ;
- garde-fou de scope ;
- catalogue de sprints ;
- source des acceptance criteria ;
- source des exclusions ;
- source du template de rapport.

À chaque mission, l'utilisateur doit préciser :

- le sprint ID ;
- le but exact ;
- les sections pertinentes ;
- les fichiers attendus ;
- les tests à exécuter.

Si Codex reçoit seulement ce document sans mission explicite, il doit répondre qu'il a compris le plan et demander quel sprint exécuter.

Par défaut :

- pas de commit ;
- pas de stage ;
- pas de refactor global ;
- pas de feature hors sprint ;
- pas de modification Stockfish ;
- pas de changement de formule ;
- pas de LLM ;
- rapport final obligatoire.

Les fichiers de gouvernance mentionnés dans Sprint 0 bis sont des livrables à créer dans le repo. Ils ne sont pas nécessaires comme documents séparés à transmettre à Codex, car leur contenu source est déjà inclus dans ce document unique.

---

# 0.1 DOCTRINE FINALE APRÈS AUDIT CROISÉ

Les arbitrages finaux sont les suivants.

## 0.1.1 Alpha / V1 / V1.1 / V2 / V3

La construction se fait en cinq niveaux.

### Alpha utilisable

Objectif : stabiliser l'expérience principale.

Inclut :

- baseline ;
- board UX ;
- score align ;
- app shell ;
- Today ;
- Games ;
- Review ;
- Practice focus.

But : l'utilisateur comprend quoi faire, importe une partie, lit une Review, tente une position.

Limite : la boucle d'apprentissage n'est pas encore complète.

### V1 réelle

Objectif : fermer la boucle minimale NeuroChess.

Inclut en plus de l'Alpha :

- training_items générés depuis les review_moments ;
- practice_attempts riches ;
- practice_result_event_v1 ;
- simple_spaced_repetition_v1 ;
- Daily Plan déterministe ;
- Privacy / export / delete ;
- QA release candidate.

But : NeuroChess n'est plus seulement un analyseur. Il devient un système qui transforme les erreurs en entraînement et fait revenir les positions au bon moment.

### V1.1

Objectif : activer prudemment les couches d'intelligence interne déjà loggées.

Inclut :

- SkillTrace utilisé progressivement dans la planification ;
- NeuroMonitor / Cognitive Map compact ;
- ETV plus structuré ;
- calibration initiale ;
- premiers tests utilisateurs plus larges.

### V2

Objectif : différenciation forte.

Inclut :

- Intent Layer opt-in ;
- Candidate Trainer ;
- Lichess API ;
- Chess.com API ;
- Progression détaillée ;
- motif-based repetition ;
- validation instrumentation avancée ;
- LLM verifier infrastructure.

### V3

Objectif : système avancé / recherche / produit premium.

Inclut :

- LLM coach vérifié ;
- Transfer Gap visible ;
- BKT / MIRT ;
- contextual bandits ;
- Foundations complet ;
- Advanced Audit ;
- coach / club mode ;
- recommandations apprises.

## 0.1.2 SkillTrace Beta en shadow mode

Décision finale :

> SkillTrace Beta est implémenté en V1, mais reste en shadow mode.

Cela signifie :

- les états alpha/beta sont créés ;
- les états sont mis à jour après chaque tentative Practice ;
- les recommandations théoriques de SkillTrace sont loggées ;
- mais le Daily Plan V1 ne dépend pas fortement de SkillTrace ;
- l'utilisateur ne voit pas de score de maîtrise numérique ;
- aucune promesse scientifique n'est faite.

Le Daily Plan V1 reste déterministe :

1. positions dues ;
2. positions ratées récemment ;
3. moments récents à forte criticality ;
4. diversité minimale des tags ;
5. anti-redondance.

Condition de sortie du shadow mode :

SkillTrace peut commencer à influencer le Daily Plan en V1.1 seulement si :

- au moins 200 practice_attempts exploitables par utilisateur actif avancé ou cohorte de validation ;
- au moins 8 tags distincts observés ;
- corrélation positive entre mastery_mean alpha/beta et taux de réussite réel ;
- seuil cible indicatif : corrélation >= 0.60 sur échantillon de validation ;
- aucune dégradation observée de completion rate ou retry success ;
- décision actée dans DECISIONS_LOG.md.

Tant que ces conditions ne sont pas remplies :

- SkillTrace reste shadow ;
- Daily Plan reste déterministe ;
- SkillTrace sert à préparer la calibration future.

## 0.1.3 Cognitive Map / NeuroMonitor hors V1

Décision finale :

> Pas de Cognitive Map visuelle complète en V1.

Raison :

- trop grand risque de faux signal scientifique ;
- risque UX de dashboard décoratif ;
- risque de "joli cerveau fake science" ;
- données insuffisantes au début ;
- Plan 2 privilégie une progression compacte en V1.

V1 affiche seulement :

- carte "Cette semaine" ;
- ratios simples ;
- activité ;
- positions revues ;
- réussites / tentatives ;
- domaine prioritaire prudent si données suffisantes ;
- sinon "profil en construction".

Seuil de données suffisantes pour afficher un domaine prioritaire V1 :

- au moins 5 parties analysées ;
- au moins 30 practice_attempts ;
- au moins 2 domaines représentés ;
- au moins 5 événements exploitables dans le domaine prioritaire.

Si seuil non atteint, message :

> "Profil en construction — importe quelques parties et termine des sessions pour obtenir une priorité fiable."

Cognitive Map / NeuroMonitor compact déplacé en V1.1.

## 0.1.4 simple_spaced_repetition_v1

Décision finale :

> Ne pas appeler FSRS-lite ce qui n'est pas FSRS.

Le nom V1 officiel est : `simple_spaced_repetition_v1`

Règles V1 :

- wrong : due tomorrow ;
- success with hint : due in 3 days ;
- success without hint : due in 7 days ;
- repeated success : interval multiplier × 1.7 (valeur par défaut V1) ;
- repeated failure : reset à 1 jour, pas de multiplicateur ;
- reveal : due tomorrow ou 2 jours max ;
- skipped : no-op ou soft due selon contexte.

Plafond de l'intervalle V1 : 30 jours. Au-delà, item considéré "appris" et sort de la file active.

FSRS réel ou FSRS-lite plus sophistiqué est V2/V3.

## 0.1.5 i18n

Décision finale :

> V1 officiellement française, mais strings centralisées dès Sprint 3.

Cela signifie :

- pas de switch de langue en V1 ;
- pas de traduction anglaise obligatoire ;
- interface en français ;
- mais pas de chaînes UI dispersées partout ;
- créer un fichier du type :
  - `frontend/src/i18n/fr.ts`
  - ou `frontend/src/i18n/strings.ts`

Raison : prévenir une dette i18n sans surcomplexifier la V1.

## 0.1.6 Cache Stockfish strict

Décision finale :

> Cache exact strict. Aucune comparaison silencieuse entre moteurs, profils ou formules.

Une analyse cache est réutilisable seulement si :

- même FEN ;
- même engine_hash ;
- même engine_version_string ;
- même analysis_profile compatible ;
- même multipv minimal requis ;
- quality_status ok ;
- formula_version compatible ;
- metric_version compatible.

Définition engine_hash :

```
engine_hash =
    SHA256(stockfish_binary)
    + SHA256(nnue_file_if_external)
    + version_string_reported_by_engine
```

Si NNUE intégrée au binaire : `nnue_file_hash = "embedded"`.

Si version_string absente ou ambiguë : `engine_version_string = "unknown"` et le cache doit être considéré non strictement compatible sauf override explicite debug.

Politique si Stockfish change :

- anciennes analyses marquées legacy ;
- elles peuvent être affichées comme anciennes ;
- elles ne doivent pas être mélangées à une nouvelle Review ;
- bouton "Réanalyser avec le moteur actuel" ;
- jamais de suppression automatique du cache legacy ;
- jamais de comparaison silencieuse de NeuroScore entre versions moteur différentes.

## 0.1.7 Critère de sortie V1

La V1 est considérée prête pour premiers utilisateurs externes si :

1. 3 utilisateurs externes complètent sans assistance la boucle :
   import PGN → analyze → Review → Practice → Daily Plan → révision à J+3.

2. Au moins 2 utilisateurs sur 3 reviennent le lendemain ou à J+2.

3. Aucun bug bloquant dans :
   - import ;
   - analyse ;
   - Review ;
   - Practice ;
   - sauvegarde attempts ;
   - plan du jour ;
   - export/delete.

4. Les tests critiques passent :
   - backend unit tests ;
   - frontend typecheck ;
   - frontend build ;
   - PGN import smoke ;
   - Review regression smoke ;
   - real flow smoke si disponible.

5. L'utilisateur comprend toujours la prochaine action utile.

---

# 1. THÈSE CENTRALE DU PLAN 3

NeuroChess doit être construit en couches successives.

Phrase directrice :

> On construit d'abord un coach utilisable, puis on ajoute progressivement les couches révolutionnaires.

La V1 ne doit pas contenir toute la vision. La V1 doit prouver que le cœur fonctionne :

- importer une partie ;
- analyser ;
- expliquer les moments clés ;
- faire rejouer ;
- créer une session d'entraînement ;
- enregistrer les tentatives ;
- faire revenir les positions ;
- proposer un plan court ;
- montrer une progression simple ;
- protéger les données ;
- rester stable.

La V1 doit éviter :

- Intent Layer complet ;
- Candidate Trainer ;
- LLM coach ;
- Transfer Gap visible ;
- Cognitive Map décorative ;
- Progression détaillée ;
- métriques scientifiques non calibrées visibles ;
- claims neuroscientifiques forts.

La V1 doit déjà prouver :

> Mes vraies erreurs deviennent des exercices.
> Mes tentatives sont enregistrées.
> Mes erreurs reviennent.
> Je sais quoi faire aujourd'hui.

Si cette boucle fonctionne, NeuroChess existe.

---

# 2. ARCHITECTURE TECHNIQUE CIBLE

## 2.1 Architecture globale

Frontend :

- React ;
- TypeScript ;
- Vite ;
- CSS modules ou CSS variables globales ;
- composants UI propres ;
- board chess interactif ;
- état local clair ;
- hooks dédiés ;
- polling pour jobs Review ;
- structure prête pour SSE/WebSocket futur ;
- strings centralisées en français dès Sprint 3.

Backend :

- Python ;
- FastAPI ou équivalent ;
- SQLite local-first en V1 ;
- SQLAlchemy ou couche repository propre ;
- python-chess ;
- Stockfish local ;
- job system Review ;
- cache d'analyse ;
- endpoints REST simples ;
- migration légère si nécessaire ;
- export/suppression RGPD.

Moteur :

- Stockfish local ;
- profils d'analyse versionnés ;
- cache par FEN + engine_hash + profile + formula_version ;
- jamais vérité LLM ;
- jamais sous transaction DB ;
- jamais comparaison silencieuse entre versions moteur.

Stockage :

- SQLite en V1 ;
- local-first ;
- versioning des métriques ;
- export JSON + PGN ;
- suppression complète ;
- cloud sync plus tard.

LLM :

- pas V1 core ;
- futur parser / coach ;
- jamais source de vérité échiquéenne ;
- toujours contraint par Evidence JSON et verifier ;
- aucune dépendance produit V1.

## 2.2 Frontière des responsabilités

Frontend responsable de :

- expérience utilisateur ;
- navigation ;
- board ;
- Review UI ;
- Practice UI ;
- Today page ;
- Training page ;
- Profile / Settings ;
- gestion visuelle des états ;
- appels API ;
- responsive ;
- accessibilité ;
- centralisation des textes UI.

Backend responsable de :

- vérité des données ;
- import PGN ;
- analyse moteur ;
- calculs ;
- jobs ;
- scores ;
- moments ;
- training items ;
- practice events ;
- SkillTrace shadow ;
- scheduling ;
- daily plan ;
- export/suppression ;
- cache policy ;
- telemetry locale ou event logging.

Stockfish responsable de :

- évaluation objective ;
- top moves ;
- PV ;
- WDL audit futur ;
- moteur strictement versionné.

LLM futur responsable de :

- reformulation ;
- parsing intention ;
- explication contrôlée ;
- jamais évaluation brute ;
- jamais coup inventé ;
- jamais intention inventée.

---

# 3. PRINCIPES D'INGÉNIERIE

## 3.1 Pas de feature sans contrat

Chaque fonctionnalité doit avoir :

- contrat utilisateur ;
- contrat data ;
- contrat API ;
- état vide ;
- état loading ;
- état erreur ;
- tests ;
- acceptance criteria ;
- rollback plan ;
- perf budget si pertinent.

## 3.2 Pas de métrique sans registry

Chaque métrique doit avoir :

- metric_id ;
- formula_version ;
- purpose ;
- visible_user ;
- drives_training ;
- calibration_status ;
- limitations ;
- source_semantics ;
- owner ;
- date_added.

Statuts possibles :

- external_reference ;
- heuristic_v1 ;
- shadow_v1 ;
- internal_audit ;
- calibrated_v1 ;
- research_v2 ;
- deprecated.

Règle : une métrique non calibrée peut être stockée. Elle ne doit pas être présentée comme vérité utilisateur.

## 3.3 Pas de bouton sans Action Registry

Chaque action doit avoir :

- action_id ;
- label_user ;
- screen ;
- visible_when ;
- hidden_when ;
- effect ;
- side_effects ;
- destructive or not ;
- telemetry_event ;
- confirmation_required ;
- rollback_possible.

## 3.4 Pas de refactor massif non ciblé

Interdit :

- réécrire tout App.tsx sans nécessité ;
- changer backend + frontend + DB dans le même sprint sans justification ;
- modifier formules en même temps qu'UI ;
- modifier Stockfish en même temps que Practice ;
- ajouter LLM pendant une mission Review ;
- ajouter V2 pendant sprint V1 ;
- introduire un design system complet pendant un bugfix.

Autorisé :

- refactor minimal pour accomplir le sprint ;
- extraction ciblée si elle réduit un fichier instable ;
- documentation du refactor dans le rapport.

## 3.5 Tests avant confiance

Chaque mission doit exécuter au minimum, selon disponibilité :

Backend :

```
.venv\Scripts\python.exe -m unittest discover backend/tests
```

Frontend :

```
cd frontend
node node_modules\typescript\bin\tsc --noEmit
node node_modules\vite\bin\vite.js build
```

Smokes si disponibles :

```
.venv\Scripts\python.exe scripts\review_regression_smoke.py
.venv\Scripts\python.exe scripts\pgn_import_smoke.py
.venv\Scripts\python.exe scripts\pgn_sindarov_real_flow_smoke.py
```

Si un test n'existe pas :

- ne pas inventer qu'il a été exécuté ;
- signaler `not available` ;
- proposer le test à créer si pertinent ;
- ne pas bloquer le sprint sauf si le test est explicitement requis comme acceptance criterion.

## 3.6 Budget de performance

Chaque sprint doit déclarer un perf budget mesurable. Cibles V1 par défaut :

- import PGN d'une partie normale : < 500 ms perçus ;
- import PGN long ou multi-game : < 2 s ou feedback/progression immédiat ;
- premier moment Review affiché : < 30 s après lancement analyse standard si moteur disponible et machine correcte ;
- attempt Practice → feedback : < 200 ms ;
- chargement Today : < 800 ms ;
- chargement Review déjà calculée : < 1 s ;
- transition d'écran : < 150 ms.

Si un sprint ne respecte pas le budget, soit le budget est révisé et acté dans DECISIONS_LOG, soit un sprint d'optimisation est planifié avant continuation.

## 3.7 Rollback plan

Chaque sprint doit déclarer son plan de rollback :

- branche git de référence avant sprint ;
- commit hash de l'état stable précédent ;
- procédure de revert ;
- impact sur les données utilisateur si revert (migrations, etc.) ;
- temps estimé du rollback.

---
## 3.8 Règle Codex no commit / no stage par défaut

Par défaut, Codex ne doit pas commit et ne doit pas stage.

Règles :

- toujours exécuter `git status` avant modification ;
- toujours exécuter `git status` après modification ;
- ne jamais exécuter `git add` sauf demande explicite ;
- ne jamais exécuter `git commit` sauf demande explicite ;
- si un commit est explicitement demandé, faire un seul commit avec un message clair ;
- ne jamais inclure des fichiers hors mission dans le commit ;
- rapporter les fichiers modifiés et les fichiers non suivis.

---

# 4. DATA MODEL CIBLE

## 4.1 Tables / objets V1

### users / local_profile

- id ;
- display_name ;
- initial_rating_bucket ;
- preferred_time_control ;
- onboarding_completed ;
- created_at ;
- updated_at.

### user_settings

- user_id ;
- theme ;
- density ;
- animations ;
- coach_tone ;
- help_level ;
- intent_mode ;
- show_timer ;
- stockfish_path ;
- default_analysis_profile ;
- cloud_sync_enabled ;
- research_opt_in ;
- language ;
- created_at ;
- updated_at.

Note : `language = fr` en V1. Pas de switch de langue obligatoire.

### games

- id ;
- source ;
- source_id ;
- pgn_raw ;
- white ;
- black ;
- white_rating ;
- black_rating ;
- user_color ;
- result ;
- time_control ;
- time_control_class ;
- opening_name ;
- eco ;
- created_at ;
- imported_at ;
- status ;
- duplicate_key ;
- deleted_at optional.

### moves

- id ;
- game_id ;
- ply ;
- move_number ;
- side ;
- san ;
- uci ;
- fen_before ;
- fen_after ;
- is_book ;
- created_at.

### engine_analysis

- id ;
- fen ;
- engine_version ;
- engine_version_string ;
- engine_hash ;
- nnue_hash ;
- stockfish_binary_hash ;
- analysis_profile ;
- depth ;
- nodes ;
- multipv ;
- eval_cp_white_pov ;
- mate_in ;
- wdl_w ;
- wdl_d ;
- wdl_l ;
- top_moves_json ;
- pv_json ;
- cache_key ;
- quality_status ;
- cache_validity_status ;
- formula_version ;
- metric_version ;
- legacy_flag ;
- created_at.

`cache_validity_status` values :

- strict_valid ;
- legacy_engine ;
- legacy_formula ;
- insufficient_profile ;
- insufficient_multipv ;
- stale ;
- invalid.

### review_jobs

- id ;
- game_id ;
- status ;
- progress_done ;
- progress_total ;
- current_phase ;
- started_at ;
- updated_at ;
- completed_at ;
- heartbeat_at ;
- error_message ;
- cancelled_at ;
- analysis_profile ;
- engine_hash ;
- formula_version.

### review_summaries

- id ;
- game_id ;
- user_color ;
- neuro_score ;
- reference_accuracy ;
- coach_summary ;
- primary_domain ;
- created_at ;
- formula_version ;
- engine_hash ;
- analysis_profile.

### review_moments

- id ;
- game_id ;
- ply ;
- domain ;
- primary_tag ;
- secondary_tags_json ;
- severity_label ;
- criticality_score ;
- win_loss ;
- played_move ;
- best_move ;
- fen_before ;
- fen_after ;
- explanation_short ;
- takeaway ;
- created_at.

### training_items

- id ;
- source_type ;
- source_game_id ;
- source_ply ;
- fen ;
- side_to_move ;
- best_move ;
- accepted_moves_json ;
- domain ;
- primary_tag ;
- secondary_tags_json ;
- difficulty_proxy ;
- criticality_score ;
- created_at ;
- status.

### practice_sessions

- id ;
- user_id ;
- source_type ;
- status ;
- started_at ;
- completed_at ;
- current_index ;
- total_items ;
- theme ;
- created_at.

### practice_session_items

- id ;
- session_id ;
- item_id ;
- order_index ;
- status ;
- last_result.

### practice_attempts

- id ;
- session_id ;
- item_id ;
- attempt_number ;
- move_played ;
- result ;
- time_spent_ms ;
- hint_used ;
- reveal_used ;
- skipped ;
- created_at.

### skilltrace_states (shadow V1)

- id ;
- user_id ;
- tag ;
- alpha ;
- beta ;
- shadow_mode_flag ;
- last_recommendation_logged ;
- updated_at.

### review_queue / spaced_repetition_queue

- id ;
- user_id ;
- item_id ;
- due_at ;
- interval_days ;
- last_result ;
- repetitions ;
- stability_proxy ;
- difficulty_proxy ;
- created_at ;
- updated_at.

### daily_plan_items

- id ;
- user_id ;
- plan_date ;
- item_id ;
- order_index ;
- selection_reason ;
- selection_score ;
- source_bucket ;
- created_at.

source_bucket values :

- due ;
- failed_recent ;
- recent_critical ;
- diversity_fill ;
- manual.

selection_score en V1 : debug/internal only.

### domain_signals

- id ;
- user_id ;
- domain ;
- state ;
- signal_strength ;
- evidence_json ;
- updated_at ;
- version.

### telemetry_events

- id ;
- user_id ;
- event_name ;
- payload_json ;
- session_id ;
- created_at.

## 4.2 Tables V2

### intent_events

- id ;
- user_id ;
- game_id ;
- ply ;
- fen_before ;
- move_played ;
- capture_timing ;
- prompt_type ;
- user_text ;
- quick_choice_response ;
- self_confidence ;
- candidate_moves_declared ;
- expected_opponent_reply ;
- claimed_opening ;
- claimed_goal ;
- claimed_plan ;
- non_response_reason ;
- vague_response_type ;
- parse_confidence ;
- bias_risk ;
- usability_for_metrics ;
- extracted_json ;
- source_spans_json ;
- parser_version ;
- is_inference_flags_json ;
- intent_alignment_category ;
- candidate_signal ;
- opening_awareness_signal ;
- metacognitive_signal ;
- privacy_level ;
- cloud_allowed ;
- research_opt_in ;
- deletable ;
- created_at.

### candidate_sessions

- id ;
- user_id ;
- source_item_id ;
- status ;
- created_at.

### candidate_attempts

- id ;
- candidate_session_id ;
- fen ;
- candidate_moves_json ;
- preferred_move ;
- confidence ;
- expected_reply ;
- result_category ;
- created_at.

### llm_explanations

- id ;
- evidence_hash ;
- model_provider ;
- model_name ;
- verifier_status ;
- explanation_text ;
- created_at.

### validation_events

- id ;
- user_id ;
- event_type ;
- payload_json ;
- created_at.

---

# 5. API CONTRACTS V1

## 5.1 Games

### GET /api/games

Retour :

- games list ;
- status ;
- neuro_score si existe ;
- review_status ;
- training_available.

### POST /api/games/import/pgn

Input :

- pgn_raw ;
- source optionnel.

Retour :

- created games ;
- invalid games ;
- warnings.

### POST /api/games/{game_id}/analyze

Input :

- profile : standard / deep.

Retour : job_id.

### GET /api/games/{game_id}

Retour :

- metadata ;
- moves ;
- review status.

### DELETE /api/games/{game_id}

Destructif, confirmation frontend.

## 5.2 Review

### GET /api/review/jobs/{job_id}

Retour :

- status ;
- progress ;
- phase ;
- error.

### GET /api/games/{game_id}/review

Retour :

- summary ;
- moments ;
- scores ;
- training_items_available.

### POST /api/games/{game_id}/review/reconcile

Répare job bloqué ou états inconsistants.

### POST /api/games/{game_id}/review/recompute

Advanced only.

## 5.3 Practice

### POST /api/practice/sessions

Input :

- source_game_id optionnel ;
- source_review_id optionnel ;
- mode : review / due / failed / plan ;
- max_items.

Retour :

- session_id ;
- first_item.

### GET /api/practice/sessions/{session_id}

Retour :

- session ;
- items ;
- current item.

### POST /api/practice/sessions/{session_id}/attempt

Input :

- item_id ;
- move_played ;
- time_spent_ms ;
- hint_used ;
- reveal_used.

Retour :

- result ;
- feedback ;
- next state.

### POST /api/practice/sessions/{session_id}/skip
### POST /api/practice/sessions/{session_id}/reveal
### POST /api/practice/sessions/{session_id}/complete
### POST /api/practice/sessions/{session_id}/retry-failed

## 5.4 Today

### GET /api/today

Retour :

- hero_state ;
- primary_action ;
- secondary_cards ;
- progress_card ;
- due_count ;
- latest_review ;
- active_session.

## 5.5 Training

### GET /api/training

Retour :

- daily_plan_card ;
- failed_items_card ;
- due_reviews_card ;
- counts ;
- current_active_session if exists.

### POST /api/training/daily-plan

Crée ou récupère le plan du jour.

Input :

- max_items optional ;
- duration_preference optional.

Retour :

- plan_id ;
- items ;
- estimated_duration ;
- selection_reasons.

### GET /api/training/daily-plan/today

Retour :

- existing daily plan if already generated ;
- empty state if not enough items.

## 5.6 Settings / Privacy

### GET /api/settings
### PATCH /api/settings
### GET /api/export
### DELETE /api/user-data

## 5.7 Engine

### GET /api/engine/status
### POST /api/engine/test
### PATCH /api/engine/settings

---

# 6. PIPELINE PGN → REVIEW → TRAINING

## 6.1 Import PGN

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

États erreur :

- PGN invalide ;
- coups illégaux ;
- partie trop courte ;
- metadata manquante.

## 6.2 Analyse Review

Étapes :

1. créer review_job ;
2. déterminer positions à analyser ;
3. vérifier cache strict (engine_hash + profile + formula_version) ;
4. analyser positions manquantes ;
5. stocker engine_analysis ;
6. calculer white_percent ;
7. calculer player_win_percent ;
8. calculer win_loss ;
9. calculer move_accuracy ;
10. calculer game_accuracy ;
11. calculer neuro_score_diag ;
12. calculer coach_neuro_score ;
13. calculer criticality_score ;
14. appliquer temporal NMS ;
15. tagger moments avec taxonomy_v0 ;
16. générer review_summary ;
17. générer review_moments ;
18. générer training_items ;
19. marquer job completed.

## 6.3 Génération des moments

Pour chaque coup du joueur :

- récupérer P_before ;
- récupérer P_after ;
- calculer win_loss ;
- ignorer win_loss insignifiant sauf cas spécial ;
- calculer criticality ;
- déterminer domaine ;
- déterminer tag ;
- déterminer explanation_short ;
- déterminer takeaway.

Sélection finale :

- trier par criticality ;
- appliquer temporal NMS ;
- max 3 moments principaux pour Review Résumé ;
- max 5 training items pour session Review.

## 6.4 Génération Practice Items

Pour chaque review_moment sélectionné, créer un training_item :

- fen_before ;
- best_move ;
- accepted_moves ;
- domain ;
- tag ;
- difficulty_proxy ;
- criticality_score ;
- source_game_id ;
- source_ply.

Accepted moves V1 :

- best move ;
- very good top moves si win_loss vs best inférieur seuil ;
- ne jamais appeler Stockfish pendant Practice V1.

---

# 7. JOB SYSTEM

## 7.1 États review_job

- pending ;
- running ;
- finalizing ;
- completed ;
- failed ;
- cancelled ;
- stalled.

## 7.2 Règles

- pending : job créé, pas encore démarré ;
- running : analyse en cours, heartbeat mis à jour ;
- finalizing : analyses terminées, génération Review ;
- completed : Review disponible ;
- failed : erreur réelle ;
- cancelled : annulé utilisateur ;
- stalled : heartbeat absent trop longtemps.

## 7.3 Heartbeat

Chaque job running doit mettre à jour heartbeat_at.

Stalled detection : si `now - heartbeat_at > seuil dynamique`.

Seuil : doit dépendre du nombre de positions et du profil.

## 7.4 Reconcile

POST reconcile doit :

- vérifier analyses manquantes ;
- vérifier job status ;
- finaliser si tout est prêt ;
- remettre failed/stalled si état incohérent ;
- ne pas lancer Stockfish sous transaction.

## 7.5 Cache quality gate

Une analyse cache est utilisable seulement si :

- même fen ;
- même engine_hash ;
- même engine_version_string ;
- analysis_profile >= required profile ;
- multipv suffisant ;
- quality_status ok ;
- formula_version compatible ;
- metric_version compatible ;
- legacy_flag = false.

Sinon : réanalyse, ou marquage legacy + bouton "Réanalyser avec moteur actuel".

---

# 8. STOCKFISH COST POLICY

## 8.1 Profils d'analyse

### live

- faible coût ;
- MultiPV 1 ;
- time court ;
- non utilisé pour Review finale.

### standard_review

- coût modéré ;
- MultiPV 3 ;
- temps par position raisonnable ;
- V1 par défaut.

### deep_review

- opt-in ;
- payant/futur ;
- MultiPV 3–5 ;
- temps plus long.

### foundations

- faible profondeur ;
- focus attaques/défenses simples.

## 8.2 Analyse adaptative

Ne pas analyser toutes les positions en deep.

Stratégie :

1. analyse standard ou shallow globale ;
2. détecter positions candidates ;
3. approfondir seulement :
   - gros win_loss ;
   - bascule de zone ;
   - sortie d'ouverture ;
   - position gagnante relâchée ;
   - ressource défensive ;
   - top moments.

## 8.3 Formule de coût

```
daily_engine_cost =
    active_users
    × games_per_user_per_day
    × analyzed_positions_per_game
    × avg_seconds_per_position
    × cost_per_engine_second
```

## 8.4 Quotas futurs

Gratuit :

- nombre de reviews/mois limité ;
- standard uniquement.

Premium :

- plus de reviews ;
- deep limité.

Pro :

- deep plus large ;
- batch analysis.

V1 locale : coût surtout temps machine utilisateur.

---

# 9. FRONTEND ARCHITECTURE

## 9.1 Pages V1

- TodayPage ;
- GamesPage ;
- TrainingPage ;
- ReviewPage ;
- PracticeSessionPage ;
- ProfileSettingsPage.

Pas de ProgressionPage racine V1. Progression détaillée peut être route secondaire `/progression` mais pas dans la nav principale.

## 9.2 Routes

- /app/today ;
- /app/games ;
- /app/games/:id ;
- /app/games/:id/review ;
- /app/training ;
- /app/practice/:sessionId ;
- /app/profile ;
- /app/settings.

## 9.3 Composants principaux

- AppShell ;
- HeaderNav ;
- PrimaryCTA ;
- StatusBanner ;
- ProgressCard ;
- TodayHero ;
- TodayProgressCard ;
- GameCard ;
- GamesFilterBar ;
- ReviewLayout ;
- ChessBoardPanel ;
- ReviewSummaryPanel ;
- ReviewQuickRead ;
- ReviewLesson ;
- ReviewTrainingCTA ;
- ReviewExplorer ;
- PracticeFocusShell ;
- PracticeBoard ;
- PracticeCorrectionPanel ;
- SessionSummary ;
- TrainingHome ;
- TrainingPlanCard ;
- TrainingDueCard ;
- SettingsPanel.

CognitiveMap / NeuroMonitor : V1.1.

## 9.4 State management

V1 possible : React state + custom hooks.

Hooks :

- useToday() ;
- useGames() ;
- useReview(gameId) ;
- useReviewJob(jobId) ;
- usePracticeSession(sessionId) ;
- useSettings() ;
- useEngineStatus().

Polling : review job status toutes les 1–2s pendant running.

Future : SSE / WebSocket.

## 9.5 Loading UI

Jamais spinner seul.

Utiliser :

- skeleton cards ;
- progress text ;
- phase label ;
- action possible.

Exemple :

> Analyse en cours — 34 / 78 positions
> Tu peux continuer pendant l'analyse.

---

# 10. TODAY PAGE IMPLEMENTATION

Input : `GET /api/today`

Frontend détermine hero_state et secondary_cards.

Hero states :

- active_session ;
- daily_plan ;
- review_ready ;
- analysis_running ;
- due_reviews ;
- profile_building ;
- plan_done ;
- empty.

Chaque hero a :

- title ;
- body ;
- primary_label ;
- primary_action ;
- secondary_label optionnel ;
- secondary_action optionnel.

Test : si plusieurs états, priority order strict.

Acceptance criteria :

- un seul Hero visible ;
- CTA clair ;
- aucune confusion ;
- pas plus de 2 cartes secondaires ;
- responsive mobile.

---

# 11. REVIEW UI IMPLEMENTATION

## 11.1 Review Summary

Affiche :

- NeuroScore coach ;
- phrase principale ;
- détail score replié ;
- choix Lecture rapide / Leçon complète ;
- 3 moments clés ;
- CTA entraînement ;
- Explorer replié.

Ne pas afficher :

- diagnostic_gap ;
- raw criticality ;
- ETV ;
- posterior ;
- debug.

## 11.2 Lecture rapide

Affiche 3 moments en lecture :

- coup joué ;
- meilleur coup ;
- phrase courte.

Fin :

- M'entraîner maintenant ;
- Me le rappeler demain ;
- Terminer.

## 11.3 Leçon complète

États :

- challenge ;
- attempted ;
- reflection_pause ;
- correction ;
- training_prompt.

## 11.4 Micro-pause

Si attempt wrong :

- attendre 2–3s ;
- message : "Observe ce que ton coup permet à l'adversaire." ;
- puis afficher correction.

## 11.5 Explorer

Replié par défaut.

Contient :

- all moves ;
- filters ;
- PV ;
- raw-ish details ;
- opening details ;
- technical accordions ;
- debug only if enabled.

---

# 12. PRACTICE IMPLEMENTATION

## 12.1 Focus mode

- Hide main nav ;
- Show progress ;
- Show board ;
- Show instruction.

## 12.2 Attempt flow

Initial : `waiting_for_move`.

On move : submit attempt.

If correct : show success correction.

If wrong : show reflection_pause puis correction.

## 12.3 Hints

hint_level 0–3.

- Hint 1 : général ;
- Hint 2 : plus orienté ;
- Hint 3 : presque solution.

After hint 3 : show reveal option.

## 12.4 Completion

At end : show session summary.

Update :

- practice_attempts ;
- skilltrace (shadow) ;
- spaced repetition queue.

---

# 13. TRAINING ENGINE V1

## 13.1 Training sources

- review moments ;
- failed practice items ;
- due review items.

## 13.2 Plan du jour V1

Inputs :

- due items ;
- recent review items ;
- failed items ;
- domain priority déterministe ;
- time budget.

Output :

- 5–6 items ;
- 8–12 minutes.

Selection heuristic V1 (déterministe, sans SkillTrace) :

1. due items first ;
2. recent high criticality ;
3. failed items ;
4. avoid same tag too many times.

SkillTrace observe en parallèle mais n'influence pas le plan en V1.

## 13.3 ETV V1

```
ETV = w1 × criticality
    + w2 × difficulty_fit
    - w3 × redundancy_penalty
```

V1 weights : constantes config (statut `heuristic_v1`).

Valeurs par défaut V1 indicatives :

- w1 = 1.0 ;
- w2 = 0.5 ;
- w3 = 0.7.

À calibrer en V1.1. Ne pas exposer ETV à l'utilisateur.

## 13.4 simple_spaced_repetition_v1

Schedule rules :

- wrong : due tomorrow ;
- hint_success : due in 3 days ;
- success_no_hint : due in 7 days ;
- repeated_success : interval × 1.7 (plafond 30 jours) ;
- repeated_failure : reset à 1 jour ;
- reveal : due tomorrow ou 2 jours max ;
- skipped : no-op.

---

# 14. SKILLTRACE BETA SHADOW IMPLEMENTATION

For each practice_attempt :

- determine tag ;
- load skilltrace_state ;
- update alpha/beta ;
- log recommended_next_tag (shadow) ;
- save.

Update rules (heuristiques V1, non calibrées) :

- best without hint : alpha += 1.0 ;
- very_good : alpha += 0.8 ;
- acceptable : alpha += 0.4, beta += 0.2 ;
- success with hint : alpha += 0.5, beta += 0.3 ;
- wrong : beta += 1.0 ;
- revealed : beta += 0.7 ;
- skipped : beta += 0.3 ou no-op.

UI V1 :

- ne pas exposer mastery numérique ;
- ne pas afficher de score de domaine ;
- ne pas générer de claim "vous progressez en X de Y%".

Usage V1 :

- état shadow ;
- préparation calibration V1.1 ;
- aucune influence forte sur le Daily Plan.

Condition de sortie shadow → actif : voir 0.1.2.

---

# 15. NEUROMONITOR / COGNITIVE MAP — V1.1 (HORS V1)

V1 affiche uniquement :

- carte "Cette semaine" ;
- ratios simples ;
- domaine prioritaire prudent si seuils atteints ;
- sinon "Profil en construction".

V1.1 ajoutera CognitiveMap :

- 5 domaines : Opening, Tactics, Calculation, Conversion, Defense ;
- 4 états : en_construction, solide, a_surveiller, prioritaire ;
- état additionnel : en_progression ;
- état spécial : a_mesurer (pour Calcul si Candidate Trainer inactif) ;
- pas de décoration faux-cerveau ;
- pas de 3D ;
- preuve associée à chaque domaine ;
- pas de pourcentage non calibré.

Heuristique domaine (V1.1) :

```
domain_pressure =
    0.50 × normalized_recent_criticality
    + 0.30 × practice_failure_signal
    + 0.20 × frequency_signal
```

- sample insuffisant : en_construction ;
- calculation sans Candidate Trainer : a_mesurer ;
- pression haute (≥ 0.6) : prioritaire ;
- pression modérée (≥ 0.3) : a_surveiller ;
- sinon : solide ;
- amélioration récente : en_progression.

---

# 16. PRIVACY / RGPD IMPLEMENTATION V1

V1 doit inclure :

- export data ;
- delete data ;
- local storage clarity ;
- privacy settings ;
- pas de collecte recherche cachée.

Export format : JSON + PGN.

Delete : delete games, moves, analyses, reviews, practice sessions, attempts, skilltrace, telemetry.

Si intent data future : delete intent_events et inférences dérivées.

---

# 17. SETTINGS IMPLEMENTATION

Sections V1 :

### Profile

- display name ;
- rating bucket.

### Appearance

- theme ;
- density ;
- animations.

### Coach

- help level ;
- tone ;
- session duration.

### Engine

- stockfish path ;
- test engine ;
- analysis profile.

### Privacy

- export ;
- delete ;
- research opt-in (futur).

### Debug

- caché derrière dev toggle.

---

# 18. TELEMETRY V1

Catalog minimal de 14 événements V1 :

- pgn_import_started ;
- pgn_import_completed ;
- review_started ;
- review_quick_read_completed ;
- lesson_started ;
- practice_started ;
- practice_attempt_submitted ;
- hint_used ;
- solution_revealed ;
- practice_completed ;
- daily_plan_started ;
- daily_plan_completed ;
- export_data_clicked ;
- delete_data_clicked.

Stockage : table `telemetry_events` locale.

Pas d'usine analytics V1. Pas d'envoi cloud par défaut.

KPI produit V1 minimum :

- taux d'import → review complétée ;
- taux de Review → Practice ;
- taux de Practice complétée ;
- retour J+1 ;
- retour J+3.

---

# 19. TESTING STRATEGY

## 19.1 Unit tests formules

Test :

- white_percent ;
- player_win_percent ;
- win_loss ;
- move_accuracy ;
- coach_neuro_score ;
- criticality_score ;
- temporal_nms ;
- SkillTrace update ;
- simple_spaced_repetition_v1 schedule.

## 19.2 Backend tests

PGN import :

- valid pgn ;
- invalid pgn ;
- duplicate ;
- multiple games.

Review :

- job lifecycle ;
- cache hit ;
- cache miss ;
- failed engine ;
- partial analysis ;
- stalled reconcile ;
- legacy cache marquage.

Practice :

- create session ;
- attempt correct ;
- attempt wrong ;
- hint ;
- reveal ;
- retry failed ;
- complete.

Settings :

- export ;
- delete.

## 19.3 Frontend tests

Tests composants si disponibles.

Today :

- one hero only ;
- priority order ;
- CTA correct.

Review :

- NeuroScore visible ;
- reference accuracy hidden in details ;
- quick read available ;
- lesson complete available ;
- Explorer collapsed.

Practice :

- focus mode hides nav ;
- no timer default ;
- correction after attempt ;
- micro-pause exists.

## 19.4 Smoke tests

- review_regression_smoke ;
- pgn_import_smoke ;
- real_flow_smoke.

## 19.5 Browser QA manual

Critical flows :

1. Import PGN → analyze → Review ;
2. Review quick read ;
3. Review lesson complete ;
4. Start Practice ;
5. Wrong attempt → micro-pause → correction ;
6. Complete session ;
7. Today updates ;
8. Daily Plan affiché ;
9. Export data ;
10. Delete test data.

---

# 20. DOCUMENTATION REQUIRED

Pack de gouvernance Sprint 0 bis (obligatoire avant Sprint 1) :

- PLAN_3_SUMMARY.md ;
- CURRENT_SPRINT.md ;
- RISK_REGISTER.md ;
- DECISIONS_LOG.md.

Docs core :

- README.md ;
- PROJECT_STATE.md ;
- ARCHITECTURE.md ;
- API_CONTRACTS.md ;
- DB_SCHEMA.md ;
- FORMULAS_AND_METRICS.md ;
- METRIC_REGISTRY.md ;
- ACTION_REGISTRY.md ;
- SCREEN_CONTRACTS.md ;
- ENGINE_COST_POLICY.md ;
- ENGINE_CACHE_POLICY.md ;
- ANNOTATION_PROTOCOL.md ;
- VALIDATION_FRAMEWORK.md ;
- DATA_PRIVACY_AND_INTENT_DPIA.md ;
- QA_CHECKLIST.md ;
- ROADMAP.md ;
- TELEMETRY_CATALOG.md.

Règle : les docs doivent refléter le code. Si le code change le comportement, la doc se met à jour dans le même sprint.

---

# 21. ROADMAP V1

Objectif V1 : a stable coach loop.

V1 inclut :

- onboarding 2 écrans ;
- Today ;
- Games ;
- PGN import ;
- Review summary ;
- Quick Read ;
- Lesson Complete ;
- Practice linear sessions ;
- practice_result_event ;
- SkillTrace shadow ;
- simple_spaced_repetition_v1 ;
- Training Plan V1 déterministe ;
- progression compacte (pas CognitiveMap) ;
- profile/settings ;
- export/delete ;
- engine config ;
- degraded states ;
- emotional tone ;
- telemetry locale 14 events ;
- tests.

V1 exclut :

- full Intent Layer ;
- Candidate Trainer ;
- LLM coach ;
- Transfer Gap display ;
- full Progression page ;
- CognitiveMap visuelle ;
- SkillTrace prescriptif ;
- Foundations ;
- social ;
- club/coach ;
- 3D monitor ;
- full cloud sync.

---

# 22. ROADMAP V1.1

V1.1 ajoute :

- SkillTrace utilisé prudemment dans Daily Plan (après condition de sortie) ;
- CognitiveMap compact (5 domaines, 4 états + en_progression) ;
- ETV calibré v1 ;
- premiers tests utilisateurs élargis ;
- ajustement intervalles répétition espacée selon données.

---

# 23. ROADMAP V2

V2 ajoute :

- Intent Layer opt-in ;
- Candidate Trainer ;
- Progression détaillée ;
- NeuroMonitor détaillé ;
- Lichess API ;
- Chess.com API ;
- motif-based repetition ;
- external reference items ;
- notifications ;
- freemium ;
- sharing Review ;
- validation instrumentation ;
- LLM verifier infrastructure.

---

# 24. ROADMAP V3

V3 ajoute :

- LLM coach verified ;
- Transfer Gap visible ;
- BKT/MIRT deeper models ;
- contextual bandits ;
- Foundations ;
- Advanced Audit ;
- club/coach mode ;
- mobile premium ;
- offline complete ;
- accessibility advanced ;
- scientific validation publiée.

---

# 25. CODEX SPRINT CATALOGUE

Chaque sprint = une mission. Ne pas lancer plusieurs prompts en parallèle.

## SPRINT 0 — BASELINE / FREEZE

ID : `V5.5.BASELINE-LOCK-1`

Goal : freeze current state, record tests, no feature.

Tasks :

- git status ;
- run backend tests ;
- run tsc/build ;
- run smokes ;
- document current working state.

Acceptance criteria :

1. PROJECT_STATE.md updated or created.
2. Test commands executed or marked unavailable.
3. Current failures documented.
4. No feature code changed.
5. No formatting/refactor unrelated.
6. No commit/stage by default.
7. Git status before/after included in report.

## SPRINT 0 BIS — EXECUTION LOCK (GOUVERNANCE)

ID : `V5.5.EXECUTION-LOCK-1`

Goal : créer le pack de gouvernance et figer les décisions doctrinales avant tout code applicatif.

Livrables obligatoires :

- PLAN_3_SUMMARY.md (1 page max) ;
- CURRENT_SPRINT.md (Sprint 1 détaillé) ;
- RISK_REGISTER.md (5 risques minimum) ;
- DECISIONS_LOG.md (avec les décisions actées : fr-only, Cognitive Map V1.1, SkillTrace shadow, simple_spaced_repetition_v1 + multiplicateur 1.7 + plafond 30j, cache strict, seuil corrélation SkillTrace 0.60, seuils domaine prioritaire 5/30/2/5, perf budgets V1) ;
- ENGINE_CACHE_POLICY.md (règles cache strict + définition engine_hash) ;
- TELEMETRY_CATALOG.md (14 events V1) ;
- METRIC_REGISTRY.md (squelette + métriques connues) ;
- ACTION_REGISTRY.md (squelette).

Acceptance criteria :

- les 8 fichiers existent et sont relus ;
- DECISIONS_LOG contient au minimum 5 décisions actées avec date et justification ;
- RISK_REGISTER contient 5 risques avec mitigation ;
- aucune ligne de code applicatif modifiée ;
- no commit by default ;
- if user explicitly asks for a commit, use one commit only : `[GOVERNANCE] Sprint 0bis: Execution Lock`.

Exclusions :

- aucun changement frontend/backend hors documentation ;
- aucune migration DB ;
- aucun ajout de dépendance.

## SPRINT 1 — BOARD UX

ID : `V5.5.PLAY-BOARD-UX-1`

Goal : click-to-move, legal highlights, drag preview, turn indicator.

Acceptance criteria détaillés :

- clic sur une pièce alliée sélectionne la pièce et affiche les cases légales ;
- clic sur case légale joue le coup ;
- clic sur case illégale ne joue rien et ne déclenche pas de toast agressif ;
- second clic sur la même pièce désélectionne ;
- drag : pièce visible pendant le drag ;
- drag annulé : pièce retourne à sa case ;
- turn indicator visible à tout moment ;
- pas de régression Review / Practice ;
- frontend build OK ;
- typecheck OK.

Perf budget :

- réaction au clic : < 50 ms ;
- mise à jour highlights : < 30 ms.

Rollback : revert vers commit Sprint 0.

Exclusions : pas d'engine, pas de review, pas de formules.

## SPRINT 2 — SCORE ALIGN

ID : `V5.5.REVIEW-SCORE-ALIGN-1`

Goal : NeuroScore coach visible, reference accuracy cachée dans les détails.

Includes :

- coach_neuro_score_v1 ;
- pas de diagnostic_gap dans l'UI principale ;
- detail accordion replié par défaut.

Acceptance criteria :

- NeuroScore visible en Review summary ;
- reference accuracy disponible mais derrière "Détails" ;
- pas de double affichage ;
- pas d'incohérence entre summary et explorer.

Exclusions : refonte de formule, modification Stockfish.

## SPRINT 3 — APP SHELL / NAV

ID : `V5.5.APP-SHELL-1`

Goal : navigation Aujourd'hui / Mes parties / Entraînement + Profile icon.

Includes :

- routes ;
- header ;
- layout ;
- design tokens ;
- création `frontend/src/i18n/fr.ts` (ou strings.ts) avec premières chaînes UI centralisées.

Acceptance criteria :

- 3 onglets principaux + Profile ;
- état actif visible ;
- responsive mobile ;
- aucune chaîne UI nouvelle hors fichier i18n ;
- transition d'écran < 150 ms.

## SPRINT 4 — TODAY PAGE

ID : `V5.5.TODAY-1`

Goal : Aujourd'hui avec hero priority.

Includes :

- GET /api/today ;
- hero states ;
- progress compact ;
- active session ;
- latest review.

Acceptance criteria :

- un seul Hero visible à la fois ;
- priority order strict implémenté ;
- pas plus de 2 cartes secondaires ;
- chargement < 800 ms.

## SPRINT 5 — GAMES PAGE

ID : `V5.5.GAMES-1`

Goal : Mes parties propre.

Includes :

- list ;
- import ;
- filters ;
- card states ;
- actions.

Acceptance criteria :

- import PGN d'une partie normale < 500 ms perçus ;
- import PGN long/multi-game < 2 s ou feedback immédiat ;
- déduplication fonctionne ;
- filtres opérationnels ;
- état vide géré.

## SPRINT 6 — REVIEW FLOW

ID : `V5.5.REVIEW-FLOW-1`

Goal : Review comme parcours guidé.

Includes :

- Summary ;
- Quick Read ;
- Lesson Complete ;
- Explorer replié ;
- pas de quatre tabs égales.

Acceptance criteria :

- 3 moments principaux maximum dans Summary ;
- Quick Read fonctionne en lecture seule ;
- Lesson Complete a tous ses états (challenge → attempted → reflection_pause → correction → training_prompt) ;
- micro-pause de 2–3 s implémentée ;
- Explorer replié par défaut.

## SPRINT 7 — PRACTICE FOCUS

ID : `V5.5.PRACTICE-FOCUS-1`

Goal : Practice focus mode avec discipline charge cognitive.

Includes :

- hide nav ;
- no timer default ;
- micro-pause ;
- correction ;
- session summary.

Acceptance criteria :

- nav masquée pendant session ;
- pas de timer affiché par défaut ;
- micro-pause après wrong ;
- session summary affichée à la fin ;
- attempt → feedback < 200 ms.

## SPRINT 8 — TRAINING ITEM ENGINE

ID : `V6.TRAINING-ITEM-ENGINE-1`

Goal : générer training_items à partir des review_moments.

Includes :

- item schema ;
- accepted moves ;
- source links ;
- tags.

Acceptance criteria :

- max 5 items générés par Review ;
- accepted moves correctement extraits ;
- source_game_id et source_ply liés ;
- tests unitaires couvrent la génération.

## SPRINT 9 — PRACTICE EVENTS

ID : `V6.PRACTICE-EVENTS-1`

Goal : practice_result_event riche.

Includes :

- time_spent ;
- hint_used ;
- reveal_used ;
- attempt_number ;
- result.

Acceptance criteria :

- chaque attempt génère un event complet ;
- stockage en DB ;
- export RGPD inclut les events.

## SPRINT 10 — SKILLTRACE BETA SHADOW

ID : `V6.SKILLTRACE-BETA-1`

Goal : implémenter alpha/beta par tag en shadow mode.

Includes :

- update rules ;
- storage ;
- shadow recommendation logging ;
- tests.

Acceptance criteria :

- alpha/beta mis à jour après chaque attempt ;
- recommendation loggée mais non utilisée par Daily Plan ;
- pas d'affichage utilisateur ;
- tests couvrent les règles d'update.

Exclusions : pas d'influence sur Daily Plan, pas d'UI.

## SPRINT 11 — SIMPLE SPACED REPETITION V1

ID : `V6.SRS-V1-1`

Goal : file de répétition espacée simple.

Includes :

- wrong tomorrow ;
- hint 3 days ;
- success 7 days ;
- multiplier 1.7 ;
- plafond 30 jours ;
- due sessions.

Acceptance criteria :

- intervalles correctement appliqués ;
- multiplicateur fonctionne ;
- plafond respecté ;
- file `due` correctement remontée à Today.

## SPRINT 12 — DAILY PLAN V1

ID : `V6.DAILY-PLAN-1`

Goal : Plan du jour déterministe.

Includes :

- due items ;
- recent critical items ;
- failed items ;
- redundancy penalty ;
- intégration Today.

Acceptance criteria :

- 5–6 items par plan ;
- 8–12 minutes estimées ;
- diversité tags respectée ;
- déterministe (mêmes inputs → même output) ;
- SkillTrace observe sans influencer.

## SPRINT 13 — PROGRESSION COMPACTE V1

ID : `V6.PROGRESSION-COMPACT-1`

Goal : carte "Cette semaine" + domaine prioritaire prudent.

Includes :

- ratios simples ;
- activité ;
- seuils de données respectés ;
- message "profil en construction" si seuils non atteints.

Acceptance criteria :

- domaine prioritaire affiché seulement si seuils 5/30/2/5 atteints ;
- sinon message "profil en construction" ;
- pas de Cognitive Map visuelle ;
- pas de pourcentage non calibré.

Exclusions : pas de NeuroMonitor, pas de 5 sphères.

## SPRINT 14 — PROFILE / PRIVACY

ID : `V6.PROFILE-PRIVACY-1`

Goal : settings, export, delete.

Includes :

- profile ;
- appearance ;
- engine settings ;
- export JSON/PGN ;
- delete data.

Acceptance criteria :

- export complet (games, moves, analyses, reviews, practice, telemetry) ;
- delete complet et confirmé ;
- pas de données résiduelles après delete ;
- engine test fonctionne.

## SPRINT 15 — QA RELEASE CANDIDATE

ID : `V6.RC-QA-1`

Goal : stabiliser V1 candidate.

Includes :

- browser QA ;
- smoke tests ;
- bugfix only ;
- docs update ;
- vérification critère de sortie V1.

Acceptance criteria :

- 3 utilisateurs externes complètent la boucle sans assistance ;
- 2 sur 3 reviennent à J+1 ou J+2 ;
- aucun bug bloquant ;
- tous les smoke tests passent ;
- docs à jour.

---

# 26. DEFINITION OF DONE PER SPRINT

Chaque sprint doit produire un rapport :

- mission name ;
- files modified ;
- user-visible changes ;
- backend changes ;
- frontend changes ;
- data model changes ;
- tests added ;
- tests run ;
- résultats ;
- screenshots si UI ;
- perf mesurée vs budget ;
- known risks ;
- next recommended sprint ;
- rollback plan exécuté ou non ;
- confirmation des exclusions.

Confirmations standard :

- pas de changement Stockfish sauf prévu ;
- pas de changement de formule sauf prévu ;
- pas de LLM ;
- pas de feature V2 ;
- pas de refactor non lié ;
- pas de migration sauf prévue ;
- responsive mobile vérifié si UI.

---

# 27. WHAT NOT TO BUILD NOW

Ne pas construire maintenant :

- full Intent Layer ;
- Candidate Trainer complet ;
- LLM coach ;
- 3D brain / cerveau décoratif ;
- Transfer Gap dashboard ;
- social features ;
- coach/club ;
- Foundations complet ;
- full mobile premium ;
- cloud sync ;
- contextual bandits ;
- BKT/MIRT complet ;
- exact FSRS ;
- Syzygy trainer ;
- Role reversal ;
- PV Contrast Quiz comme mode ;
- Cognitive Map visuelle V1 ;
- SkillTrace prescriptif V1 ;
- métriques scientifiques calibrées V1.

---

# 28. FIRST PRACTICAL NEXT STEP

La prochaine étape technique n'est pas un autre document concept.

Séquence immédiate recommandée :

1. Sprint 0 — Baseline lock ;
2. **Sprint 0 bis — Execution Lock (gouvernance)** ;
3. Sprint 1 — Board UX fix ;
4. Sprint 2 — Score align ;
5. Sprint 3 — App shell + i18n centralisé ;
6. Sprint 4 — Today prototype ;
7. Sprint 5 — Games page ;
8. Sprint 6 — Review flow ;
9. Sprint 7 — Practice focus ;
10. Sprint 8 — Training Item Engine ;
11. Sprint 9 — Practice Events ;
12. Sprint 10 — SkillTrace shadow ;
13. Sprint 11 — Simple spaced repetition ;
14. Sprint 12 — Daily Plan déterministe ;
15. Sprint 13 — Progression compacte ;
16. Sprint 14 — Profile / Privacy ;
17. Sprint 15 — QA release candidate.

Pourquoi cet ordre :

- Baseline fige le point de départ ;
- Execution Lock fige les décisions doctrinales ;
- Board UX corrige la friction immédiate ;
- Score align rétablit la confiance ;
- App shell aligne Plan 2 ;
- Today crée la boucle d'habitude centrale ;
- Review livre la promesse produit ;
- Practice livre l'apprentissage ;
- Training engine ferme la boucle ;
- SkillTrace prépare la calibration ;
- Spaced repetition fait revenir les positions ;
- Daily Plan oriente l'utilisateur ;
- Progression montre l'évolution ;
- Privacy protège l'utilisateur ;
- QA valide la V1.

---

# 29. RISK REGISTER (TOP 5)

À détailler dans RISK_REGISTER.md, mais 5 risques majeurs identifiés :

### Risque 1 — Scope creep V2 dans V1

Probabilité : haute. Impact : critique.
Mitigation : section 27 affichée dans CURRENT_SPRINT.md, revue à chaque sprint.

### Risque 2 — Instabilité Stockfish / cache invalidé

Probabilité : moyenne. Impact : élevé.
Mitigation : engine_hash strict, marquage legacy, bouton réanalyser, jamais de comparaison silencieuse.

### Risque 3 — Métriques heuristiques perçues comme calibrées

Probabilité : moyenne. Impact : élevé (perte de confiance utilisateur).
Mitigation : statuts métriques explicites, SkillTrace en shadow, pas de pourcentage non calibré affiché, copy prudent.

### Risque 4 — Perte de données utilisateur

Probabilité : faible. Impact : critique.
Mitigation : export RGPD en V1, sauvegardes locales, tests delete complet, confirmation destructive.

### Risque 5 — Abandon utilisateur (V1 perçue comme analyseur sans valeur ajoutée)

Probabilité : moyenne. Impact : critique.
Mitigation : boucle V1 complète (training items + practice events + spaced repetition + daily plan), critère de sortie V1 mesurable (J+1 / J+3).

---

# 30. CODEX PROMPT TEMPLATE — À UTILISER POUR CHAQUE SPRINT

Ce template est inclus pour que ce document unique soit directement exploitable par Codex.

```text
MISSION: [SPRINT_ID]

Context:
You are working on NeuroChess.
Use this document as the single master reference.
Do not apply the whole document at once.
Execute only the mission described below.

Hard constraints:
- No commit unless explicitly requested by the user.
- No stage unless explicitly requested by the user.
- No unrelated refactor.
- No V2/V3 feature.
- No LLM.
- No Stockfish change unless explicitly in scope.
- No formula change unless explicitly in scope.
- No fake metric exposure.
- No hidden behavior change.
- Keep code minimal and targeted.

Goal:
[clear sprint goal]

Scope included:
- ...

Scope excluded:
- ...

Acceptance criteria:
1. ...
2. ...
3. ...
4. ...
5. ...

Performance budget:
- ...

Rollback plan:
- ...

Required checks:
- git status before
- inspect relevant files
- implement minimal changes
- run backend tests if applicable:
  .venv\Scripts\python.exe -m unittest discover backend/tests
- run frontend checks if applicable:
  cd frontend
  node node_modules\typescript\bin\tsc --noEmit
  node node_modules\vite\bin\vite.js build
- run smokes if available:
  .venv\Scripts\python.exe scripts\review_regression_smoke.py
  .venv\Scripts\python.exe scripts\pgn_import_smoke.py
  .venv\Scripts\python.exe scripts\pgn_sindarov_real_flow_smoke.py

Expected final report:
- mission name
- files modified
- user-visible changes
- backend changes
- frontend changes
- data model changes
- tests added
- tests run
- results
- screenshots if UI
- performance measured vs budget
- known risks
- rollback plan
- next recommended sprint
- confirmation of exclusions
- git status summary
```

---

# 31. FINAL SUMMARY

Plan 1 dit : NeuroChess est scientifiquement fondé.

Plan 2 dit : NeuroChess doit être un coach calme, clair, motivant.

Plan 3 dit : on construit la plus petite boucle stable qui prouve la promesse.

Boucle V1 :

> Importe une partie
> → analyse
> → affiche la Review
> → identifie les moments clés
> → enseigne un moment
> → entraîne sur 5 positions
> → enregistre les tentatives
> → planifie les révisions
> → met à jour Today
> → recommence.

Si cette boucle fonctionne, NeuroChess existe.

Tout le reste est expansion.

Règle finale :

> Ne construis pas la révolution en premier.
> Construis la boucle qui rend la révolution inévitable.

---

**FIN DU PLAN 3 v2.2 — DOCUMENT UNIQUE TRANSMISSIBLE À CODEX**
