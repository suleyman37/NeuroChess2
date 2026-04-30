# V5.1 Lichess Book Import Audit

## Resume

Statut initial: PASS pour une importation locale offline.

Le dossier local existe:

`backend/neurochess/data/sources/lichess_chess_openings`

Il contient les fichiers attendus:

- `a.tsv`: 791 lignes;
- `b.tsv`: 758 lignes;
- `c.tsv`: 1238 lignes;
- `d.tsv`: 550 lignes;
- `e.tsv`: 353 lignes;
- `README.md`;
- `COPYING.txt`;
- `Makefile`;
- `bin/gen.py`;
- `.github/workflows/lint.yml`.

Total observe: 3690 lignes TSV.

## Format TSV local

Les fichiers racine `a.tsv` a `e.tsv` utilisent un TSV strict avec les colonnes:

```text
eco	name	pgn
```

Colonnes disponibles:

- `eco`: code ECO;
- `name`: nom d'ouverture en anglais;
- `pgn`: sequence de coups SAN depuis la position initiale.

Colonnes absentes dans cette source racine:

- pas de colonne UCI;
- pas de colonne EPD/FEN;
- pas de colonne couleur;
- pas de popularite;
- pas de statistiques.

Le README local indique que `uci` et `epd` existent seulement dans le dossier genere `dist/`.
Le dossier local fourni est la racine du depot, donc V5.1 convertit `pgn` en `moves_uci` avec `python-chess`.

## Licence

Le README et `COPYING.txt` indiquent CC0.

Licence retenue pour `openings_book.json`:

`CC0 1.0 Universal`

## Conversion NeuroChess

Chaque ligne TSV est convertie en entree `openings_book_v1`:

- `eco_code` vient de `eco`;
- `name` et `variation` viennent de `name`;
- `moves_uci` est derive du PGN avec `python-chess`;
- `target_depth_plies = len(moves_uci)`;
- `epd` est derive de la position finale via `board.epd()`;
- `color = "both"` par defaut;
- `source = "lichess_chess_openings"`.

Si le nom Lichess contient `:`, la partie avant `:` devient `name` et la suite devient `variation`.
Sinon `variation = null`.

## Doublons

La table V5 `opening_lines` impose deja:

`UNIQUE(name, variation)`

Le dry-run local a detecte:

- 3159 paires uniques `(name, variation)`;
- 264 groupes dupliques;
- 531 lignes en surplus dans ces groupes;
- 3690 cles completes uniques si la sequence UCI est incluse.

Decision V5.1: ne pas modifier le schema DB.

Pour respecter `UNIQUE(name, variation)`, le generateur ajoute un suffixe stable aux variations dupliquees:

```text
Variation (line <sha1-8>)
```

ou, si la variation est absente:

```text
line <sha1-8>
```

Ce suffixe est seulement une desambiguïsation technique du book local.

## Risques Volume / Performance

Le book genere contient 3690 lignes et environ 1.85 MB de JSON.

Le volume reste raisonnable pour SQLite local:

- import offline;
- classification explicite;
- matching sequentiel V5 conserve;
- index `opening_line_nodes.fen_key` et `(line_id, ply)` deja presents.

V5.1 ne cree pas d'explorer d'ouvertures et ne fait pas de recherche reseau.

## Fallback

Si `openings_book.json` existe, NeuroChess l'importe.

Si `openings_book.json` est absent mais que la source locale Lichess existe, NeuroChess peut generer le book local puis l'importer.

Si la source locale Lichess est absente, NeuroChess garde le fallback V5 `openings_seed.json`.

## Impact V4 / V5

Aucun changement prevu sur:

- Stockfish;
- shallow/deep/live/calibration;
- review V4;
- `cp_loss`;
- `importance_score`;
- barre d'evaluation;
- classification sequentielle V5.

V5.1 enrichit seulement la source du book d'ouvertures.
