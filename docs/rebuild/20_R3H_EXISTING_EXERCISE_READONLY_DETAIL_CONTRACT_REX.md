# R3H Existing Exercise Read-Only Detail Contract - NeuroChess REX

## 1. Statut

Statut :
Contrat produit/technique pour definir le detail read-only d'un exercice deja existant.

But :
Preparer la prochaine petite marche apres :
- QG read-only ;
- Parties / Truth Chain read-only ;
- Forge read-only preview ;
- R3G Practice Boundary read-only contract.

R3H ne code rien dans cette mission.
R3H ne branche pas Practice.
R3H definit seulement ce qui serait autorise pour lire un detail d'exercice deja persiste sans effet de bord.

## 2. Decision centrale

Forge peut afficher un signal :
"un exercice existant semble detecte".

R3H doit definir la frontiere entre ce signal et un vrai detail consultable.

Decision :
Un "existing exercise detail" REX est autorise uniquement si l'exercice existe deja et si la lecture prouve :
- no practice_attempt creation ;
- no training_item creation ;
- no due_at mutation ;
- no Daily Plan mutation ;
- no scoring ;
- no reveal solution ;
- no XP/rank/Transfer ;
- no `/games/{game_id}/review`.

Si cette preuve n'existe pas, REX doit rester en "signal only" et afficher un etat bloque honnete.

## 3. Relation avec R3F et R3G

R3F a identifie une option intermediaire :
afficher le detail d'un exercice existant sans lancer Practice.

R3G a pose la boundary :
- Truth Chain moments est la source safe principale ;
- `exerciseAvailable=true` est seulement un signal ;
- les routes Practice, Daily Plan, review unsafe et write methods restent interdites ;
- toute action active exige un contrat write-sensitive separe.

R3H precise donc :
- ce qu'un detail read-only peut contenir ;
- quelles sources sont autorisees ;
- quelles routes restent interdites ;
- quelles preuves anti-mutation seront obligatoires avant implementation.

## 4. Source autorisee

Source autorisee baseline :
- `GET /games/{game_id}/truth-chain/moments`

Usage :
- detecter `exerciseAvailable=true` ;
- recuperer gameId, move data, FEN/SAN/UCI disponibles ;
- afficher une position ou un moment lie ;
- ne jamais creer ni assurer un exercice.

Source candidate future :
- une route dediee de detail read-only d'un exercice deja persiste.

Cette route future doit prouver :
- GET-only ;
- no ensure/create ;
- no session creation ;
- no attempt creation ;
- no due_at write ;
- no Daily Plan write ;
- no scoring write ;
- no solution reveal unless the solution is already public in that read-only contract.

## 5. Non-objectifs

R3H ne doit pas :
- demarrer Practice ;
- creer une session Practice ;
- creer practice_attempts ;
- creer training_items ;
- modifier due_at ;
- modifier Daily Plan ;
- lancer scoring ;
- enregistrer un resultat ;
- reveler une solution ;
- creer XP ;
- creer rank ;
- creer Transfer Score ;
- importer PGN ;
- lancer analyse ;
- appeler `/games/{game_id}/review`.

R3H ne doit pas transformer un signal en promesse d'entrainement actif.

## 6. Etats produit

### A. No signal

Condition :
aucun moment Truth Chain ne porte de signal d'exercice existant.

UX :
- afficher "Detail d'exercice indisponible" ;
- proposer "Voir la position" ou "Retour Forge" ;
- ne pas inventer d'exercice.

### B. Existing exercise signal only

Condition :
`exerciseAvailable=true` depuis Truth Chain, mais aucune route detail read-only n'est prouvee.

UX :
- afficher "Signal d'exercice existant" ;
- expliquer que le detail n'est pas encore branche ;
- action autorisee : "Voir la position" ;
- action interdite : "Commencer l'entrainement".

### C. Read-only detail possible

Condition future :
une route detail read-only existe et passe les preuves anti-mutation.

UX :
- afficher la position ;
- afficher la source ;
- afficher les limites ;
- afficher le statut read-only ;
- ne pas afficher de bouton qui cree une tentative.

### D. Degraded

Condition :
backend indisponible ou source non lisible.

UX :
- afficher "Lecture indisponible" ;
- garder Forge lisible ;
- ne pas appeler de route de secours dangereuse.

## 7. View-model recommande

```ts
type RexExistingExerciseDetailSnapshot = {
  backendStatus: "loading" | "ready" | "empty" | "unavailable";
  source: "truth_chain_signal" | "read_only_detail" | "none" | "unavailable";
  detailState:
    | "no_signal"
    | "signal_only"
    | "read_only_detail_possible"
    | "blocked"
    | "degraded";
  selected: RexExistingExerciseDetail | null;
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
    solutionRevealed: boolean;
  };
  limitations: string[];
};

type RexExistingExerciseDetail = {
  id: string;
  gameId: string;
  title: string;
  subtitle?: string;
  fenBefore?: string;
  fenAfter?: string;
  san?: string;
  uci?: string;
  source: "truth_chain_moment" | "existing_exercise_read_only";
  actionLabel: string;
  actionStatus: "position_only" | "detail_read_only" | "blocked";
  limitations: string[];
};
```

## 8. Actions autorisees

Actions autorisees pour une future implementation R3I/R3H-like :
- selectionner un signal ;
- afficher la position ;
- afficher FEN/SAN/UCI si deja disponibles ;
- afficher la source Truth Chain ;
- afficher les limites read-only ;
- naviguer vers Parties / Truth Chain ;
- fermer le detail ;
- afficher "detail non branche".

Toutes ces actions doivent rester GET-only et non-mutating.

## 9. Actions interdites

Actions interdites :
- commencer une tentative ;
- creer une session ;
- creer un training item ;
- creer une practice attempt ;
- modifier due_at ;
- modifier Daily Plan ;
- enregistrer resultat ;
- scorer ;
- reveler solution ;
- importer ;
- analyser ;
- appeler `/games/{game_id}/review` ;
- appeler une route Practice unsafe ;
- appeler une route Daily Plan ;
- appeler POST/PATCH/PUT/DELETE.

## 10. UX copy autorisee

Copies autorisees :
- "Signal d'exercice existant"
- "Detail read-only non branche"
- "Voir la position"
- "Source : Truth Chain"
- "Aucune tentative creee"
- "Aucun resultat enregistre"
- "Aucun due_at modifie"
- "Lecture read-only"
- "Detail indisponible"

## 11. UX copy interdite

Copies interdites :
- "Commencer l'entrainement"
- "S'entrainer maintenant"
- "Tentative creee"
- "Exercice pret" sans detail read-only prouve
- "Drill pret"
- "Solution revelee"
- "Revision programmee"
- "Plan genere"
- "XP a gagner"
- "Rang"
- "Transfer Score"
- "Competence maitrisee"

## 12. Network contract futur

Routes autorisees baseline :
- `GET /games/history`
- `GET /games/{game_id}/truth-chain/moments`
- `GET /games/{game_id}/moves` si fallback necessaire

Route candidate future :
- `GET /existing-exercises/{id}/read-only` ou equivalent, seulement apres contrat backend dedie.

Routes interdites :
- `/games/{game_id}/review`
- toute route Practice active
- toute route Daily Plan
- toute route import/analyze/rebuild
- toute route ensure/create training item
- POST/PATCH/PUT/DELETE

## 13. Preuves anti-mutation requises

Avant toute implementation qui affiche un vrai detail d'exercice :

- test backend before/after sur `training_items` ;
- test backend before/after sur `review_practice_sessions` ;
- test backend before/after sur `review_practice_attempts` ;
- test backend before/after sur `daily_plan_items` ;
- test backend before/after sur `due_at` ;
- audit prouvant aucune fonction ensure/create ;
- audit prouvant aucune creation session/tentative ;
- smoke reseau GET-only ;
- assertion no `/games/{game_id}/review` ;
- assertion no Practice route ;
- assertion no Daily Plan route ;
- assertion no write method.

## 14. Smoke futur attendu

Futur smoke possible :
`scripts/browser_rex_existing_exercise_detail_readonly_smoke.mjs`

Scenarios :

1. `exerciseAvailable=false`
- affiche "Detail d'exercice indisponible" ;
- no detail invented ;
- no write.

2. `exerciseAvailable=true` without safe detail route
- affiche "Signal d'exercice existant" ;
- affiche "Detail read-only non branche" ;
- no Practice route ;
- no write.

3. safe detail route mocked
- affiche position/source/limites ;
- no solution reveal ;
- no write.

4. degraded
- affiche "Lecture indisponible" ;
- no unsafe fallback.

## 15. GO / NO-GO

GO_FOR_R3I seulement si :
- R3H est valide ;
- une source read-only est identifiee ;
- les preuves anti-mutation existent ;
- aucun write method n'est observe ;
- aucune route Practice active n'est appelee ;
- aucune route Daily Plan n'est appelee ;
- `/games/{game_id}/review` reste absent ;
- la copy reste honnete.

NO-GO_FOR_R3I si :
- le detail cree une session ;
- le detail cree une tentative ;
- le detail cree un training item ;
- le detail modifie due_at ;
- le detail touche Daily Plan ;
- le detail lance scoring ;
- le detail revele la solution ;
- le detail promet XP/rank/Transfer ;
- un fallback est presente comme entrainement reel.

## 16. Decision finale

Recommended next mission:
R3I_EXISTING_EXERCISE_DETAIL_READONLY_AUDIT_OR_PROTOTYPE

Do not start active Practice implementation yet.
Do not create attempts.
Do not create training items.
Do not modify due_at.
Do not touch Daily Plan.
Do not expose XP/rank/Transfer Score.

GO_FOR_R3I_AFTER_HUMAN_REVIEW: pending
