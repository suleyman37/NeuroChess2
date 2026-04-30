# V5.3.A4g - Review Regression Harness

## Objectif

Reduire les cycles "Codex corrige -> navigateur humain trouve un bug" en
ajoutant un harnais de regression local pour la Review deep :

- fake engine deterministe mais non instantane ;
- reproduction d'un blocage sur la derniere position ;
- verification de reprise ;
- diagnostic pack copiable ;
- tests sur FEN invalides, terminal positions, MultiPV clamp et jitter SQLite.

## Fake engine

Le fake engine est desactive par defaut. Il s'active avec :

```powershell
$env:NEUROCHESS_ENGINE_MODE = "fake"
```

Variables supportees :

- `FAKE_ENGINE_DELAY_MS` : delai artificiel par position, par defaut 300 ms.
- `FAKE_ENGINE_HARD_TIMEOUT_MS` : timeout externe expose a `AnalysisService`.
- `FAKE_ENGINE_HANG_ON_INDEX` : bloque l'appel numero N.
- `FAKE_ENGINE_HANG_ON_FEN_KEY` : bloque une FEN precise.
- `FAKE_ENGINE_FAIL_ON_INDEX` : echoue l'appel numero N.
- `FAKE_ENGINE_FAIL_ON_FEN_KEY` : echoue une FEN precise.
- `FAKE_ENGINE_FAIL_ONCE=true` : l'echec force ne se produit qu'une fois.

Le fake engine retourne des profondeurs, nodes, nps, evals et top moves
deterministes. Il expose aussi les settings de profil : Threads, Hash, MultiPV,
`analysis_limit_mode` et `fake_engine=true`.

## Validite FEN

Avant un appel moteur, le backend verifie maintenant :

- parsing FEN ;
- `board.is_valid()` ;
- positions terminales ;
- nombre de coups legaux pour clamping MultiPV.

Une FEN invalide est marquee `invalid_fen` sans appel Stockfish et sans job
running infini.

## SQLite retry

Les writes critiques continuent de passer par le coordinateur local `RLock`.
Le retry ajoute maintenant un jitter court au backoff exponentiel afin d'eviter
que plusieurs writers se reveillent exactement ensemble.

## Diagnostic Pack

Endpoint :

```text
GET /review/jobs/{job_id}/diagnostics
```

Payload principal :

- `job_id`, `game_id`, `status`, `profile`;
- `retryable`, `stalled_reason`, `error_message`, `last_error`;
- `current_phase`, `current_fen_key`, `current_fen_index`;
- `required_position_count`, `completed_position_count_stored`;
- `valid_analysis_count`, `missing_fens_count`, `pending_fens_count`,
  `running_fens_count`, `failed_fens_count`;
- heartbeat / progress timestamps;
- budget total et temps par position;
- engine settings;
- cache quality gate summary.

Ce endpoint est destine au debug/dev et n'est pas affiche dans l'UI normale.

## Smoke test

Script :

```powershell
.venv\Scripts\python.exe scripts\review_regression_smoke.py
```

Le smoke :

1. cree une DB temporaire ;
2. cree une partie Reviewable ;
3. lance une Review deep avec fake engine ;
4. verifie que score/moments ne sont pas visibles pendant running ;
5. simule un refresh par rechargement du job depuis une nouvelle instance ;
6. verifie completion ;
7. cree une seconde partie ;
8. force un hang sur la derniere position ;
9. verifie que le job devient retryable ;
10. reprend et termine sans relancer les positions deja valides ;
11. lit le Diagnostic Pack.

Commande avec delai explicite proche navigateur :

```powershell
$env:NEUROCHESS_ENGINE_MODE="fake"
$env:FAKE_ENGINE_DELAY_MS="300"
.venv\Scripts\python.exe scripts\review_regression_smoke.py
```

## Limites

- Le smoke est backend/service-level. Il ne remplace pas une verification
  navigateur avec le vrai Stockfish.
- Playwright n'est pas introduit pour eviter une nouvelle dependance de test.
- `GET /review/jobs/{job_id}` conserve une transition de reparation watchdog en
  cas stale ; le endpoint diagnostics est le chemin read-only pur.

## Checklist navigateur

- Lancer une analyse deep sur la partie qui bloquait a 88/89.
- Verifier qu'elle ne reste jamais running infini.
- Si elle devient `stalled`/retryable, cliquer `Reprendre`.
- Verifier que les positions deja done ne sont pas recalculees.
- Faire F5 pendant running/finalizing et verifier restauration du job.
- Ouvrir l'onglet Review et confirmer que le live reste suspendu.
- Confirmer que score/moments n'apparaissent qu'en `completed`.
