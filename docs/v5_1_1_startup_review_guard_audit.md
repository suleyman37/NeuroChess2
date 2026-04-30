# V5.1.1 Startup Engine Warning + Short Game Review Guard Audit

## Warning moteur au demarrage

Le warning jaune visible dans l'UI vient de deux sources frontend:

1. `warnings` retournes par l'API dans `GameState`, notamment
   `analysis_engine_unavailable`, `engine_unavailable` ou
   `live_analysis_unavailable`;
2. `liveStatus`, affiche dans `App.tsx` quand une session `EventSource`
   retourne `analysis_error` ou une erreur reseau avant toute evaluation valide.

Le backend peut produire `live_analysis_unavailable` dans
`_try_start_live_analysis()` si `LiveAnalysisService.start_session()` echoue.
La shallow evaluation peut produire `analysis_engine_unavailable` quand
StockfishService ne repond pas. Les erreurs live SSE viennent du lancement de
Stockfish dans `StockfishLiveAnalyzer.stream()`.

Stockfish est lance a la demande par les services moteur. Le premier appel
live-analysis peut donc arriver pendant une phase de demarrage du process
moteur. Avant correction, cette premiere erreur etait affichee comme une
indisponibilite definitive.

Il n'existait pas de retry frontend pour `POST /live-analysis/start`, ni pour
une erreur SSE `analysis_error` avant la premiere update valide.

## Review partie courte

`ReviewPanel` affiche `Analyse approfondie en cours...` quand:

- `reviewLoading` est vrai;
- ou `review.status` vaut `pending` / `running`.

Cote backend, `ReviewService.generate_review()` avait deja une constante
`MIN_HALF_MOVES_FOR_REVIEW = 10` et levait une erreur pour les parties trop
courtes. Mais l'API transformait cette erreur en `HTTPException` generique, et
`GET /games/{game_id}/review` retournait `not_generated` si aucune review
n'existait.

Une partie tres courte pouvait donc conduire le frontend a un etat trop
generique: l'utilisateur voyait une attente d'analyse au lieu d'un message
stable indiquant que la partie n'est pas reviewable.

## Risques

- Masquer une vraie absence de moteur: la correction doit seulement retarder le
  warning definitif pendant les retries.
- Creer une boucle de retry infinie: les retries sont limites a 2 tentatives.
- Retourner `pending` pour partie courte: interdit, car cela declenche le
  polling review.
- Modifier l'algorithme review: hors scope. Seul le garde partie courte est
  rendu explicite cote API/UI.

