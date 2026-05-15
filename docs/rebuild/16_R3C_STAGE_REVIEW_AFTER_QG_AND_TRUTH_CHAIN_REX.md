# R3C Stage Review After QG and Truth Chain — NeuroChess REX

## 1. Statut

Statut :
Bilan stratégique après R3B.

But :
Décider la prochaine étape de REX après avoir sécurisé :
- Parties / Truth Chain ;
- QG / Mission Core ;
- backend read-only moments ;
- frontend read-only integration ;
- fallback moves-only ;
- no unsafe `/review` ;
- no write methods.

R3C ne code rien.
R3C décide la suite.

## 2. Ce qui est maintenant acquis

### QG

- Mission Core read-only.
- Mission proposée depuis données existantes.
- Truth-chain moments -> "Revoir les moments détectés".
- Moves-only -> "Explorer la dernière partie lue".
- Empty -> "Importer une partie" prototype/non-mutating.
- Degraded -> lecture indisponible.
- Aucun Daily Plan réel.
- Aucune mutation.

### Parties

- Historique read-only.
- Route backend `GET /games/{game_id}/truth-chain/moments`.
- Frontend connecté à cette route.
- Distinction claire entre moments persistés, fallback moves-only et état degraded.
- Mini-board read-only.
- Aucun appel direct à `/games/{game_id}/review`.
- Aucun `POST`, `PATCH`, `PUT` ou `DELETE`.

### Labs / DA

- Design Lab disponible.
- FX Lab disponible.
- Direction hybride retenue.
- Doctrine confirmée : donnée d'abord, effet ensuite.

### Gouvernance

- Contrats docs présents dans `docs/rebuild`.
- Smokes REX en place.
- Tests backend validés après restauration locale de `openings_book.json`.
- Migration nouveau PC réussie.
- `road-to-V2` propre après intégration R3B.

## 3. Ce qui n'est PAS encore acquis

- Forge réelle non branchée.
- Aucune vraie transformation erreur -> drill.
- Aucun entraînement actif depuis REX.
- Aucune session Practice REX réelle.
- Aucune révision réelle dans REX.
- Aucun `due_at` piloté par REX.
- Aucun Training Queue REX.
- Profil réel non branché.
- Arène / Transfer réel non branché.
- Opening Forge non branchée.
- Import PGN REX non branché.
- XP / rang / ligues non branchés.
- Boucle complète non acquise : jouer -> review -> drill -> révision -> transfert.

## 4. Évaluation du produit actuel

### Forces

- REX n'est plus un simple shell.
- QG répond partiellement à "que faire maintenant ?".
- Parties répond partiellement à "d'où vient la matière ?".
- Lecture réelle mais prudente.
- Side effects évités.
- Esthétique stable.
- Discipline Codex solide.

### Faiblesses

- QG dépend encore fortement de Parties.
- Forge est absente, donc REX n'offre pas encore d'action d'entraînement.
- Beaucoup de surfaces restent placeholders.
- CTA import, forge et profil encore prototypes.
- Shell encore card-based.
- Pas encore de vraie boucle comportementale.
- Pas encore d'addiction produit.
- Pas encore de valeur quotidienne complète.

Scores sur 10 :

| Axe | Score | Lecture |
| --- | ---: | --- |
| Fondation technique | 8 | Les routes read-only, smokes et preuves réseau donnent une base saine. |
| Clarté produit | 7 | QG + Parties clarifient la matière et la priorité, mais la suite d'entraînement manque. |
| DA actuelle | 7 | Direction hybride stable, encore parfois trop card-based et prototype. |
| Utilité utilisateur immédiate | 4 | L'utilisateur voit quoi regarder, mais ne peut pas encore s'entraîner réellement depuis REX. |
| Potentiel long terme | 9 | La chaîne partie -> décision -> entraînement -> transfert devient crédible. |
| Risque de surconstruction | 8 | Forge, Profil et Arène peuvent vite produire du faux signal si ouverts trop tôt. |

## 5. Prochaine étape — options

### Option A — Polish QG / Parties

But :
Améliorer visuel et microcopy de ce qui existe.

Avantages :
- Améliore les surfaces déjà réelles.

Risques :
- Polish infini.
- Ne crée pas de nouvelle valeur.

Verdict :
À éviter sauf bug bloquant.

### Option B — Forge contract-first

But :
Préparer la surface qui transforme les moments en entraînement.

Avantages :
- Suite naturelle après QG + Parties.
- Cœur de la promesse NeuroChess.
- Répond à "comment je progresse concrètement ?".

Risques :
- Touche vite `training_items`, Practice et `due_at`.
- Gros risque side effect.
- Risque de faux entraînement.

Verdict :
Recommandé en docs-only contract avant tout code.

### Option C — Profil read-only

But :
Afficher progression, répertoire, habitudes.

Avantages :
- Désirable et motivant.

Risques :
- Métriques prématurées.
- Fake progression.
- Dashboard personnel creux.

Verdict :
Trop tôt avant Forge.

### Option D — Arène / Transfer

But :
Vérifier transfert en vraie partie.

Avantages :
- Différenciation forte.

Risques :
- Données insuffisantes.
- Score fragile.
- Logique trop tôt.

Verdict :
Trop tôt.

### Option E — Import PGN REX

But :
Permettre d'ajouter de nouvelles parties depuis REX.

Avantages :
- Rend Parties autonome.

Risques :
- Pipeline import/analyse/review complexe.
- Side effects.
- Scope large.

Verdict :
Important, mais pas avant contrat dédié.

### Option F — Refactor CSS/components

But :
Réduire dette frontend REX.

Avantages :
- Utile car CSS grossit.

Risques :
- Valeur utilisateur faible.
- Peut devenir refactor tunnel.

Verdict :
À faire plus tard, quand une vraie douleur apparaît.

## 6. Recommandation

Recommandation principale :
`R3D_FORGE_READONLY_CONTRACT`.

Pourquoi :
Après QG et Parties, la suite naturelle est Forge :
- QG dit quoi faire.
- Parties montre la matière.
- Forge doit transformer la matière en entraînement.

Mais Forge est dangereux.
Donc R3D doit être un contrat docs-only, pas du code.

## 7. R3D Forge Contract — direction proposée

R3D doit définir comment Forge pourra lire des données existantes sans créer de side effects.

Sources candidates :
- Truth-chain moments read-only.
- `training_items` existants en lecture seule uniquement si route/service safe.
- Moves-only fallback.
- Existing practice/session routes uniquement si preuve anti-mutation.
- No Daily Plan.
- No `due_at` mutation.

Forge REX doit répondre :
"Comment je transforme cette erreur / décision / position en entraînement ?"

Mais R3D/R3E ne doivent pas encore :
- créer `training_items` ;
- créer `practice_attempts` ;
- modifier `due_at` ;
- générer Daily Plan ;
- lancer analyse ;
- importer PGN ;
- créer XP/rang ;
- créer Transfer Score ;
- exposer une métrique non validée ;
- appeler `/games/{game_id}/review` ;
- prétendre maîtriser une compétence.

## 8. R3D risques à verrouiller

- Route Practice unsafe.
- Route training item unsafe.
- Training item side effect.
- Création implicite de session.
- Mutation `due_at`.
- Mutation Daily Plan.
- Faux drill disponible.
- Confusion Review moment vs exercice réel.
- Bouton "S'entraîner" qui ne fait rien.
- Trop de texte.
- UI Forge trop RPG cheap.
- XP/rang prématurés.
- Métrique non validée présentée comme vérité utilisateur.

## 9. R3D résultat attendu

R3D doit produire un document contractuel :

`docs/rebuild/17_R3D_FORGE_READONLY_CONTRACT_REX.md`

Il doit définir :
- sources safe ;
- view-model Forge ;
- états UX ;
- actions autorisées/interdites ;
- network contract ;
- smoke R3E futur ;
- screenshots attendus ;
- GO/NO-GO.

## 10. Alternative si humain refuse Forge

Alternative :
`R3D_QG_PARTIES_POLISH_CONTRACT`.

Seulement si :
- QG/Parties sont jugés trop faibles visuellement ;
- l'utilisateur veut consolider avant d'ouvrir Forge.

Mais recommandation principale :
Forge contract-first.

## 11. Décision finale

Recommended next mission:
`R3D_FORGE_READONLY_CONTRACT`

Do not start Forge implementation yet.
Do not start Profil.
Do not start Arène.
Do not start XP/rank.

`GO_FOR_R3D_AFTER_HUMAN_REVIEW: pending`
