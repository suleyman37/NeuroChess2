# V3.7 Full System QA

## Resume

PASS

Les tests backend passent avec Stockfish reel configure via
`NEUROCHESS_STOCKFISH_PATH`, et le build frontend passe avec Node.js/npm
installes. Le terminal courant doit etre rouvert pour que le `PATH` Windows
expose directement `node` et `npm`, mais le build a ete verifie avec le chemin
d'installation Node.js.

## Environnement

- Python version: Python 3.14.4
- OS: Microsoft Windows NT 10.0.26100.0
- npm disponible: oui (`C:\Program Files\nodejs\npm.cmd`, version 11.12.1)
- node disponible: oui (`C:\Program Files\nodejs\node.exe`, version v24.15.0)
- Stockfish disponible: oui (`backend\neurochess\stockfish.exe`, Stockfish 18)
- `NEUROCHESS_STOCKFISH_PATH`: `C:\Users\grezo\Desktop\NeuroChess2\backend\neurochess\stockfish.exe`
- DB auditee: `neurochess.db`
- Tests backend: bases temporaires SQLite par test

## Checklist

- DB/migrations: PASS
- Game loop backend: PASS
- FEN standard: PASS
- Engine availability: PASS
- Evaluation display: PASS
- Shallow/deep pipeline: PASS
- API endpoints: PASS
- Frontend types/build: PASS
- Manual test readiness: PASS

## Bugs Trouves

### FEN invalide masquable par l'analyse

- Description: une FEN invalide pouvait arriver jusqu'a la couche d'analyse et
  etre convertie en erreur generique.
- Cause: `AnalysisService` ne validait pas la FEN avant `INSERT OR IGNORE`, et
  l'API attrapait trop largement les exceptions shallow.
- Correction: ajout de `InvalidFenError`, validation defensive avec
  `chess.Board(fen)`, rejet `invalid_fen` avant insertion, endpoint
  `/analyses/by-fen` en `400 invalid_fen`.
- Test ajoute: rejet de la FEN contenant `c`, aucune ligne d'analyse inseree,
  `invalid_fen` distinct de `analysis_engine_unavailable`.

### Barre non alimentee quand l'analyse est indisponible

- Description: l'UI affichait un etat vide quand aucune evaluation n'etait
  disponible.
- Cause: lors du diagnostic initial, Stockfish n'etait pas configure pour le
  backend; shallow echouait et l'API renvoyait une evaluation nulle.
- Correction: ajout du champ canonique additif `evaluation_display`, maintien
  de `evaluation` comme alias compatible, et rendu frontend neutre explicite
  `Analyse indisponible`.
- Test ajoute: `POST /moves` avec FakeEngine retourne `evaluation_display`;
  le frontend lit `evaluation_display ?? evaluation`.

### Message moteur brut

- Description: l'UI pouvait afficher un code technique brut.
- Cause: le frontend affichait directement `warnings.join(", ")`.
- Correction: mapping frontend vers un message lisible:
  `Moteur d'analyse indisponible. Verifie le chemin Stockfish ou NEUROCHESS_STOCKFISH_PATH.`
- Test ajoute: verification statique du mapping frontend.

### Contrat d'avertissement moteur heterogene

- Description: une branche retournait encore `engine_unavailable`.
- Cause: `status != done` dans `_try_shallow_engine_evaluation`.
- Correction: warning canonique `analysis_engine_unavailable`; le frontend garde
  aussi un fallback pour l'ancien code.
- Test ajoute: moteur absent simule, partie jouable, warning distinct de
  `invalid_fen`.

## Verifications FEN

- Aucune FEN stockee dans `moves.fen_before` ou `position_analyses.fen` ne
  contient `c` dans le placement.
- Aucune FEN stockee auditee n'est invalide pour `python-chess`.
- Les 7 parties locales avec coups ont ete rejouees sans probleme.
- La FEN observee avec `c`
  `7r/8/4k1Rp/8/2c2P2/4B3/PPP3PP/2K2BNR b - - 1 18`
  est rejetee par `python-chess`.
- Le backend reste source de verite: l'UI applique `state.fen` renvoye par
  l'API et ne contient pas de mapping francais de la FEN.

## Tests Executes

Commandes executees:

```powershell
[Environment]::SetEnvironmentVariable("NEUROCHESS_STOCKFISH_PATH", "C:\Users\grezo\Desktop\NeuroChess2\backend\neurochess\stockfish.exe", "User")
winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
& 'C:\Program Files\nodejs\npm.cmd' install
$env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run build
$env:NEUROCHESS_STOCKFISH_PATH = [Environment]::GetEnvironmentVariable('NEUROCHESS_STOCKFISH_PATH', 'User'); & 'C:\Users\grezo\AppData\Local\Python\bin\python.exe' -m unittest discover backend/tests
& 'C:\Users\grezo\AppData\Local\Python\bin\python.exe' -m unittest backend/tests/test_analysis_service.py
& 'C:\Users\grezo\AppData\Local\Python\bin\python.exe' -m unittest backend/tests/test_game_api.py
& 'C:\Users\grezo\AppData\Local\Python\bin\python.exe' -m unittest backend/tests/test_v3_7_full_system_qa.py
& 'C:\Users\grezo\AppData\Local\Python\bin\python.exe' -m unittest discover backend/tests
& 'C:\Users\grezo\AppData\Local\Python\bin\python.exe' --version
where.exe npm
where.exe node
where.exe stockfish
where.exe stockfish.exe
npm run build
```

Audits scriptes executes:

- scan de `neurochess.db` pour FEN contenant `c` dans le placement;
- validation des FEN stockees par `chess.Board(fen)`;
- replay des parties locales depuis `moves`;
- verification migrations `0001` et `0002`;
- verification index `idx_position_analyses_unique_v3_5`;
- verification demarrage StockfishService.

## Resultats

- Backend complet avec Stockfish configure: 111 tests OK.
- `test_analysis_service.py`: 14 tests OK.
- `test_game_api.py`: 17 tests OK.
- `test_v3_7_full_system_qa.py`: 9 tests OK.
- StockfishService: demarrage OK, analyse FEN initiale OK avec Stockfish 18.
- npm install: OK, 0 vulnerabilite signalee.
- npm build: premier essai bloque par le `PATH` du terminal deja ouvert, puis
  OK avec `C:\Program Files\nodejs` ajoute au `PATH` de la commande
  (`tsc && vite build`).
- DB locale:
  - `moves`: 113 lignes;
  - `position_analyses`: 80 lignes;
  - FEN avec `c` dans le placement: 0;
  - FEN stockees invalides: 0;
  - migrations: `0001_v0_schema`, `0002_v3_5_durable_analysis_pipeline`;
  - index unique V3.5 present.

## Limites Restantes

- Rouvrir le terminal / l'IDE pour que le `PATH` Windows expose directement
  `node` et `npm`, et pour que les processus lances ensuite lisent
  `NEUROCHESS_STOCKFISH_PATH`.
- Refaire un parcours navigateur manuel:
  - nouvelle partie;
  - 10 coups;
  - coup illegal;
  - affichage FEN debug;
  - warning moteur;
  - barre d'evaluation avec moteur reel;
  - fin de partie.
- Le comportement promotion reste celui de V3: promotion frontend automatique
  en dame; backend accepte les UCI de promotion explicites.

## Statut Final

PASS

La stabilisation V3.7 est fonctionnelle et testee avec FakeEngine/mock,
Stockfish reel configure, tests backend complets et build frontend.
