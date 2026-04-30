# Live Analysis

## Pourquoi ne pas relancer Stockfish toutes les 100 ms

Relancer Stockfish en boucle creerait des process, casserait la continuite de
recherche, gaspillerait CPU/memoire et produirait une barre instable. V3.9b
demarre une session d'analyse longue sur une FEN, puis streame les informations
intermediaires produites par python-chess / Stockfish.

## Architecture

`LiveAnalysisService` gere des sessions en memoire:

- `session_id`: UUID unique;
- `game_id`: partie associee, si disponible;
- `ply`: demi-coup associe, si disponible;
- `fen`: position analysee;
- `status`: `running`, `stopped` ou `error`;
- `latest_payload`: derniere update connue.

Une session live demarre un thread dedie. Ce thread lance une analyse Stockfish
longue via `python-chess` et `engine.analysis(...)`, puis publie des updates dans
une queue en memoire. Les updates sont throttlees cote backend autour de 250 ms.

## SSE

Le transport V3.9b est Server-Sent Events:

- `POST /live-analysis/start`;
- `POST /live-analysis/stop`;
- `GET /live-analysis/stream?session_id=...`.

SSE suffit car le flux est serveur vers client. Aucun WebSocket n'est ajoute.

## session_id et updates obsoletes

Chaque update contient:

- `session_id`;
- `fen`;
- `game_id`;
- `ply`.

Le frontend ignore une update si:

- `session_id` ne correspond pas a la session courante;
- la FEN ne correspond pas a la FEN courante et le `ply` ne correspond pas au
  demi-coup courant.

## Stop / restart sur nouveau coup

Apres un coup legal, `POST /games/{game_id}/moves`:

1. conserve le comportement V3.5/V3.9a: coup persiste, shallow immediate, deep
   programmee;
2. stoppe les anciennes sessions live de la partie;
3. demarre une nouvelle session live sur `fen_after`;
4. retourne `live_analysis_session_id`.

La reponse n'attend pas les updates live. Si le moteur live echoue, le coup reste
jouable.

## Shallow / Live / Deep / Calibration

- `shallow`: evaluation rapide retournee avec `POST /moves`, stockee separement
  si disponible.
- `live`: updates progressives en memoire, non canoniques, non stockees.
- `deep`: analyse durable future, stockee en DB.
- `calibration`: outil CLI de verification, non live et non appele par
  `POST /moves`.

## Pourquoi les updates live ne sont pas stockees

Les updates live sont intermediaires: profondeur, nodes, PV et score peuvent
changer rapidement. Les stocker dans `position_analyses` polluerait la couche
durable. La DB garde les analyses shallow/deep/calibration finales ou
verifiables, pas chaque update live.

## Limites connues

- Duree max de securite: 30 secondes par session live.
- Une session live utilise un moteur dedie; il n'y a pas de pool moteur.
- Si Stockfish est absent, le jeu reste utilisable et le live devient
  indisponible.
- Les updates live ne remplacent pas l'analyse deep durable.
- Le frontend throttle les mises a jour a environ 200 ms.

## Note anti-triche

L'analyse live est un outil d'entrainement local. Elle ne doit pas etre utilisee
pour tricher dans des parties en ligne contre des humains.
