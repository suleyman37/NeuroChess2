# V3.9b Live Analysis Status Audit

Audit de l'existant, sans modification fonctionnelle. Objectif: verifier si
V3.9b est deja present avant de coder quoi que ce soit et eviter toute
reimplementation inutile.

## Resume

Verdict: V3.9b existe deja de facon largement implementee, mais reste
partielle au sens strict de QA avant V4.

Les composants principaux sont presents:

- service live en memoire;
- sessions identifiees par `session_id`;
- endpoints start, stop et stream SSE;
- integration dans `POST /games/{game_id}/moves`;
- `live_analysis_session_id` dans la reponse;
- `EventSource` cote frontend;
- mise a jour de la barre par updates live;
- distinction `analysis_update`, `analysis_stopped`, `analysis_error`;
- tests backend et tests statiques frontend.

Point a durcir avant V4:

- le garde frontend FEN/ply accepte une update si l'un des deux identifiants
  correspond encore. Pendant une fenetre de coup optimiste, une ancienne update
  peut donc passer si le `ply` courant n'a pas encore ete remplace alors que la
  FEN a deja change. La correction minimale serait de refuser une update des
  que la FEN courante connue differe, et de refuser aussi si le ply courant
  connu differe.

## Backend live analysis

### Ce qui existe

Fichier present:

- `backend/neurochess/live_analysis_service.py`

Classes et concepts presents:

- `LiveAnalysisSession`;
- `LiveAnalysisService`;
- `StockfishLiveAnalyzer`;
- `session_id` UUID;
- `game_id`;
- `ply`;
- `fen`;
- `started_at`;
- `status`;
- `latest_payload`;
- queue d'updates;
- thread daemon par session;
- `stop_event`.

Methodes presentes:

- `start_session(fen, game_id=None, ply=None)`;
- `stop_session(session_id)`;
- `stop_sessions_for_game(game_id)`;
- `stop_all()`;
- `get_latest(session_id)`;
- `get_session(session_id)`;
- `stream_session(session_id)`.

Le backend utilise `python-chess` et `chess.engine.SimpleEngine`. Le live utilise
`engine.analysis(...)` avec une limite de temps, sans reimplementation manuelle
du protocole UCI.

Parametres live constates:

- `LIVE_ANALYSIS_MAX_SECONDS = 30.0`;
- `LIVE_ANALYSIS_THROTTLE_MS = 250`;
- `LIVE_ANALYSIS_MULTIPV = 1`;
- `LIVE_UPDATE_SCHEMA_VERSION = "live_analysis_update_v1"`.

Le moteur est ouvert dans `StockfishLiveAnalyzer.stream()` et ferme dans un
`finally` avec `engine.quit()`.

### Format d'update

Une update live contient notamment:

- `type = "analysis_update"`;
- `session_id`;
- `game_id`;
- `ply`;
- `fen`;
- `engine_version`;
- `analysis_kind = "live"`;
- `depth`;
- `seldepth`;
- `nodes`;
- `nps`;
- `time_ms`;
- `eval_cp`;
- `eval_pov_side_to_move_cp`;
- `mate_in`;
- `best_move_uci`;
- `pv`;
- `evaluation_display`;
- `evaluation_source.kind = "live"`;
- `schema_version = "live_analysis_update_v1"`.

La convention POV est conservee:

- `eval_cp` est POV Blancs;
- `eval_pov_side_to_move_cp` est calcule separement;
- `evaluation_display` est construit via `make_evaluation_display(eval_cp,
  mate_in)`, donc a partir de `eval_cp` et non de `eval_pov_side_to_move_cp`.

### Events SSE

Events distingues:

- `analysis_update`;
- `analysis_stopped`;
- `analysis_error`.

`analysis_stopped` ne porte pas `error_message`, ce qui permet au frontend de
le differencier d'une vraie erreur.

## Endpoints live

Endpoints presents dans `backend/neurochess/api/game_routes.py`:

- `POST /live-analysis/start`;
- `POST /live-analysis/stop`;
- `GET /live-analysis/stream?session_id=...`.

Le stream utilise `StreamingResponse` avec:

- `media_type = "text/event-stream"`;
- `Cache-Control: no-cache`;
- `X-Accel-Buffering: no`.

Il n'y a pas de WebSocket, ce qui respecte le perimetre V3.9b.

## Integration POST /moves

`POST /games/{game_id}/moves` fait deja:

- validation et enregistrement du coup;
- calcul shallow synchrone;
- retour `evaluation_display`;
- retour `evaluation_source.kind = "shallow"` quand l'evaluation vient de la
  shallow;
- creation ou recuperation d'une deep analysis en background;
- demarrage d'une session live apres coup legal;
- retour `live_analysis_session_id`;
- warning `live_analysis_unavailable` si le live ne demarre pas;
- maintien du coup jouable meme si le live echoue.

La fonction `_try_start_live_analysis()` stoppe d'abord les sessions live de la
partie via `stop_sessions_for_game(game_id)`, puis appelle `start_session()`.

Le test `test_post_move_starts_live_analysis_without_waiting_for_updates`
verifie que la reponse ne contient pas d'update live et ne depend donc pas du
resultat du live.

## Frontend live analysis

### Ce qui existe

Fichiers concernes:

- `frontend/src/api/client.ts`;
- `frontend/src/App.tsx`;
- `frontend/src/components/EvaluationBar.tsx`.

`client.ts` expose:

- type `LiveAnalysisUpdate`;
- champ `evaluation_source`;
- champ `live_analysis_session_id`;
- fonction `liveAnalysisStreamUrl(sessionId)`.

`App.tsx`:

- ouvre `new EventSource(liveAnalysisStreamUrl(liveAnalysisSessionId))`;
- ferme l'ancienne source dans le cleanup du `useEffect`;
- garde `currentLiveSessionRef`;
- garde `currentFenRef`;
- garde `currentPlyRef`;
- garde `hasValidLiveUpdateRef`;
- garde `liveStoppedNormallyRef`;
- ignore les updates avec mauvais `session_id`;
- ignore les updates dont FEN et ply ne correspondent pas;
- met a jour `evaluation` avec `update.evaluation_display`;
- met a jour `evaluationSource` avec `update.evaluation_source`;
- efface `liveStatus` apres update valide;
- traite `analysis_stopped` comme un stop normal;
- n'affiche le warning live que si aucune update valide n'a ete recue pour la
  session courante.

`EvaluationBar.tsx` affiche:

- `shallow` avec `≈`;
- `live` avec `live`;
- `deep` avec `=`;
- `calibration` avec `✓`.

La barre recoit uniquement `evaluation` et `source`. Aucun usage frontend de
`eval_pov_side_to_move_cp` n'a ete trouve hors definition de type API.

### Point fragile trouve

Le garde frontend actuel ignore une update seulement si la FEN et le ply sont
tous les deux differents:

```ts
if (
  update.fen !== currentFenRef.current &&
  update.ply !== currentPlyRef.current
) {
  return;
}
```

Effet: une update est acceptee si la FEN correspond ou si le ply correspond.
En fonctionnement normal cela protege la plupart des cas, mais pendant un coup
optimiste, la FEN peut deja changer tandis que le `ply` local peut rester celui
du coup precedent jusqu'au retour API. Une ancienne update live pourrait alors
etre acceptee temporairement.

Correction minimale proposee, non appliquee dans cet audit:

- ignorer si `currentFenRef.current` existe et differe de `update.fen`;
- ignorer si `currentPlyRef.current` existe et differe de `update.ply`;
- ajouter un test statique ou frontend qui verifie ces deux refus separement.

## Barre d'evaluation

Conforme a l'audit:

- source `shallow` affiche `≈`;
- source `live` affiche `live`;
- source `deep` affiche `=`;
- source `calibration` affiche `✓`;
- `evaluation_display` est calcule cote backend avec `eval_cp` POV Blancs;
- `eval_pov_side_to_move_cp` n'est pas utilise pour alimenter la barre.

Le frontend peut afficher une barre neutre desactivee quand `evaluation` est
absente.

## DB et analyses canoniques

Le code live ne fait pas d'ecriture DB. Les updates live sont en memoire et
streaming uniquement.

Seuls les chemins V3.5/V3.9a ecrivent dans `position_analyses`:

- shallow;
- deep;
- analyses durables;
- calibration via CLI hors DB durable, selon l'usage.

Un test backend verifie explicitement:

- aucune ligne `analysis_kind = 'live'` n'est ecrite dans
  `position_analyses`.

`top_moves` reste le contrat canonique dans `analysis_json`; l'audit live n'a
pas trouve de remplacement canonique par `top1`.

## Tests existants autour du live

Tests backend live:

- `backend/tests/test_live_analysis_service.py`
  - `start_session` retourne des IDs uniques;
  - `stop_session` met `status = stopped`;
  - `stop_sessions_for_game` stoppe les sessions precedentes;
  - une update contient le contrat live;
  - POV Blancs et POV side-to-move sont verifies;
  - mate live donne un display exact;
  - erreur moteur streamable sans crash;
  - `analysis_stopped` est distinct de `analysis_error`.

Tests API:

- `backend/tests/test_game_api.py`
  - `POST /moves` retourne `live_analysis_session_id`;
  - `POST /moves` ne depend pas des updates live;
  - `POST /moves` fonctionne si le demarrage live echoue;
  - un nouveau coup stoppe les sessions precedentes;
  - aucune update live n'est stockee en DB;
  - endpoints live start/stop presents.

Tests statiques frontend:

- `backend/tests/test_calibration_logic.py`
  - presence de `EventSource`;
  - fermeture de l'EventSource;
  - verification `session_id`;
  - verification FEN/ply;
  - label live;
  - nettoyage du warning live;
  - impossibilite recherchee d'afficher un warning apres update valide.

Manque constate:

- pas de test navigateur reel EventSource;
- pas de test frontend automatise qui simule la fenetre optimistic UI avec FEN
  differente mais ply encore identique;
- le test statique actuel verifie la presence de chaines, pas la logique exacte
  du garde FEN/ply.

## Ce qui manque

Avant V4, il reste a faire au minimum:

1. Durcir le garde stale-update frontend FEN/ply.
2. Ajouter le test correspondant.
3. Executer `npm run build`.
4. Executer `python -m unittest discover backend/tests`.
5. Faire le protocole manuel navigateur avec plusieurs coups et verifier que
   l'ancienne session ne met jamais a jour la barre apres changement de FEN.

## Ce qui est casse

Aucun blocage backend majeur trouve.

Point casse ou fragile cote frontend:

- le garde FEN/ply est permissif si un seul des deux champs correspond encore.
  C'est probablement invisible la plupart du temps, mais c'est contraire a
  l'esprit strict "ignorer les updates obsoletes".

Le warning contradictoire `+1.51 live` et `analyse live indisponible` semble
deja traite par les gardes V3.9c:

- update valide: `setLiveStatus(null)`;
- stop normal: pas de warning;
- erreur avant premiere update seulement: warning visible;
- erreur apres update valide: warning efface.

## Ce qui est redondant ou historique

`docs/v3_9b_live_analysis_audit.md` documente l'etat avant implementation
V3.9b. Il est utile comme trace historique, mais ne doit pas etre lu comme
statut courant: il indique que le service live n'existait pas encore, alors que
le code actuel le contient.

## Plan minimal de correction propose

Pas applique dans cet audit.

1. Dans `frontend/src/App.tsx`, remplacer le garde stale-update par deux refus
   independants:
   - FEN courante connue et differente: ignorer;
   - ply courant connu et different: ignorer.
2. Ajouter un test statique plus strict ou un test frontend qui couvre:
   - ancien `session_id`: ignore;
   - FEN differente: ignore;
   - ply different: ignore;
   - FEN differente mais ply identique: ignore.
3. Relancer:
   - `python -m unittest discover backend/tests`;
   - `npm run build`.

## Verdict

V3.9b n'est pas absente. Elle existe deja.

Verdict strict: V3.9b partielle a verrouiller avant V4.

Raison: architecture live, endpoints, SSE, integration `POST /moves`,
EventSource et tests existent deja, mais un garde frontend contre les updates
obsoletes est trop permissif dans un cas limite et le comportement navigateur
reel doit encore etre confirme manuellement.
