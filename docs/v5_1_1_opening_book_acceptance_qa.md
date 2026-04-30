# V5.1.1 Opening Book Acceptance QA

## Verdict

PASS.

Le book Lichess local est exploitable dans l'application, rapide sur le volume
actuel, et lisible cote UI. Aucune optimisation du classifieur n'est appliquee
en V5.1.1 parce que les mesures restent largement sous le seuil attendu.

## Etat du book

- Source locale: `backend/neurochess/data/sources/lichess_chess_openings`
- Fichiers TSV lus: `a.tsv`, `b.tsv`, `c.tsv`, `d.tsv`, `e.tsv`
- Lignes source lues: 3690
- Lignes ecrites dans `openings_book.json`: 3690
- Lignes invalides ignorees: 0
- Groupes `(name, variation)` dupliques: 264
- Lignes dupliquees desambiguisees: 531
- `opening_lines` apres import complet: 3690
- `opening_line_nodes` apres import complet: 39220

Exemple de nom desambiguise:

```text
Barnes Opening | Gedult Gambit (line 2a4f022f)
```

Le suffixe technique est stocke dans `variation`, pas dans `opening_name`.
L'UI V5.1 affiche `opening_name`, donc ce suffixe ne pollue pas l'affichage
actuel.

## EPD

`epd` existe dans `backend/neurochess/data/openings_book.json`.

Il n'est pas importe dans `opening_lines` ni `opening_line_nodes`, car le schema
V5 n'a pas de colonne `epd`.

Il n'est pas utilise par la classification. La source de verite du matching
reste `fen_key`, derive depuis les positions generees par `python-chess`.

Decision V5.1.1: conserver `epd` dans le JSON genere comme donnee source utile,
mais ne pas modifier le schema DB.

## Benchmark classification

DB temporaire locale:

- import complet: 3690 lignes, 39220 nodes;
- temps import observe: environ 11.0 s;
- classification moyenne: 88.35 ms;
- classification max: 91.62 ms.

Cas mesures:

| Cas | Resultat | ECO | Status | Matched plies | Temps observe |
| --- | --- | --- | --- | ---: | ---: |
| Italian Game | Italian Game | C50 | matched | 5 | 91.62 ms |
| Ruy Lopez | Ruy Lopez | C60 | matched | 5 | 87.09 ms |
| Sicilian Defense | Sicilian Defense | B54 | matched | 7 | 88.09 ms |
| French Defense | French Defense | C00 | matched | 4 | 88.56 ms |
| Caro-Kann | Caro-Kann Defense | B12 | matched | 4 | 88.34 ms |
| Queen's Gambit | Queen's Gambit | D06 | partial | 3 | 87.19 ms |
| London System | Queen's Pawn Game | D02 | matched | 5 | 88.67 ms |
| English Opening | English Opening | A10 | partial | 1 | 86.11 ms |
| Reti Opening | Reti Opening | A09 | partial | 3 | 91.32 ms |
| Empty game | unknown | null | unknown | 0 | test QA |

Le cas "London System" retourne `Queen's Pawn Game` avec ce book. Ce n'est pas
une erreur de performance ou de signe: c'est une consequence du matching
sequentiel V5 et des noms presents dans le book Lichess local.

## Decision performance

Le seuil attendu est idealement sous 300 ms par classification locale.

La mesure actuelle est sous 100 ms par partie. V5.1.1 ne change donc pas
l'algorithme.

Optimisation reportee si un book futur devient plus lourd:

- utiliser `opening_line_nodes(fen_key, ply)`;
- recuperer les `line_id` candidats par position;
- intersecter les candidats a chaque ply;
- appliquer ensuite le tie-break V5 existant.

Cette optimisation ne doit pas changer la semantique V5.

## UX

Le flux attendu est:

1. Si `opening_lines` est vide, le clic sur `Classifier l'ouverture` prepare le
   book local.
2. L'application importe `openings_book.json` si disponible.
3. Sinon, elle genere le book depuis la source locale Lichess.
4. Sinon, elle utilise le seed V5.
5. La partie est classifiee.

Le code UI actuel n'affiche plus le message bloquant
`Book d'ouvertures non importe`.

Messages actuels:

- `Preparation du book d'ouvertures...`
- `Book d'ouvertures local pret.`
- `Ouverture non reconnue par le book actuel.`

## Tests executes

Commandes:

```bash
C:\Users\grezo\AppData\Local\Python\bin\python.exe -m unittest discover backend/tests
cd frontend
npm run build
```

Resultats attendus apres V5.1.1:

- backend: tous les tests passent;
- frontend: build production passe.

## Limites restantes

- Pas de transpositions avancees.
- Pas d'explorer d'ouvertures.
- Pas de revision d'ouverture.
- Pas de SRS.
- Pas de profil joueur.
- Pas de recommandations.
- Pas de statistiques de popularite.
- Pas de V6.
