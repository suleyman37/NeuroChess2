# V5.1 Lichess Opening Book

## Objectif

V5.1 remplace le petit seed interne V5 par un book local plus complet issu de
`lichess-org/chess-openings`.

La source est locale:

`backend/neurochess/data/sources/lichess_chess_openings`

Aucun telechargement, appel Lichess, API externe ou appel reseau n'est effectue
au runtime.

## Source et licence

Fichiers utilises:

- `a.tsv`;
- `b.tsv`;
- `c.tsv`;
- `d.tsv`;
- `e.tsv`;
- `README.md`;
- `COPYING.txt`.

Le format TSV local observe est:

```text
eco	name	pgn
```

La licence detectee localement est:

`CC0 1.0 Universal`

## Generation openings_book.json

Commande:

```bash
python -m backend.tools.prepare_lichess_openings
```

Sortie generee:

`backend/neurochess/data/openings_book.json`

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

Chaque entree contient:

- `eco_code`;
- `name`;
- `variation`;
- `color`;
- `moves_uci`;
- `target_depth_plies`;
- `epd`;
- `source`.

Le PGN source est converti en UCI avec `python-chess`.
`target_depth_plies` vaut toujours `len(moves_uci)`.

Si le contenu du book ne change pas, `generated_at` est conserve.

## Doublons Lichess

Le dataset Lichess contient plusieurs lignes avec le meme nom visible.
La DB V5 impose `UNIQUE(name, variation)`.

V5.1 conserve le schema DB et ajoute une desambiguïsation deterministe aux
variations dupliquees:

```text
Variation (line <sha1-8>)
```

Ce suffixe n'est pas une donnee pedagogique. Il sert seulement a conserver
toutes les lignes locales sans changer le schema V5.

## Import DB

Endpoint:

```text
POST /openings/import-book
```

Service:

```python
OpeningService.import_opening_book()
```

Politique:

- cree les nouvelles `opening_lines`;
- conserve les `line_id` existants;
- met a jour les metadonnees si necessaire;
- reconstruit les nodes seulement si la sequence change;
- ne supprime pas les lignes absentes du nouveau book;
- retourne `created`, `updated`, `unchanged`, `kept_orphan`,
  `nodes_created`, `nodes_deleted`, `skipped_invalid`.

`POST /openings/import-seed` reste disponible comme endpoint legacy/dev.

## Classification

L'algorithme V5 est conserve:

- matching par `fen_key`;
- matching sequentiel;
- pas de transpositions complexes;
- pas de Stockfish;
- pas d'explorer.

Quand `opening_lines` est vide et que l'utilisateur clique pour classifier:

1. importer `openings_book.json` s'il existe;
2. sinon generer `openings_book.json` depuis la source locale Lichess si elle existe;
3. sinon utiliser le fallback `openings_seed.json`.

## Difference V5 / V5.1

V5:

- petit seed interne;
- environ quelques dizaines de lignes;
- utile pour valider le modele de donnees.

V5.1:

- book local enrichi;
- 3690 lignes generees depuis les TSV locaux;
- 39220 nodes importes en DB lors d'un import complet;
- 0 ligne invalide detectee dans la source locale actuelle;
- 531 lignes desambiguisees pour respecter `UNIQUE(name, variation)`;
- toujours offline;
- toujours sans enseignement d'ouverture.

## Performance observee

QA V5.1.1 sur DB temporaire locale:

- classification moyenne sur 10 cas: 88.35 ms;
- classification max observee: 91.62 ms;
- seuil attendu: idealement moins de 300 ms.

Le classifieur V5.1 reste donc tel quel. L'optimisation par intersection de
candidats `(fen_key, ply)` est reportee uniquement si un book futur depasse
300 ms moyen ou 1 s max.

## Politique EPD

`epd` est conserve dans `openings_book.json` comme donnee issue de la position
finale de chaque ligne.

`epd` n'est pas importe en DB et n'est pas utilise pour classifier.

La classification NeuroChess reste basee sur:

- les nodes generes avec `python-chess`;
- leur `fen_key` normalisee;
- le matching sequentiel V5.

## Lisibilite des doublons

Les suffixes techniques `(line <sha1-8>)` sont ajoutes seulement a `variation`
quand le couple `(name, variation)` serait duplique.

L'API et l'UI affichent aujourd'hui `opening_name`, pas `variation`. Les suffixes
ne sont donc pas visibles dans l'interface actuelle.

## Limites restantes

- Pas de revision d'ouvertures.
- Pas de SRS.
- Pas de profil joueur.
- Pas de recommandations.
- Pas d'opening explorer.
- Pas de statistiques de popularite.
- Pas de Practical Performance visible.
- Pas de LLM.
- Pas de Maia/Lc0.
- Matching sequentiel uniquement.
- Les transpositions complexes restent reportees a une version ulterieure.
