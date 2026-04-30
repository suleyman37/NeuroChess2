# V5.2.1 - Imported Game Analysis Bridge

## Objectif

Permettre d'ouvrir une partie PGN importee depuis l'historique, de naviguer dans
ses coups sur le board existant, puis de lancer manuellement la Review.

V5.2.1 ne lance pas d'analyse massive apres import. Les analyses deep ne sont
creees qu'a la demande, quand l'utilisateur ouvre une partie precise et clique
sur Review.

## Comportement utilisateur

Depuis l'onglet Historique :

1. chaque ligne de partie est cliquable ;
2. le clic appelle `GET /games/{game_id}` ;
3. l'app charge la partie dans le board existant ;
4. l'app appelle `GET /games/{game_id}/moves` pour alimenter la navigation ;
5. les boutons `<<`, `<`, `>`, `>>` permettent de naviguer dans les coups ;
6. l'ouverture est rechargee via `GET /games/{game_id}/opening` si disponible ;
7. le bouton Review reste disponible pour les parties terminees.

## Analyse a la demande

L'import PGN ne cree aucune ligne `position_analyses`.

Quand l'utilisateur clique "Voir la review" sur une partie importee :

- `POST /games/{game_id}/review/generate` utilise le pipeline Review existant ;
- les FEN deep manquantes sont creees seulement pour cette partie ;
- le backend retourne `pending`, `partial`, `done`, `stalled`,
  `not_reviewable` ou `no_significant_moments` selon les regles V5.1.8 ;
- aucun spinner infini ne doit apparaitre.

## Endpoints verifies

- `GET /games/history` retourne les `game_id` importes.
- `GET /games/{game_id}` rejoue les coups importes et retourne l'etat board.
- `GET /games/{game_id}/moves` reconstruit `fen_after` depuis `fen_before + uci`.
- `POST /games/{game_id}/review/generate` fonctionne sur une partie importee.
- `GET /games/{game_id}/review` utilise la meme logique que les parties locales.

## Backend

Les coups importes stockent :

- `ply`
- `fen_before`
- `uci`
- `san`

La table `moves` ne stocke pas `fen_after`. Le backend le reconstruit dans
`GET /games/{game_id}/moves` en rejouant chaque coup depuis `fen_before`.

La Review utilise les memes seuils et la meme state machine que pour les parties
locales :

- partie trop courte : `not_reviewable` ;
- deep manquantes avec travail actif : `pending` ;
- couverture suffisante mais incomplete : `partial` ;
- analyse complete sans moment : `done + empty_reason=no_significant_moments` ;
- deep failed sans couverture suffisante : `stalled/failed` avec details.

## Frontend

Ajouts principaux :

- client API `getGame(gameId)` ;
- `handleOpenHistoryGame(item)` dans `App.tsx` ;
- clic Historique -> charge la partie, les coups et l'ouverture ;
- retour automatique sur l'onglet Coups apres chargement ;
- indication "chargee sur l'echiquier" pour la partie selectionnee.

## Limites

- Pas de dashboard avance.
- Pas de sync Chess.com/Lichess.
- Pas de generation automatique de Review apres import.
- Pas d'analyse Stockfish automatique sur toutes les parties importees.
- Pas de V6, SRS, profil, recommandations, LLM ou Maia.

## Tests automatiques

Tests ajoutes/renforces :

- import PGN -> `position_analyses` reste vide ;
- historique retourne le `game_id` importe ;
- `GET /games/{game_id}` charge la partie importee ;
- `GET /games/{game_id}/moves` retourne les coups et `fen_after` reconstruit ;
- `POST /review/generate` cree des deep analyses uniquement a la demande ;
- le batch Review est dimensionne sur les FEN requises ;
- contrat frontend : clic historique charge `getGame`, `loadMoveHistory` et
  `loadOpeningClassification`.

## Protocole test manuel

1. Importer un PGN reviewable.
2. Ouvrir l'onglet Historique.
3. Cliquer la partie importee.
4. Verifier que le board affiche la position finale.
5. Utiliser `<<`, `<`, `>`, `>>` pour naviguer.
6. Verifier que l'ouverture s'affiche si elle est connue.
7. Cliquer "Voir la review".
8. Verifier que l'etat Review passe par V5.1.8 :
   `pending`, `partial`, `done`, `no_significant_moments`, `not_reviewable` ou
   `stalled/failed` clair.
9. Confirmer qu'aucune autre partie importee n'est analysee automatiquement.
