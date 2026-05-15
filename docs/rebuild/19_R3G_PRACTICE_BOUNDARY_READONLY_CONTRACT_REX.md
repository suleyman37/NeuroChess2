# R3G Practice Boundary Read-Only Contract - NeuroChess REX

## 1. Statut

Statut :
Contrat produit/technique pour definir la frontiere Practice apres Forge.

But :
Decider quelle est la plus petite action d'entrainement honnete et sure apres :
- QG read-only ;
- Parties / Truth Chain read-only ;
- Forge read-only preview.

R3G ne code rien.
R3G ne branche pas Practice.
R3G prepare une future mission R3H.

## 2. Decision centrale

Forge montre deja comment une matiere pourrait devenir entrainement.

La prochaine question n'est pas :
"Comment lancer Practice tout de suite ?"

La prochaine question est :
"Quelle frontiere empeche une preview Forge de creer accidentellement une session, une tentative, un due_at, un Daily Plan ou un faux drill ?"

Decision R3G :
R3H ne doit pas encore implementer Practice actif.
R3H peut seulement preparer une lecture read-only d'un exercice ou d'une position si une preuve anti-mutation existe.

## 3. Ce qui est acquis avant R3G

### QG

- Mission Core read-only ;
- mission proposee depuis donnees existantes ;
- truth moments / moves-only / empty / degraded ;
- no Daily Plan ;
- no due_at ;
- no training item creation.

### Parties / Truth Chain

- history read-only ;
- `GET /games/{game_id}/truth-chain/moments` ;
- fallback `GET /games/{game_id}/moves` ;
- mini-board read-only ;
- no unsafe `/games/{game_id}/review` ;
- no write methods.

### Forge

- read-only preview ;
- moments -> opportunites ;
- existing exercise detected sans Practice ;
- moves-only -> Forge non disponible ;
- empty/degraded states ;
- no false drill ;
- no Practice route ;
- no training item creation ;
- no due_at ;
- no XP/rang/Transfer Score.

## 4. Ce qui n'est PAS acquis

- aucune session Practice REX ;
- aucun lancement d'exercice depuis Forge ;
- aucun detail d'exercice existant branche dans REX ;
- aucun training item cree depuis Forge ;
- aucune tentative Practice creee ;
- aucun resultat enregistre ;
- aucune solution revelee depuis REX Forge ;
- aucun due_at pilote par REX ;
- aucun Daily Plan pilote par REX ;
- aucun XP/rang/Transfer Score ;
- aucune boucle complete :
  jouer -> review -> Forge -> Practice -> revision -> transfert.

## 5. Audit route Practice / Training / Daily Plan

Audit statique observe dans `backend/neurochess/api/game_routes.py`,
`review_practice_service.py`, `daily_plan_service.py` et
`training_item_service.py`.

### Route Review unsafe

`GET /games/{game_id}/review`

Statut :
interdite pour REX read-only.

Raison :
le handler peut appeler `_ensure_training_items_for_review_payload`, qui appelle
`TrainingItemService.ensure_training_items_for_game`. Ce service peut inserer ou
mettre a jour `training_items`.

Conclusion :
ne jamais l'utiliser pour R3H/R3I read-only.

### Route Truth Chain moments

`GET /games/{game_id}/truth-chain/moments`

Statut :
source read-only principale deja autorisee.

Preuve :
tests backend anti-mutation existants, dont `test_truth_chain_readonly_route`,
verifient que les appels repetes ne mutent pas `training_items`,
`review_practice_attempts`, `daily_plan_items` ni `due_at`.

Conclusion :
autorisee comme source Forge/Practice-boundary.

### Routes Practice sessions

`POST /games/{game_id}/review/practice/sessions`

Statut :
interdite pour R3H read-only.

Effet :
cree une `review_practice_session`.

`GET /games/{game_id}/review/practice/sessions`

Statut :
candidate read-only, mais non autorisee en R3H tant qu'un contrat dedie ne
prouve pas :
- no session creation ;
- no attempt creation ;
- no due_at mutation ;
- no scoring write ;
- no hidden review/training ensure.

`GET /review/practice/sessions/{session_id}`

Statut :
candidate read-only pour detail d'une session deja existante, mais non autorisee
par defaut en R3H.

Risque :
peut introduire une confusion "exercice disponible" vs "session deja creee".

### Routes Practice attempts

`POST /review/practice/sessions/{session_id}/attempts`

Statut :
interdite.

Effet :
cree une `review_practice_attempt`, calcule un feedback, enregistre un resultat,
et peut produire un `due_at`.

`POST /review/practice/sessions/{session_id}/complete`
`POST /review/practice/sessions/{session_id}/abandon`
`POST /review/practice/sessions/{session_id}/retry-failed`
`POST /games/{game_id}/review/practice/revisions`

Statut :
interdites pour R3H.

Effet :
session mutation, nouvelle session, ou transition d'etat.

### Routes Daily Plan

`GET /api/training/daily-plan/today`

Statut :
candidate read-only technique, mais interdite pour REX R3H.

Raison :
elle lit le plan existant sans creation directe, mais appartient a une surface
Daily Plan qui doit rester hors Forge/Practice-boundary tant qu'un contrat QG /
Daily Plan dedie n'existe pas.

`POST /api/training/daily-plan`

Statut :
interdite.

Effet :
peut creer `daily_plan_items`.

`POST /api/training/daily-plan/practice`

Statut :
interdite.

Effet :
peut creer une session Practice depuis des training items de Daily Plan.

### Training item service

`TrainingItemService.ensure_training_items_for_game`

Statut :
interdit pour REX read-only.

Effet :
peut inserer ou mettre a jour `training_items`.

`TrainingItemService.list_items_for_game`
`TrainingItemService.get_items_by_ids`

Statut :
candidates read-only, mais non routes REX publiques suffisantes aujourd'hui.

Conclusion :
ne pas les exposer depuis REX sans contrat backend read-only dedie.

## 6. Boundary produit

R3H doit distinguer quatre niveaux :

1. Forge opportunity
- moment ou position lu depuis Truth Chain ;
- aucun exercice promis ;
- action : "Voir la position" ou "Preparer la Forge".

2. Existing exercise signal
- `exerciseAvailable=true` lu depuis Truth Chain ;
- signifie seulement qu'un exercice/training item semble deja persiste ;
- ne lance pas Practice ;
- ne revele pas solution ;
- ne cree rien.

3. Existing exercise detail read-only
- futur possible uniquement si une route read-only dediee existe ;
- doit afficher position, source, limites, statut ;
- ne doit pas creer session ni tentative.

4. Active Practice
- session creee ;
- tentative possible ;
- feedback/scoring ;
- due_at potentiel ;
- revision ;
- hors scope R3H tant qu'un contrat write-sensitive n'est pas valide.

## 7. Actions autorisees R3H

R3H peut autoriser :

- selectionner une opportunite Forge ;
- afficher position/FEN/SAN/UCI read-only ;
- naviguer vers Parties / Truth Chain ;
- afficher une preuve read-only ;
- afficher "exercice existant detecte" si le signal vient de Truth Chain ;
- afficher "detail indisponible" si aucune route safe n'existe ;
- garder le CTA en preview/prototype.

## 8. Actions interdites R3H

R3H ne doit pas :

- appeler `GET /games/{game_id}/review` ;
- appeler `POST /games/{game_id}/review/practice/sessions` ;
- appeler `POST /review/practice/sessions/{session_id}/attempts` ;
- appeler `POST /review/practice/sessions/{session_id}/complete` ;
- appeler `POST /review/practice/sessions/{session_id}/abandon` ;
- appeler `POST /review/practice/sessions/{session_id}/retry-failed` ;
- appeler `POST /games/{game_id}/review/practice/revisions` ;
- appeler `POST /api/training/daily-plan` ;
- appeler `POST /api/training/daily-plan/practice` ;
- creer `training_items` ;
- creer `review_practice_sessions` ;
- creer `review_practice_attempts` ;
- modifier `due_at` ;
- modifier Daily Plan ;
- lancer scoring ;
- enregistrer resultat ;
- reveler solution ;
- importer PGN ;
- lancer analyse ;
- creer XP/rang/Transfer Score ;
- exposer une metrique non validee.

## 9. Routes autorisees / interdites R3H

### Autorisees

Autorisees pour R3H :
- `GET /games/history`
- `GET /games/{game_id}/truth-chain/moments`
- `GET /games/{game_id}/moves` si fallback necessaire

Autorisees seulement apres contrat backend dedie :
- `GET /games/{game_id}/review/practice/sessions`
- `GET /review/practice/sessions/{session_id}`
- une future route `GET /training-items/{id}/readonly` si elle existe et prouve
  no ensure/create.

### Interdites

Interdites pour R3H :
- `/games/{game_id}/review`
- toute route Practice `POST`
- toute route Daily Plan
- import/analyze/review generate/rebuild
- training item ensure/create
- `POST/PATCH/PUT/DELETE`

## 10. View-model recommande

```ts
type RexPracticeBoundarySnapshot = {
  backendStatus: "loading" | "ready" | "empty" | "unavailable";
  source:
    | "truth_chain_moments"
    | "existing_exercise_signal"
    | "moves_only"
    | "unavailable";
  boundaryState:
    | "preview_only"
    | "existing_exercise_signal_only"
    | "read_only_detail_possible"
    | "practice_blocked"
    | "degraded";
  opportunities: RexPracticeBoundaryOpportunity[];
  allowedActions: string[];
  forbiddenActions: string[];
  readOnlyProof: {
    routesUsed: string[];
    methodsObserved: string[];
    writesObserved: boolean;
    reviewRouteTouched: boolean;
    practiceRouteTouched: boolean;
    dailyPlanTouched: boolean;
    trainingItemsCreated: boolean;
    practiceSessionsCreated: boolean;
    practiceAttemptsCreated: boolean;
    dueAtTouched: boolean;
    scoringTouched: boolean;
  };
  limitations: string[];
};

type RexPracticeBoundaryOpportunity = {
  id: string;
  gameId?: string;
  title: string;
  subtitle?: string;
  fenBefore?: string;
  fenAfter?: string;
  san?: string;
  uci?: string;
  source: "truth_chain_moment" | "moves_only" | "existing_exercise_signal";
  actionStatus: "preview_only" | "blocked" | "read_only_detail_candidate";
  actionLabel: string;
  exerciseSignal: boolean;
  limitations: string[];
};
```

## 11. UX copy contract

Copies autorisees :
- "Signal d'exercice existant"
- "Detail read-only non branche"
- "Voir la position"
- "Practice bloque pour l'instant"
- "Aucune tentative creee"
- "Aucun due_at modifie"
- "Aucun resultat enregistre"
- "Preview uniquement"

Copies interdites :
- "Commencer l'entrainement"
- "S'entrainer maintenant"
- "Tentative creee"
- "Exercice pret" sans preuve de detail existant
- "Drill pret"
- "Revision programmee"
- "Plan genere"
- "XP a gagner"
- "Rang"
- "Transfer Score"
- "Competence maitrisee"

## 12. Smoke R3H attendu

Futur smoke :
`scripts/browser_rex_practice_boundary_readonly_smoke.mjs`

Scenarios :

1. Truth Chain moment sans exercice
- affiche "Practice bloque pour l'instant" ;
- action "Voir la position" ;
- no Practice route ;
- no Daily Plan route ;
- no `/review` ;
- no write method.

2. Truth Chain moment avec `exerciseAvailable=true`
- affiche "Signal d'exercice existant" ;
- ne dit pas "S'entrainer maintenant" ;
- ne lance pas Practice ;
- no Practice route ;
- no write method.

3. Moves-only fallback
- affiche "Detail read-only non disponible" ;
- aucun exercice invente.

4. Empty
- CTA prototype/non-mutating.

5. Degraded
- etat lisible, sans appel de secours dangereux.

Network assertions :
- `GET /games/{game_id}/truth-chain/moments` observe dans scenarios truth-chain ;
- no `/games/{game_id}/review` meme en GET ;
- no route contenant `/practice` en R3H baseline ;
- no route Daily Plan ;
- no import/analyze/rebuild ;
- no `POST/PATCH/PUT/DELETE`.

## 13. Anti-mutation proof requis pour ouvrir plus tard

Avant toute mission qui lirait un detail d'exercice existant :

- test backend repetant l'appel et comparant counts de :
  - `training_items` ;
  - `review_practice_sessions` ;
  - `review_practice_attempts` ;
  - `daily_plan_items` ;
  - `due_at` existants.
- route audit prouvant aucune fonction `ensure_training_items_for_game` ;
- route audit prouvant aucune creation session/tentative ;
- smoke reseau GET-only ;
- snapshot DB before/after si backend touche.

Avant toute mission Practice active :

- contrat write-sensitive separe ;
- DB snapshot before/after ;
- tests de creation session ;
- tests de record attempt ;
- tests due_at ;
- tests export/delete ;
- rollback et migration policy ;
- UX anti-tilt ;
- no XP/rang/Transfer Score.

## 14. R3H direction recommandee

Recommandation :
R3H_EXISTING_EXERCISE_SIGNAL_READONLY

Scope :
- frontend REX only si possible ;
- lire uniquement Truth Chain moments ;
- utiliser `exerciseAvailable` comme signal ;
- afficher boundary claire ;
- ne pas appeler de route Practice ;
- ne pas appeler Daily Plan ;
- ne pas appeler `/games/{game_id}/review`.

Objectif :
Transformer le CTA Forge en promesse plus claire :
"Je vois un signal d'exercice existant, mais je ne lance pas Practice tant que la frontiere n'est pas prouvee."

## 15. Alternative

Alternative :
R3H_BACKEND_EXISTING_EXERCISE_READONLY_CONTRACT

A choisir seulement si le produit exige un vrai detail d'exercice existant.
Cette alternative doit etre backend contract-first et prouver no mutation avant
toute UI.

## 16. Risques majeurs

- route Practice qui ecrit ;
- route Review qui cree training items ;
- session creee implicitement ;
- tentative creee implicitement ;
- due_at cree trop tot ;
- Daily Plan cree ou relu comme plan actif ;
- solution revelee avant tentative ;
- "exercise ready" trompeur ;
- CTA trop fort ;
- metrique non validee ;
- XP/rang/Transfer premature ;
- utilisateur frustre par une action trop limitee.

## 17. Tests R3H attendus

Obligatoires :
- `git diff --check` ;
- frontend build ;
- `tsc --noEmit` ;
- Practice boundary read-only smoke ;
- Forge read-only smoke ;
- QG smoke ;
- Truth Chain moments smoke ;
- Parties read-only smoke ;
- Shell smoke ;
- Design Lab smoke ;
- FX Lab smoke ;
- V1 smoke.

Backend tests requis seulement si R3H touche backend.
Si backend est touche, la mission doit STOP et produire un contrat backend
dedie avant implementation.

## 18. Rollback R3H

Rollback attendu :
- retirer le hook/view-model Practice boundary ;
- revenir a Forge read-only preview R3E ;
- retirer le smoke R3H ;
- aucune migration ;
- aucune DB cleanup ;
- aucun rollback backend si R3H respecte frontend-only.

## 19. GO / NO-GO

GO_FOR_R3H seulement si :
- R3G est valide ;
- R3H reste strictement sans Practice route ;
- R3H reste sans Daily Plan route ;
- R3H reste sans `/games/{game_id}/review` ;
- R3H ne cree pas training item ;
- R3H ne cree pas session ;
- R3H ne cree pas attempt ;
- R3H ne modifie pas due_at ;
- R3H ne revele pas solution ;
- R3H ne cree pas XP/rang/Transfer Score.

NO-GO_FOR_R3H si :
- le CTA veut lancer Practice ;
- une route Practice est appelee ;
- Daily Plan est appele ;
- `/games/{game_id}/review` est appele ;
- une route GET cree indirectement des donnees ;
- un detail d'exercice est affiche sans preuve read-only ;
- une metrique non validee est exposee ;
- un fallback est presente comme vrai entrainement.

## 20. Decision finale

Recommended next mission:
R3H_EXISTING_EXERCISE_SIGNAL_READONLY

Do not start active Practice implementation yet.
Do not create practice_attempts.
Do not create training_items.
Do not modify due_at.
Do not touch Daily Plan.
Do not expose XP/rank/Transfer Score.

GO_FOR_R3H_AFTER_HUMAN_REVIEW: pending
