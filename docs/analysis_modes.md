# Analysis Modes

## Modes

| Mode | Usage | Parametres actuels | Limites | Source de verite | Affichage |
| --- | --- | --- | --- | --- | --- |
| `shallow` | Evaluation rapide apres `POST /games/{game_id}/moves` | depth 8, multipv 1, budget 300 ms | Rapide, donc parfois instable ou differente de Lichess | `analysis_json` si stockee, puis `evaluation_display` dans la reponse API | Barre live avec indicateur approx |
| `live` | Evaluation progressive de la position courante | multipv 1, session max 30 s, updates throttlees | Non canonique, non stockee, stoppee/redemarree a chaque nouveau coup | Payload SSE en memoire avec `schema_version='live_analysis_update_v1'` | Barre live avec indicateur `live` |
| `deep` | Analyse durable pour lecture future | depth 12, multipv 3, budget 5000 ms | Pas lue comme review en V3.9b; pas de classement de coups | `position_analyses.analysis_json` avec `schema_version='engine_analysis_v2'` | Indicateur reserve `=` si une UI consomme une deep |
| `calibration` | Debug/verifiabilite CLI pour comparer une FEN | CLI: depth/time/nodes/multipv choisis par l'appelant | Pas live, pas persiste, pas appele par `POST /moves` | JSON stdout `schema_version='calibration_v1'` | Indicateur reserve check |

## Pourquoi NeuroChess peut differer de Lichess ?

NeuroChess live utilise d'abord une `shallow` eval rapide, actuellement depth 8
avec un budget court. Ensuite V3.9b peut afficher des updates `live`
progressives. Lichess peut afficher une evaluation navigateur, cloud, stockee ou
recalculee avec une profondeur differente.

Les ecarts peuvent aussi venir de:

- version moteur differente;
- configuration moteur differente;
- NNUE ou fichiers `EvalFile` / `EvalFileSmall` differents;
- profondeur, temps, nodes et MultiPV differents;
- positions tactiques instables;
- cache ou analyse preservee cote Lichess.

L'objectif n'est pas une egalite au centipion pres. La comparaison manuelle doit
chercher le meme camp avantage, le meme ordre de grandeur, et le meme sens
d'evolution quand on augmente la profondeur.

## Live et ethique

L'analyse live est un outil d'entrainement local. Elle ne doit pas etre utilisee
pour tricher dans des parties en ligne contre des humains.

## Politique mate

`mate_in` court-circuite la sigmoide:

- `mate_in > 0`: donnees `white_percent=100.0`, `black_percent=0.0`, label `M{n}`;
- `mate_in < 0`: donnees `white_percent=0.0`, `black_percent=100.0`, label `-M{n}`;
- `mate_in is null`: la barre utilise la formule Lichess sur `eval_cp` POV Blancs.

Les donnees restent 100/0 ou 0/100. Si le frontend veut garder un filet visuel,
cela doit rester une decision CSS, pas une modification de la donnee canonique.

## Politique UCI_NNUE / EvalFile

La calibration lit `engine.options` via python-chess.

- Si `UCI_NNUE` est expose, NeuroChess tente de le configurer a `true`.
- Si `UCI_NNUE` n'est pas expose, NeuroChess ne force rien et le reporte comme
  `not_exposed`.
- `EvalFile` et `EvalFileSmall` sont lus et reportes quand exposes.
- Le rapport s'appelle `engine_options_reported`; il ne pretend pas connaitre
  une valeur effective non exposee par python-chess.

## Futur apres V3.9b

Hors perimetre V3.9b:

- `position startpos moves` pour vraie session live;
- separation `live_engine` / `deep_worker`;
- pool moteur ou moteur persistant refactore;
- couche review V4.

V3.9b implemente le live progressif minimal avec SSE et `session_id`, mais ne
stocke pas les updates et ne cree pas de couche review.
