# R2K Frontend Truth Chain Moments Integration Contract - NeuroChess REX

## 1. Statut

Statut :
Contrat frontend pour future mission R2L.

But :
Definir comment integrer la route backend read-only :

```text
GET /games/{game_id}/truth-chain/moments
```

dans REX Parties / Truth Chain, sans side effect et sans casser le fallback moves-only.

R2K ne code rien.
R2K prepare R2L.

## 2. Decision

R2L doit consommer la nouvelle route read-only quand un `gameId` est disponible.

Regle :

- route `truth-chain/moments` disponible + moments persistes => utiliser moments reels ;
- route disponible mais `moments: []` => fallback moves-only ;
- route indisponible / erreur => fallback actuel degraded ou moves-only selon contexte ;
- jamais appeler `/games/{game_id}/review` depuis REX.

Le backend R2J a rendu disponible :

```text
GET /games/{game_id}/truth-chain/moments
```

Cette route est dediee a la Truth Chain REX et separee de la route Review unsafe.

## 3. Non-objectifs R2L

R2L ne doit PAS :

- modifier backend ;
- modifier `docs/rebuild/` ;
- modifier plans ;
- creer `training_items` ;
- creer `practice_attempts` ;
- modifier Daily Plan ;
- modifier `due_at` ;
- declencher analyse ;
- importer PGN ;
- creer XP ;
- creer Transfer Score ;
- creer Opening Mastery ;
- exposer raw WDL ;
- exposer centipawn loss brut ;
- exposer `criticality_score` ;
- exposer `diagnostic_gap` ;
- exposer ETV ;
- ajouter Spline / WebGL ;
- ajouter dependance.

R2L est une integration frontend read-only.
Elle ne doit pas transformer la nouvelle route backend en nouvelle feature produit large.

Perimetre autorise R2L :

- `frontend/src/rex/**` ;
- eventuellement `frontend/src/api/client.ts` ;
- le smoke REX dedie.

R2L ne doit pas modifier :

- `backend/` ;
- `docs/rebuild/` ;
- `plan/` ;
- `package.json` ;
- `package-lock.json` ;
- `App.tsx`.

## 4. Frontend route / client contract

R2L doit d'abord verifier `frontend/src/api/client.ts`.

Ajouter si necessaire une fonction client dediee :

```ts
getTruthChainMoments(gameId)
```

Elle doit appeler exactement :

```text
GET /games/{game_id}/truth-chain/moments
```

Elle ne doit jamais appeler :

```text
GET /games/{game_id}/review
```

Elle ne doit jamais faire :

```text
POST
PATCH
PUT
DELETE
```

Sources de verite actuelles :

- backend route : `backend/neurochess/api/game_routes.py:get_truth_chain_moments`
- backend service : `backend/neurochess/review_moments_readonly_service.py`
- backend tests : `backend/tests/test_truth_chain_readonly_route.py`
- frontend existing read-only routes :
  - `frontend/src/api/client.ts:getGameHistory`
  - `frontend/src/api/client.ts:getGameMoves`

R2L doit documenter dans son rapport les routes appelees, les methodes observees et la preuve qu'aucun appel `/review` unsafe n'a ete emis.

## 5. View-model contract

R2L doit adapter la reponse backend vers `RexTruthChainSnapshot`.

Si backend moments presents :

- `source` = `persisted_review_moment`, `persisted_training_item` ou `persisted_review_summary` selon payload ;
- `visualSeverity` = categorie qualitative backend ;
- `fenBefore` / `fenAfter` utilises pour mini-board ;
- `reviewAvailable` / `exerciseAvailable` depuis payload ;
- `routesUsed` inclut la route concrete appelee ;
- `limitations` conserve les limitations backend utiles ;
- `readOnlyProof` reste visible comme preuve declarative, sans remplacer les smokes reseau.

Si moments vide :

- fallback moves-only existant ;
- `limitations` indique `"no persisted review moments"` ou la limitation backend equivalente ;
- la UI ne doit jamais presenter les coups moves-only comme des moments critiques reels.

Si backend route echoue :

- afficher fallback degraded ;
- garder la page stable ;
- ne pas appeler `/games/{game_id}/review` pour compenser ;
- ne pas inventer de moments.

Mapping attendu vers les types REX :

```ts
type RexTruthChainMomentSource =
  | "review_moment"
  | "training_item"
  | "fixture"
  | "moves_only"
  | "unknown";
```

Mapping backend -> REX :

- `persisted_review_moment` -> `review_moment` ;
- `persisted_training_item` -> `training_item` ;
- `persisted_review_summary` -> `review_moment` ou `unknown` selon les donnees disponibles ;
- `none` -> fallback moves-only / `unknown`.

R2L doit ajouter ou ajuster le mapping uniquement dans `frontend/src/rex/**`.
Les types API existants ne doivent pas etre remplaces par les types REX.

## 6. UI contract

La Truth Chain doit distinguer visuellement :

1. Moments reels persistes

Label court :

```text
Moments Review lus
```

ou :

```text
Review moments
```

2. Moves-only fallback

Label court :

```text
Moves-only
```

ou :

```text
Moments a brancher
```

3. Degraded

Label court :

```text
Lecture indisponible
```

Important :

- ne jamais faire croire que moves-only = vrais moments critiques ;
- ne pas afficher de fausse gravite ;
- ne pas faire de l'etat degraded un panneau debug ;
- garder la Truth Chain comme instrument principal ;
- garder les details techniques dans un bloc discret ou replie.

Les moments reels doivent rendre la chaine plus echiqueenne que le fallback :

- noeuds avec SAN / ply / move number ;
- mini-board au focus ;
- gravite qualitative prudente ;
- source clairement lisible.

## 7. Mini-board contract

Conserver `RexMiniBoard` read-only.

Si `fenBefore` disponible :

- afficher la position avant le coup par defaut.

Si `fenAfter` est preferable :

- documenter le choix dans R2L ;
- ne pas alterner implicitement entre before et after sans label clair.

Si FEN absent :

- fallback `"position non disponible"` ;
- aucun crash ;
- aucun placeholder qui pretend afficher une position exacte.

Interdit :

- coup jouable ;
- drag / drop ;
- click de move ;
- analyse ;
- reveal ;
- practice attempt ;
- training item creation.

Le focus clavier doit rester visible et la lens doit rester lisible au-dessus du fold si possible.

## 8. Network contract

R2L peut appeler uniquement :

```text
GET /games/history?limit=50&offset=0&scope=mine
GET /games/{game_id}/moves
GET /games/{game_id}/truth-chain/moments
```

Interdit :

- `/games/{game_id}/review`
- `POST`
- `PATCH`
- `PUT`
- `DELETE`
- Daily Plan
- training items creation
- practice attempt
- import
- analyze
- review generate
- review rebuild
- live analysis start / stop

Smoke R2L doit verifier :

- aucune methode write ;
- aucune route Review unsafe appelee ;
- aucune route `/games/{game_id}/review` appelee ;
- aucun endpoint Daily Plan / practice / import / analyze appele ;
- Design Lab et FX Lab restent accessibles.

## 9. UX states

R2L doit gerer :

- loading history ;
- loaded history + truth moments loading ;
- truth moments loaded ;
- truth moments empty -> moves-only fallback ;
- truth moments unavailable -> degraded / fallback ;
- degraded backend unavailable.

Aucune etape ne doit etre spinner-only.

Etat loaded avec moments persistes :

- signal court de moments Review lus ;
- maximum 5 noeuds au depart ;
- noeud focusable ;
- mini-board read-only ;
- visualSeverity qualitative ;
- read-only proof discret.

Etat moments empty :

- continuer a afficher la chaine moves-only R2H ;
- label moves-only visible ;
- limitation `"no persisted review moments"` visible ou accessible ;
- aucune fausse criticalite.

Etat unavailable :

- garder la page utilisable ;
- ne pas faire de retry agressif ;
- ne pas degrader vers `/review` ;
- expliquer sobrement que la lecture moments est indisponible.

## 10. Tests / smokes attendus R2L

Creer ou adapter un smoke :

```text
scripts/browser_rex_truth_chain_moments_integration_smoke.mjs
```

Le smoke doit prouver :

1. `/app?rex=1` charge.
2. Parties charge.
3. Mock / interception de `/games/history`.
4. Mock / interception de `/games/{game_id}/truth-chain/moments` avec 3 a 5 moments.
5. Truth Chain affiche `"moments Review"` ou equivalent.
6. Noeud focus affiche mini-board.
7. Aucun appel `/games/{game_id}/review`.
8. Aucun `POST` / `PATCH` / `PUT` / `DELETE`.
9. Fallback moves-only fonctionne si `moments: []`.
10. Degraded fonctionne si route moments echoue.
11. V1 route normale reste accessible.
12. Design Lab reste accessible.
13. FX Lab reste accessible.
14. Aucun texte interdit n'apparait.

Le smoke R2L doit echouer si `/games/{game_id}/review` apparait dans les requetes reseau, meme en `GET`.

Tests a lancer R2L :

- `git diff --check`
- frontend build
- `tsc`
- R2L smoke
- R2H real data smoke
- R2C loaded fixture smoke
- R2B read-only smoke
- shell smoke
- design lab smoke
- fx lab smoke
- V1 smoke

Textes / champs interdits dans UI REX :

- raw WDL
- centipawn loss brut
- `criticality_score`
- `diagnostic_gap`
- ETV
- XP gagne
- Transfer Score
- prediction Elo
- "tu es nul"
- "NeuroChess garantit"

## 11. Screenshots attendus R2L

R2L doit fournir :

- moments persisted loaded ;
- moves-only fallback ;
- node focus mini-board ;
- degraded state.

Les screenshots doivent etre crees dans un dossier QA externe, pas dans le repo.

Chaque screenshot doit permettre de distinguer :

- moments reels persistes ;
- moves-only fallback ;
- degraded / unavailable.

## 12. Risques

Risques a surveiller :

- confusion moments reels vs moves-only ;
- route Review unsafe appelee par accident ;
- `visualSeverity` surinterpretee ;
- mini-board FEN before / after ambigu ;
- frontend fallback trop complexe ;
- smoke reseau pas assez strict ;
- details techniques trop visibles dans la surface produit ;
- retry ou fallback qui appelle une route dangereuse ;
- nouvel etat UI qui masque les limitations backend ;
- regression du degraded state R2B / R2H.

Mitigations :

- labels courts mais explicites ;
- network assertions strictes ;
- aucune route `/review` depuis REX ;
- fallback moves-only conserve ;
- details techniques repliables ;
- screenshots loaded / fallback / degraded obligatoires.

## 13. GO / NO-GO

GO_FOR_R2L seulement si :

- ce contrat est valide ;
- repo clean ;
- R2L reste frontend / REX only ;
- route backend deja existante ;
- no `/review` unsafe call ;
- no write methods ;
- fallback moves-only conserve ;
- mini-board read-only conserve ;
- tests et smokes prouvent les trois etats : moments, fallback, degraded.

NO-GO_FOR_R2L si :

- R2L veut modifier backend ;
- R2L veut modifier `docs/rebuild/` ;
- R2L veut modifier plans ;
- R2L veut appeler `/games/{game_id}/review` ;
- R2L veut appeler `POST` / `PATCH` / `PUT` / `DELETE` ;
- R2L veut declencher analyse, import, practice ou Daily Plan ;
- R2L veut creer une nouvelle metrique ;
- R2L veut exposer des metrics interdites ;
- R2L veut rendre moves-only indistinguable des vrais moments Review.

GO_FOR_R2L_AFTER_HUMAN_REVIEW: pending
