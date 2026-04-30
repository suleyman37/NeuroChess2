# V5.3.A4c - Audit Review job lifecycle

## Comportement constate avant A4c

- `POST /games/{game_id}/review/generate` preparait les analyses manquantes et
  pouvait retourner `pending`, mais la requete HTTP restait le point d'entree
  principal de l'UX Review.
- Le frontend utilisait encore une logique de spinner/polling Review heritee.
  Si le backend calculait encore ou si le fetch etait interrompu, l'utilisateur
  pouvait voir un message technique proche de `Failed to fetch` au lieu d'une
  progression d'analyse.
- `GET /games/{game_id}/review` pouvait exposer une Review partielle si la
  couverture etait suffisante selon les anciennes regles. Le cas observe
  `Review partielle - standard - 12/16 positions` pouvait donc afficher des
  resultats utilisateur alors que l'analyse standard n'etait pas terminee.
- Il n'existait pas de cycle de vie explicite avec `job_id`, progression,
  annulation et relance forcee.
- Une ancienne analyse pouvait etre reutilisee si elle passait les controles
  de profil, meme si elle ne correspondait plus au pipeline Review courant.

## Points backend audites

- Les FEN Review viennent de la position initiale et des `fen_after` de chaque
  demi-coup, dedupliquees par `required_review_fens_for_contexts`.
- Les analyses Review standard/deep sont creees via
  `_ensure_missing_deep_analyses` avec `analysis_profile`, `requested_time_ms`,
  `requested_multipv`, `analysis_limit_mode="time"` et `settings_json`.
- Le cache quality gate utilise maintenant aussi
  `review_pipeline_version = v5_3_a4c_complete_only_review_v1` pour refuser les
  caches standard/deep produits par un pipeline anterieur.
- Le endpoint Review final est strict : si la couverture n'est pas complete,
  le payload retourne `pending`, `failed` ou `incomplete` sans score et sans
  moments.

## Points frontend audites

- Le bouton Review est maintenant branche sur `startReviewJob`, pas sur une
  attente synchrone de `generateReview`.
- Le polling se fait via `GET /review/jobs/{job_id}`.
- Le bouton d'annulation appelle `POST /review/jobs/{job_id}/cancel`.
- Les etats `running`, `incomplete`, `failed` et `cancelled` sont affiches
  avant toute carte de moments, ce qui empeche l'affichage de resultats
  partiels.

## Cause racine corrigee

Le pipeline melangeait preparation, calcul, polling et resultat final. A4c
separe ces etapes : une analyse Review est un job asynchrone, et une Review
standard/deep visible comme resultat exige 100 % des positions terminees et
zero echec.
