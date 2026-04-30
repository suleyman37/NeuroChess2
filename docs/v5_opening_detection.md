# V5 Opening Detection

## Objectif

V5 ajoute la fondation ouvertures de NeuroChess: reconnaitre une ouverture ou
une ligne theorique et detecter jusqu'ou la partie suit le livre.

V5 ne fait pas de revision d'ouverture, pas de SRS, pas de recommandations, pas
de profil joueur, pas de LLM et aucun appel moteur.

## Tables ajoutees

### opening_lines

Represente une ouverture ou une ligne theorique.

Champs principaux:

- `eco_code`;
- `name`;
- `variation`;
- `color`;
- `parent_line_id`;
- `target_depth_plies`;
- `pgn_canonical`;
- `source`.

`color` est seulement une metadonnee V5:

- `white`: ligne de repertoire blanc;
- `black`: ligne de repertoire noir;
- `both`: ligne neutre;
- `null`: non determine.

`color` n'influence jamais la classification V5.

### opening_line_nodes

Represente les positions successives d'une ligne.

Chaque node stocke:

- `ply`;
- FEN complete;
- `fen_key` normalisee;
- coup attendu UCI/SAN depuis cette position;
- alternatives JSON, vide en V5.

### game_opening_classifications

Stocke une classification unique par `game_id`.

Champs principaux:

- `line_id`;
- `opening_name`;
- `eco_code`;
- `matched_plies`;
- `last_book_ply`;
- `out_of_book_ply`;
- `out_of_book_color`;
- `out_of_book_fen`;
- `confidence`;
- `classification_status`.

Relancer une classification met a jour la ligne existante.

## Seed local

Le seed interne est:

`backend/neurochess/data/openings_seed.json`

Format strict:

```json
{
  "schema_version": "openings_seed_v1",
  "lines": [
    {
      "eco_code": "C50",
      "name": "Italian Game",
      "variation": "Main Line",
      "color": "both",
      "moves_uci": ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"],
      "target_depth_plies": 5,
      "parent_line_name": null,
      "note": null
    }
  ]
}
```

Regles:

- `schema_version` doit valoir `openings_seed_v1`;
- `moves_uci` part toujours de la position initiale;
- `target_depth_plies == len(moves_uci)`;
- chaque UCI est valide selon `python-chess`;
- `parent_line_name`, s'il existe, doit pointer vers une ligne du seed;
- un seed invalide echoue sans corrompre le book existant.

Le seed V5 contient un petit book mainstream interne, volontairement limite.

## Book local V5.1

V5.1 ajoute un book local enrichi issu de `lichess-org/chess-openings`.

Source locale:

`backend/neurochess/data/sources/lichess_chess_openings`

Fichier genere:

`backend/neurochess/data/openings_book.json`

Commande de generation:

```bash
python -m backend.tools.prepare_lichess_openings
```

Schema:

```json
{
  "schema_version": "openings_book_v1",
  "source": "lichess-org/chess-openings",
  "source_license": "CC0 1.0 Universal",
  "generated_at": "...",
  "lines": []
}
```

Le dossier local fourni contient `a.tsv` a `e.tsv` avec les colonnes
`eco`, `name`, `pgn`. V5.1 convertit le PGN en `moves_uci` avec
`python-chess` et derive `epd` depuis la position finale.

Le book V5.1 reste entierement offline:

- aucun telechargement runtime;
- aucun appel Lichess;
- aucune API externe;
- aucun appel Stockfish.

Le seed V5 reste disponible comme fallback legacy/dev si le book local est
absent.

## fen_key

La detection se fait sur `fen_key`, pas sur SAN ni sur nom d'ouverture.

`fen_key` conserve:

- placement des pieces;
- trait;
- droits de roque;
- case en passant.

`fen_key` ignore:

- halfmove clock;
- fullmove number.

Exemple:

```text
FEN     rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1
fen_key rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -
```

## Import idempotent

`import_opening_seed()`:

- cree les lignes absentes;
- conserve les `opening_lines.id` existants;
- reconstruit seulement les nodes d'une ligne dont la sequence change;
- met a jour les metadonnees si necessaire;
- ne supprime pas les lignes absentes du nouveau seed;
- retourne `created`, `updated`, `unchanged`, `kept_orphan`,
  `nodes_created`, `nodes_deleted`.

Cette politique evite de casser de futures references vers `line_id`.

## Classification

V5 utilise un matching sequentiel:

1. construire les positions de partie: `ply 0 = initial_fen`, puis `fen_after`
   de chaque coup;
2. normaliser chaque position en `fen_key`;
3. comparer chaque ligne node par node depuis `ply 0`;
4. mesurer `matched_plies` comme le dernier ply consecutif matche;
5. choisir la meilleure ligne.

Tie-break:

1. maximiser `matched_plies`;
2. minimiser `abs(target_depth_plies - matched_plies)`;
3. a egalite, preferer `target_depth_plies >= matched_plies`;
4. a egalite, choisir l'id le plus petit.

Sortie de livre:

- `last_book_ply = matched_plies`;
- `out_of_book_ply = matched_plies + 1` si la partie continue;
- `out_of_book_color` vient du trait avant le coup de deviation;
- `out_of_book_fen` est `fen_before` du coup de deviation.

## Seuils

Confidence:

- `high`: `matched_plies >= 8`;
- `medium`: `matched_plies >= 4`;
- `low`: `matched_plies > 0`;
- `unknown`: `matched_plies == 0`.

Status:

- `matched`: `matched_plies >= 4`;
- `partial`: `0 < matched_plies < 4`;
- `unknown`: `matched_plies == 0`;
- `failed`: exception pendant classification.

## Endpoints

### POST /openings/import-seed

Importe le seed local. Endpoint local/dev, sans auth en V5.

### POST /openings/import-book

Importe `openings_book.json`, le book local enrichi V5.1.

Retourne les compteurs `created`, `updated`, `unchanged`, `kept_orphan`,
`nodes_created`, `nodes_deleted` et `skipped_invalid`.

### POST /games/{game_id}/opening/classify

Classifie explicitement une partie existante.

En V5.1, si la table `opening_lines` est vide, la classification peut preparer
le book local de facon controlee:

1. importer `openings_book.json` s'il existe;
2. sinon le generer depuis la source locale Lichess si elle existe;
3. sinon utiliser le seed V5.

### GET /games/{game_id}/opening

Retourne une classification existante. Ne classifie pas automatiquement.

## UI

V5 est backend/infrastructure only. Aucune nouvelle UI d'ouverture n'est ajoutee
pour eviter de transformer la reconnaissance en enseignement ou en
recommandation.

## Limites connues V5

- Book interne petit.
- Pas de base Lichess ou Chess.com.
- Pas d'API externe.
- Pas d'explorer.
- Matching sequentiel uniquement.
- Pas de transpositions complexes.
- ECO absent possible si incertain.
- Pas de revision.
- Pas de SRS.
- Pas de mastery score.
- Pas de Practical Performance visible.
- Pas de recommandation.
- Pas de classification pedagogique de l'erreur d'ouverture.

Ces sujets appartiennent a des versions futures.
