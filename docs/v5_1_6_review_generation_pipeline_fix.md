# V5.1.6 — Review Generation Pipeline Fix

## Objectif

Corriger le pipeline réel de génération Review pour que :

- `pending` signifie qu’un travail deep actif existe vraiment ;
- `GET /review` puisse finaliser une review dès que les analyses deep sont disponibles ;
- une partie sans coup significatif se termine en `no_significant_moments` ;
- le frontend n’affiche pas une fausse analyse en arrière-plan.

## Correction backend

### Création des analyses deep manquantes

`ReviewService.generate_review(game_id)` construit la liste des FEN nécessaires :

- `fen_before` de chaque coup ;
- `fen_after` de chaque coup ;
- dédoublonnage des FEN.

Si une analyse deep `done` manque, le service appelle :

`AnalysisService.get_or_create_analysis(fen=..., depth=12, multipv=3, kind="deep")`

Cela crée ou retrouve les lignes `position_analyses` nécessaires.

### Traitement réel

L’endpoint `POST /games/{game_id}/review/generate` lance :

`AnalysisService.process_pending_analyses(10)`

via `BackgroundTasks`, uniquement si le payload retourné est :

- `status="pending"` ;
- `review_work_active=true`.

### Payload pending

Un pending backend contient maintenant :

- `missing_deep_count`
- `total_required_deep_count`
- `analyzed_deep_count`
- `scheduled_deep_count`
- `failed_deep_count`
- `review_work_active`
- `message`

Si `review_work_active=false`, le payload n’est pas un faux pending : il devient `status="stalled"`.

## Auto-finalisation GET `/review`

`GET /games/{game_id}/review` recalcule l’état réel depuis `position_analyses`.

Si une review stockée est `pending` et que `missing_deep_count == 0` :

1. Le service sélectionne les moments significatifs.
2. Si des moments existent, la review devient `done`.
3. Si aucun moment n’existe, la review devient :
   - `status="done"` ;
   - `moments=[]` ;
   - `empty_reason="no_significant_moments"`.

Règle verrouillée :

`missing_deep_count=0 + moments=[]` ne retourne jamais `pending`.

## No significant moments

La sélection des moments reste basée sur V5.1.5 :

- perte de Win% du joueur qui vient de jouer ;
- seuil `MIN_SIGNIFICANT_WIN_LOSS = 10.0` ;
- événement de mate significatif toujours retenu.

Si aucun coup ne dépasse le seuil et que toutes les analyses nécessaires sont disponibles, l’UI affiche :

`Aucun moment majeur détecté : la partie est restée trop équilibrée pour générer une review utile.`

## Correction frontend

Le frontend ajoute un état explicite :

- `stalled`

Règles :

- `status="pending" + review_work_active=true` : spinner court, puis message d’analyse en arrière-plan.
- `status="pending" + review_work_active=false` : normalisé en `stalled`.
- `status="stalled"` : message clair, sans pending background.
- `empty_reason="no_significant_moments"` : message de conclusion, sans spinner et sans bouton de vérification.

## Boutons

- `Vérifier à nouveau` : appelle seulement `GET /review`.
- `Relancer l’analyse` : relance `POST /review/generate` depuis un état bloqué/erreur.

Cette séparation évite une boucle infinie de génération.

## Protocole de test manuel

1. Créer une partie terminée de 10 demi-coups.
   - Attendu : `Partie trop courte pour générer une review fiable.`
2. Créer une partie terminée de plus de 10 demi-coups sans variation significative.
   - Attendu : `Aucun moment majeur détecté : la partie est restée trop équilibrée pour générer une review utile.`
3. Créer une partie reviewable sans toutes les analyses deep.
   - Attendu : `pending` seulement si `review_work_active=true`.
4. Cliquer `Vérifier à nouveau`.
   - Attendu : appel `GET /review`, pas `POST /review/generate`.
5. Simuler un état bloqué sans analyse active.
   - Attendu : message `L’analyse approfondie n’a pas pu être lancée. Réessayez plus tard.`
6. Vérifier qu’aucun spinner Review ne boucle indéfiniment.

## Commandes de validation

```powershell
.\.venv\Scripts\python.exe -m unittest discover backend/tests
```

```powershell
cd frontend
npm run build
```

Si `npm` n’est pas installé sur le PC, utiliser le runtime Node local déjà présent pour lancer `tsc --noEmit` puis `vite build`.

## Résultat attendu

V5.1.6 supprime le faux pending : l’UI ne dit plus qu’une analyse continue en arrière-plan si le backend ne confirme pas `review_work_active=true`.
