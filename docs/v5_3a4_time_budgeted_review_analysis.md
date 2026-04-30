# V5.3.A4 - Time-budgeted Review Analysis

## Objectif

V5.3.A4 rend les analyses Review honnetes : une Review standard ou deep ne doit
plus etre presentee comme approfondie si elle repose seulement sur un ancien
cache legacy/depth12.

## Profils

- `cached` : lecture d'une analyse deja disponible. Instantane autorise, mais
  l'UI doit dire que l'analyse est deja disponible.
- `quick` : apercu rapide. Peut utiliser des caches legacy et reste indicatif.
- `standard` : mode recommande. Utilise un vrai budget temps par position.
- `deep` : mode plus long. Utilise un budget plus grand, plafonne.

Le choix UI expose :

- Rapide
- Standard recommande
- Approfondie

Le profil par defaut est `standard`.

## Budgets par partie

`compute_review_total_budget_seconds(half_moves_count, profile)` :

Profil standard :

- `half_moves_count <= 40` : 80 s
- `41..70` : 140 s
- `71..110` : 220 s
- `> 110` : 300 s

Profil deep :

- `1.5 * standard`
- plafond a 450 s

Profil quick :

- `max(20, min(45, 0.7 * half_moves_count))`

Ces budgets sont pour toute la Review, pas pour une position unique.

## Budget par position

Les FEN requises sont les positions avant/apres les coups, dedupliquees.

`per_position_time_ms = total_budget_seconds * 1000 / position_count`

Clamp :

- standard : 1000 a 10000 ms par position
- deep : 2000 a 15000 ms par position
- quick : 300 a 1500 ms par position

Exemple : 40 demi-coups donnent environ 41 positions. En standard, 80 s donnent
environ 1950 ms par position.

## Time-only Stockfish

Pour standard/deep, les analyses creees par la Review sont programmees avec :

- `analysis_profile="standard"` ou `"deep"`
- `requested_time_ms=per_position_time_ms`
- `requested_multipv=3`
- `analysis_limit_mode="time"`
- `requested_depth=None`

`StockfishService` utilise alors :

```text
chess.engine.Limit(time=...)
```

et non :

```text
chess.engine.Limit(depth=12, time=...)
```

Le depth historique ne peut donc plus stopper l'analyse standard/deep avant le
budget temps.

## Cache quality gate

Une analyse cached satisfait un profil demande seulement si :

- meme FEN ;
- `status="done"` ;
- `analysis_kind="deep"` ;
- schema compatible ;
- rang de profil suffisant : `legacy/null < quick < standard < deep` ;
- pour standard/deep : `analysis_limit_mode` vaut `time` ou
  `time_with_max_depth` ;
- `requested_time_ms` existe et respecte le budget requis ;
- `requested_multipv >= 3`.

Donc :

- legacy/null ne satisfait pas standard ;
- quick ne satisfait pas standard ;
- standard satisfait standard ;
- deep satisfait standard et deep.

## Payload expose

Les reponses Review exposent maintenant :

- `review_analysis_profile`
- `review_score_profile`
- `analysis_profile_used`
- `required_position_count`
- `completed_position_count`
- `pending_position_count`
- `failed_position_count`
- `total_budget_seconds`
- `elapsed_seconds`
- `estimated_remaining_seconds`
- `per_position_time_ms`
- `analysis_limit_mode`
- `requested_multipv`
- `average_depth_reached`
- `min_depth_reached`
- `max_depth_reached`
- `cache_hits`
- `cache_misses`
- `legacy_cache_ignored_count`

Le debug DEV affiche ces champs dans le panneau Review.

## UI

Si aucune analyse standard/deep n'existe, le panneau Review propose
`Analyser la partie` avec le mode `Standard recommande` par defaut.

Pendant l'analyse :

- `Analyse approfondie : X/Y positions`
- `Temps prevu : environ Ns`
- `Mode : standard/deep/quick`

Si un cache standard complet existe :

- `Analyse deja disponible`

Si seuls des caches legacy/quick existent et que standard est demande :

- `Analyse rapide disponible`
- la Review programme une vraie analyse standard.

## Score gating

Le score Review continue d'utiliser les analyses deep stables, mais la couverture
est maintenant calculee avec le profil demande. Un score fiable ne doit pas etre
presente avec une couverture standard/deep insuffisante.

## Limites

- Les tests n'attendent pas 80 a 300 secondes : ils utilisent les metadonnees et
  des fake engines.
- Le traitement reste limite a la partie demandee ; il n'y a pas d'analyse
  massive de l'historique.
- La validation navigateur reste necessaire pour observer la progression reelle
  et l'affichage des settings Stockfish.

## Checklist navigateur

1. Ouvrir une partie sans cache standard.
2. Aller dans Review.
3. Verifier que le mode par defaut est `Standard recommande`.
4. Cliquer `Analyser la partie`.
5. Verifier que l'analyse affiche `X/Y positions`, temps prevu et MultiPV.
6. Verifier qu'une ancienne analyse rapide/legacy ne donne pas immediatement un
   score fiable standard.
7. Relancer la meme partie apres completion standard.
8. Verifier que l'UI explique `Analyse deja disponible`.
