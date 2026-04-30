# Calibration Results Initial

Commande utilisee pour remplir les resultats NeuroChess:

```powershell
python -m backend.tools.evaluate_fen --fen "<FEN>" --mode calibration --depth 6 --time 1 --multipv 1
```

Environnement:

- moteur: Stockfish 18;
- schema sortie: `calibration_v1`;
- objectif: reference initiale de signe et d'ordre de grandeur, pas egalite cp
  exacte avec Lichess.

## Resultats

| # | Cas | FEN | NeuroChess calibration | Lichess manuel | Commentaire |
| ---: | --- | --- | --- | --- | --- |
| 1 | position de depart | `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` | `+0.35`, white 53.2, best `e2e4`, depth 6, nodes 900 | A remplir | Signe proche egal attendu. |
| 2 | avantage materiel Blancs | `rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` | `+7.13`, white 93.2, best `b1c3`, depth 6, nodes 190 | A remplir | Blancs nettement avantages attendus. |
| 3 | avantage materiel Noirs | `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1` | `-5.67`, white 11.0, best `b1c3`, depth 6, nodes 298 | A remplir | Noirs nettement avantages attendus. |
| 4 | position calme egale | `r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3` | `+0.73`, white 56.7, best `f1b5`, depth 6, nodes 1649 | A remplir | Zone proche egal/leger Blancs; profondeur faible. |
| 5 | +1/+2 Blancs approximative | `rnbqkbnr/1ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` | `+1.31`, white 61.8, best `c2c3`, depth 6, nodes 1046 | A remplir | Blancs doivent rester positifs. |
| 6 | -1/-2 Noirs approximative | `rnbqkbnr/pppppppp/8/8/8/8/1PPPPPPP/RNBQKBNR w KQkq - 0 1` | `-0.57`, white 44.8, best `e2e4`, depth 6, nodes 2582 | A remplir | Noirs doivent rester positifs cote noir; ecart faible possible. |
| 7 | position tactique | `r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 3` | `-0.02`, white 49.8, best `g8f6`, depth 6, nodes 1595 | A remplir | Position sensible a profondeur; signe exact peu important ici. |
| 8 | finale simple | `8/8/8/8/8/4k3/8/4K2R w K - 0 1` | `+5.58`, white 88.6, best `h1h2`, depth 6, nodes 667 | A remplir | Blancs gagnants attendus. |
| 9 | mate Blancs | `7k/8/5KQ1/8/8/8/8/8 w - - 0 1` | `M1`, white 100.0, best `g6g7`, depth 6, nodes 143 | A remplir | Mate blanc force, sigmoide court-circuitee. |
| 10 | mate Noirs | `8/8/8/8/8/5kq1/8/7K b - - 0 1` | `-M1`, white 0.0, best `g3g2`, depth 6, nodes 143 | A remplir | Mate noir force, sigmoide court-circuitee. |
| 11 | Giuoco Pianissimo test | `r1bqk2r/ppp1nppp/2np4/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w kq - 4 6` | live observe `+2.29`; shallow depth 8 `+1.88`; calibration depth 18 `+1.76`, depth 25 `+2.33`, nodes 1M `+2.02`; best `f3g5`; Stockfish 18 | Lichess observe env. `+1.9`; Chess.com observe env. `+2.49` | Coherent: tous indiquent un avantage Blancs net. Les ecarts sont attendus selon profondeur, temps, nodes, hash, version/config moteur, NNUE/EvalFile, MultiPV et source cloud/cache. Variante halfmove `... - 1 6` testee aussi: depth 18 `+1.71`, meme signe. |

## Criteres manuels

- signe identique attendu sur les positions materielles;
- meme camp avantage attendu;
- ordre de grandeur coherent attendu;
- difference exacte au centipion non garantie;
- les positions tactiques peuvent bouger avec depth/time/nodes;
- les mates doivent rester des mates et non des pourcentages issus de la
  sigmoide.
