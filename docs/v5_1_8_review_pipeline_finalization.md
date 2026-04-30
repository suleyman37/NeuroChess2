# V5.1.8 - Review Pipeline Finalization

## Cause racine

Le spinner Review n'etait plus le probleme principal. Le pipeline pouvait
continuer a presenter une attente alors que certaines analyses deep etaient
manquantes ou en echec.

Le point le plus concret trouve en V5.1.8 : la route Review programmait le
traitement background avec un batch fixe `process_pending_analyses(limit=10)`.
Une review de 11 demi-coups peut demander 12 FEN uniques, donc ce batch pouvait
etre insuffisant.

## Batch deep analyses

Quand `POST /games/{game_id}/review/generate` retourne `pending` avec
`review_work_active=true`, le backend programme maintenant :

```text
process_pending_analyses(limit=max(10, total_required_deep_count))
```

But : traiter au moins autant d'analyses que le nombre de FEN requises par la
review.

## Pending reel

`pending` signifie maintenant :

- `missing_deep_count > 0` ;
- au moins une analyse requise est `pending` ou `running` ;
- `review_work_active = true`.

Si aucun travail n'est actif, l'UI ne doit pas afficher "analyse continue en
arriere-plan".

## Failed handling

Si des analyses deep sont `failed`, le payload expose :

- `failed_deep_count` ;
- `failed_deep_details`.

Chaque detail peut inclure FEN, erreur, status, `analysis_kind`,
`engine_version`, depth, schema et dates disponibles.

Si la couverture est insuffisante et qu'aucun travail n'est actif, la review
retourne `stalled` ou `failed` avec un message clair.

## Partial fallback

La couverture est calculee par coups dont `fen_before` et `fen_after` ont une
deep `done`.

Seuils :

- `coverage >= 0.95` : `done`
- `0.70 <= coverage < 0.95` : `partial`
- `coverage < 0.70` : `pending` si travail actif, sinon `stalled/failed`

Une seule deep failed ne bloque pas toute la Review si la couverture reste
suffisante.

## no_significant_moments

Si toutes les analyses requises disponibles ne produisent aucun coup significatif :

```text
status = done ou partial
moments = []
empty_reason = "no_significant_moments"
```

Message :

```text
Aucun moment majeur detecte : la partie est restee trop equilibree pour generer une review utile.
```

Ce cas n'affiche pas de spinner et pas de bouton retry.

## Moment significatif

La selection reste basee sur :

```text
MIN_SIGNIFICANT_WIN_LOSS = 10.0
white_percent = 100 / (1 + exp(-0.00368208 * eval_cp))
```

Pour les Blancs :

```text
loss = white_before - white_after
```

Pour les Noirs :

```text
loss = black_before - black_after
black_percent = 100 - white_percent
```

Puis :

```text
loss = max(0, loss)
```

Un coup devient candidat si `loss >= 10` ou si un evenement de mate significatif
est detecte.

La Review ne force jamais 5 moments.

## Force retry

Le bouton "Relancer l'analyse" appelle :

```text
POST /games/{game_id}/review/generate?force_retry_failed=true
```

Le backend remet les deep failed requises en `pending`, puis retourne un
`pending` actif si un vrai travail est programme.

## Frontend

Priorite d'affichage :

1. partie trop courte ;
2. failed/stalled ;
3. timeout ;
4. no_significant_moments ;
5. done/partial avec moments ;
6. pending_background seulement si `review_work_active=true` ;
7. pending/generating ;
8. idle.

Le message "analyse continue en arriere-plan" n'apparait jamais si
`review_work_active=false`.

## Protocole test manuel

1. Lancer backend et frontend.
2. Jouer une partie trop courte : attendre le message "Partie trop courte...".
3. Jouer une partie reviewable avec analyses completes faibles : attendre
   `no_significant_moments`.
4. Simuler ou observer une deep failed : verifier `failed_deep_details` en debug.
5. Cliquer "Relancer l'analyse" : verifier que `force_retry_failed=true` est
   envoye et que `review_work_active=true` revient si le retry est programme.
6. Verifier qu'aucun spinner ne reste visible indefiniment.

## Validation automatique

Tests ajoutes/renforces :

- pending avec batch background dimensionne sur `total_required_deep_count` ;
- `no_significant_moments` sans bouton retry ;
- pending normalise en `stalled` si `review_work_active=false` ;
- failed deep expose et relancable ;
- partial fallback si coverage suffisante ;
- moments Win% seuil 10.0 et mate events.
