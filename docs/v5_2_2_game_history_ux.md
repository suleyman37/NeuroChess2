# V5.2.2 - Game History UX, Game Types & Analysis Readiness

## Objectif

Transformer l'historique en bibliotheque de parties claire, sans masquer les
parties locales et sans lancer d'analyse massive.

## Categories de parties

- `local_manual` : partie jouee localement dans NeuroChess.
- `local_ai` : future partie contre IA.
- `imported_user` : partie PGN importee associee a un alias utilisateur.
- `imported_observed` : partie PGN importee non associee au profil utilisateur.
- `analysis_sandbox` : position ou partie incomplete utilisee pour analyse/test.
- `unknown` : donnees insuffisantes pour classer proprement.

## Migration

V5.2.2 ajoute uniquement `games.game_category`.

Backfill prudent :

- `source='pgn_import'` et `user_color IS NOT NULL` => `imported_user`
- `source='pgn_import'` et `user_color IS NULL` => `imported_observed`
- `opponent_type IN ('engine', 'bot')` => `local_ai`
- `source='local'` ou `NULL` => `local_manual`
- reste => `unknown`

## Scopes history

`GET /games/history` accepte `scope` :

- `mine` : `imported_user`, `local_manual`, `local_ai`
- `imported` : `imported_user`, `imported_observed`
- `local` : `local_manual`
- `ai` : `local_ai`
- `observed` : `imported_observed`
- `all` : toutes les parties terminees

Le scope par defaut est `mine`.

## Labels UI

Le backend renvoie des champs prets pour l'interface :

- `display_title`
- `display_subtitle`
- `time_control_category`
- `metadata_quality`
- `review_summary_status`
- `is_reviewable`

Objectif : ne plus afficher `? - ?` dans l'historique.

## Pourquoi les parties locales restent visibles

Les parties locales sont des vraies parties jouees dans NeuroChess. Elles font
partie de l'historique utilisateur et doivent rester dans `Mes parties`, avec un
badge `Local`.

## Historique frontend

L'onglet Historique affiche maintenant une bibliotheque de parties :

- filtres visibles : Mes parties, Importees, Locales, IA, Observees, Toutes ;
- badges source/categorie ;
- titre et sous-titre lisibles ;
- resultat, ouverture, etat d'analyse ;
- actions : Ouvrir, Analyser/Voir review, Classifier ouverture si necessaire.

## Zone Analyse

V5.2.2 affiche seulement des etats simples :

- `Review disponible`
- `A analyser`
- `Analyse en cours`
- `Aucun moment majeur`
- `Trop courte`
- `Echec analyse`

Il n'y a pas de score sur 100, pas d'accuracy et pas d'ACPL.

## Score futur

Le score sur 100 est une direction future, apres stabilisation du modele Review,
DQB et Expected Score Loss. V5.2.2 prepare l'emplacement UX sans calculer de
note globale.

## Analyse

- Aucune analyse Stockfish massive n'est lancee.
- Les parties importees ou locales sont analysees seulement sur action
  utilisateur via le pipeline Review existant.
- Les parties observees restent accessibles mais ne sont pas presentees comme
  "mes parties".

## Test manuel recommande

1. Ouvrir Historique.
2. Verifier que `Mes parties` affiche les parties locales et importees liees a
   l'utilisateur.
3. Passer sur `Importees`, `Locales`, `IA`, `Observees`, `Toutes`.
4. Confirmer qu'aucune ligne `? - ?` n'apparait.
5. Ouvrir une partie locale.
6. Ouvrir une partie importee.
7. Verifier que le bouton Review reste manuel.
8. Confirmer qu'aucun score global n'est affiche.
