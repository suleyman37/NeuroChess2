# R3A QG Mission Core Read-Only Contract — NeuroChess REX

## 1. Statut

Statut :
Contrat frontend/backend read-only pour future mission R3B.

But :
Préparer la première connexion réelle du QG / Mission Core sans mutation.

R3A ne code rien.
R3A définit la source de priorité, les interdits, les états UX, les preuves, les tests et le rollback de R3B.

## 2. Décision centrale

R3B doit rendre le QG utile en lecture seule.

Le QG doit répondre :
“Que dois-je faire maintenant ?”

Mais R3B ne doit pas encore être un vrai Daily Plan dynamique.

R3B doit seulement afficher une priorité simple, prudente, issue de données déjà existantes ou d’un fallback honnête.

Le Mission Core doit devenir un instrument de décision, pas un générateur de plan.

## 3. Non-objectifs R3B

R3B ne doit PAS :
- créer Daily Plan ;
- modifier Daily Plan ;
- modifier `due_at` ;
- créer `training_items` ;
- créer `practice_attempts` ;
- déclencher analyse ;
- importer PGN ;
- créer XP ;
- créer rang ;
- créer Transfer Score ;
- créer Opening Mastery ;
- créer une nouvelle métrique réelle ;
- appeler une route Practice/Daily Plan sans preuve anti-mutation ;
- appeler une route qui crée implicitement des données ;
- exposer raw WDL ;
- exposer `criticality_score` ;
- exposer `diagnostic_gap` ;
- exposer ETV ;
- exposer FSRS ;
- exposer SkillTrace mastery ;
- ajouter Spline/WebGL ;
- ajouter dépendance.

## 4. Audit des sources QG read-only existantes

R3B doit commencer par auditer les sources disponibles.

Sources candidates à inspecter :

### A. Parties / Truth Chain

- latest game via history ;
- truth-chain moments read-only ;
- moves-only fallback ;
- review moments persistés si disponibles.

Avantage :
déjà sécurisé par R2.

Risque :
peut conduire à une mission “revoir la dernière partie” plutôt qu’à une vraie mission du jour.

Verdict :
Source prioritaire pour R3B, car son contrat read-only est déjà prouvé.

### B. Training items existants en lecture seule

- uniquement si une route/service read-only existe ;
- aucun ensure/create ;
- aucun `due_at` mutation ;
- aucun scheduling update.

Avantage :
peut donner une vraie priorité d’entraînement.

Risque :
très sensible ; risque de side effect caché.

Verdict :
À ne pas utiliser dans R3B sans contrat anti-mutation dédié.

### C. Daily Plan existant en lecture seule

- uniquement si une route/service read-only existe avec preuve anti-mutation ;
- interdit si la route génère/rebuild le plan.

Avantage :
cœur du QG futur.

Risque :
danger maximal si ça crée ou replanifie.

Verdict :
À exclure de R3B tant qu’un audit backend read-only n’a pas prouvé l’absence de mutation.

### D. Review summary persisté

- uniquement en lecture ;
- pas d’enrichissement qui crée training items.

Avantage :
peut dire “reprendre la Review”.

Risque :
routes Review existantes peuvent être unsafe.

Verdict :
Ne pas appeler `GET /games/{game_id}/review`. Utiliser seulement les statuts déjà exposés par history ou truth-chain moments.

### E. Fallback honnête

Si aucune donnée safe :
- “Importer une partie” ;
- “Lire la dernière partie” ;
- “Aucune mission calculée — données insuffisantes” ;
- prototype REX marqué clairement.

Verdict :
Fallback obligatoire. Mieux vaut une mission honnête et limitée qu’une priorité inventée.
Le fallback “Importer une partie” reste un CTA prototype/non-mutating tant que l’import REX n’est pas une mission dédiée.

## 5. Source recommandée pour R3B

Recommandation prudente :
R3B doit d’abord utiliser la source déjà sécurisée :
Parties / Truth Chain read-only.

Priorité possible :
- si truth-chain moments existent :
  “Revoir les moments détectés de la dernière partie.”
- si moves-only seulement :
  “Explorer la dernière partie lue.”
- si aucune partie :
  “Importer une partie.”
- si backend indisponible :
  “Mode prototype — lecture indisponible.”

Ne pas utiliser Training Items / Daily Plan tant qu’une preuve anti-mutation n’existe pas.

R3B peut donc connecter QG à une mission issue de Parties sans créer une mécanique de planification.

## 6. View-model REX recommandé

Définir :

```ts
type RexQGMissionSnapshot = {
  backendStatus: "loading" | "ready" | "empty" | "unavailable"
  mission?: RexQGMission
  source:
    | "truth_chain_moments"
    | "moves_only"
    | "latest_game"
    | "empty"
    | "unavailable"
  limitations: string[]
  readOnlyProof: {
    routesUsed: string[]
    methodsObserved: string[]
    writesObserved: boolean
    dailyPlanTouched: boolean
    dueAtTouched: boolean
    trainingItemsCreated: boolean
  }
}

type RexQGMission = {
  id: string
  title: string
  subtitle?: string
  primaryActionLabel: string
  primaryActionStatus: "prototype" | "available" | "disabled"
  evidence: {
    gameId?: string
    gameLabel?: string
    openingName?: string
    momentCount?: number
    movesCount?: number
    reviewStatus?: string
  }
  missionKind:
    | "review_latest_game"
    | "inspect_truth_chain"
    | "import_first_game"
    | "prototype"
    | "unknown"
  confidence: "confirmed" | "partial" | "fallback"
  limitations: string[]
}
```

Important :
- Aucun XP.
- Aucun rang.
- Aucun score de priorité opaque.
- Aucune métrique nouvelle.
- Aucune mutation cachée pour “préparer” la mission.

## 7. UX QG / Mission Core attendue pour R3B

Le QG doit afficher :

1. Mission Core
- une priorité principale ;
- une action principale ;
- une preuve courte ;
- un état source clair.

2. États obligatoires
- loading ;
- ready with truth-chain moments ;
- ready moves-only fallback ;
- empty no games ;
- backend unavailable ;
- degraded.

3. Copy prudente

Autorisé :
- “Revoir les moments de la dernière partie” ;
- “Explorer la dernière partie lue” ;
- “Importer une partie” ;
- “Lecture seule” ;
- “Aucune planification modifiée” ;
- “Mission proposée depuis données existantes”.

Interdit :
- “Mission optimale” ;
- “Plan parfait” ;
- “XP à gagner” ;
- “Rang” ;
- “Daily Plan généré” ;
- “Exercice créé” ;
- “due_at modifié” ;
- “Transfer Score”.

Le CTA principal doit rester honnête :
- disponible seulement s’il ouvre une surface REX existante sans mutation ;
- prototype si l’action cible n’est pas encore branchée ;
- disabled si aucune donnée ne justifie l’action.

## 8. Network contract R3B

R3B peut appeler uniquement des routes GET déjà prouvées safe.

Routes potentiellement autorisées :
- `GET /games/history` ;
- `GET /games/{game_id}/truth-chain/moments` ;
- `GET /games/{game_id}/moves` si fallback nécessaire.

Routes interdites sauf preuve anti-mutation dédiée :
- `/games/{game_id}/review` ;
- Practice routes ;
- Daily Plan routes ;
- Training item creation routes ;
- analyse/import routes ;
- `POST/PATCH/PUT/DELETE`.

Le smoke doit échouer si :
- `/games/{game_id}/review` est appelé ;
- une méthode write est observée ;
- une route Practice/Daily Plan est appelée sans autorisation explicite ;
- une route import/analyse/review generate/rebuild est appelée.

## 9. UI contract R3B

R3B doit modifier uniquement :
- `frontend/src/rex/**` ;
- éventuellement `frontend/src/api/client.ts` si une fonction existante manque ;
- un smoke REX dédié.

R3B ne doit pas modifier :
- `backend/` ;
- `docs/rebuild/` ;
- `plan/` ;
- `package` ;
- `App.tsx` ;
- Product Vision V2.

R3B doit réutiliser les données / functions déjà créées si possible :
- `getGameHistory` ;
- `getTruthChainMoments` ;
- view-model Truth Chain si pertinent.

Si une nouvelle route semble nécessaire :
STOP et proposer un contrat backend read-only séparé.

## 10. Smokes attendus R3B

Créer :
`scripts/browser_rex_qg_mission_core_readonly_smoke.mjs`

Le smoke doit vérifier :

1. `/app?rex=1` charge.
2. QG est visible.
3. Mock history + truth-chain moments.
4. QG affiche une mission issue de truth-chain moments.
5. Primary action reste safe/prototype ou route interne non-mutating.
6. Le libellé visible “Mission proposée depuis données existantes”.
7. No `/games/{game_id}/review`.
8. No `POST/PATCH/PUT/DELETE`.
9. No Daily Plan route.
10. No Practice route.
11. No training item creation.
12. Empty no games state.
13. Backend unavailable state.
14. V1 route accessible.
15. Design Lab accessible.
16. FX Lab accessible.
17. Parties smoke still passes.

Le smoke doit journaliser :
- routes appelées ;
- méthodes observées ;
- source de la mission ;
- fallback utilisé ;
- preuve que les routes Daily/Practice n’ont pas été touchées.

## 11. Screenshots attendus R3B

R3B doit fournir :
- QG ready truth-chain moments ;
- QG moves-only fallback ;
- QG empty no games ;
- QG degraded backend unavailable.

Stockage QA externe, jamais dans repo.

Les screenshots doivent prouver que :
- le Mission Core domine le fold ;
- le QG ne ressemble pas à un dashboard ;
- la source read-only est lisible ;
- le fallback ne prétend pas être une vraie mission calculée.

## 12. Tests attendus R3B

Obligatoires :
- `git diff --check` ;
- frontend build ;
- `tsc` ;
- QG mission core smoke ;
- Truth Chain moments smoke ;
- Parties read-only smoke ;
- Shell smoke ;
- Design Lab smoke ;
- FX Lab smoke ;
- V1 smoke.

Non obligatoires :
- backend tests, sauf si R3B sort du périmètre et doit STOP.

## 13. Risques

Risques à surveiller :
- QG invente une mission ;
- QG ressemble à un dashboard ;
- priorité trop opaque ;
- Daily Plan route unsafe ;
- Practice route unsafe ;
- training item side effect ;
- XP/rang prématuré ;
- confusion mission proposée vs mission calculée ;
- trop de texte ;
- action principale non branchée trop forte ;
- route `/review` réintroduite par facilité ;
- fallback “Importer une partie” présenté comme mission réelle.

Mitigations :
- priorité dérivée seulement de sources prouvées safe ;
- labels courts mais explicites ;
- no write methods dans smoke ;
- aucune route Practice/Daily Plan sans preuve anti-mutation ;
- no `/review` ;
- read-only proof discret mais visible.

## 14. Rollback R3B

Rollback :
- retirer hook/view-model QG ;
- revenir QG placeholders ;
- retirer smoke QG ;
- aucun rollback backend ;
- aucune DB cleanup.

Raison :
R3B ne doit écrire aucune donnée, ne doit ajouter aucune migration et ne doit modifier aucun service backend.

## 15. GO / NO-GO

GO_FOR_R3B seulement si :
- R3A est validé ;
- source read-only choisie ;
- routes safe prouvées ;
- no Practice/Daily Plan route sans anti-mutation ;
- R3B reste frontend/Rex only ;
- aucun write.

NO-GO_FOR_R3B si :
- la mission veut utiliser Daily Plan sans preuve anti-mutation ;
- la mission veut utiliser Practice routes sans preuve anti-mutation ;
- la mission veut créer ou modifier `training_items` ;
- la mission veut modifier `due_at` ;
- la mission veut appeler `/games/{game_id}/review` ;
- la mission veut créer XP/rang/Transfer Score ;
- la mission veut modifier backend ou docs/rebuild ;
- la mission veut présenter un fallback comme mission calculée.

GO_FOR_R3B_AFTER_HUMAN_REVIEW: pending
