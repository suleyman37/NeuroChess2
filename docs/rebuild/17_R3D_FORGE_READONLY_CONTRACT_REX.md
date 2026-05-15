# R3D Forge Read-Only Contract — NeuroChess REX

## 1. Statut

Statut :
Contrat produit/technique pour préparer Forge.

But :
Définir comment Forge peut devenir utile sans créer de side effects.

R3D ne code rien.
R3D prépare une future mission R3E.

## 2. Décision centrale

Forge doit répondre :
“Comment je transforme cette erreur, ce moment ou cette position en entraînement ?”

Mais Forge ne doit pas encore créer d’entraînement réel.

R3E devra rester read-only :
- lire des opportunités existantes ;
- présenter une Forge Preview ;
- distinguer opportunité réelle, fallback, indisponible ;
- ne rien créer.

Forge ne doit pas prétendre qu’un drill existe s’il n’existe pas.

## 3. Pourquoi Forge maintenant

Après R3B :
- QG propose une mission depuis données existantes ;
- Parties montre la matière réelle ;
- Truth Chain expose moments/moves/positions ;
- il manque le pont vers l’action.

Forge est la suite logique :
QG -> Parties -> Forge.

Mais Forge est aussi la surface la plus dangereuse :
- elle peut déclencher Practice ;
- elle peut créer training_items ;
- elle peut modifier due_at ;
- elle peut se transformer en faux RPG ;
- elle peut mentir avec des drills non existants.

## 4. Non-objectifs R3E

R3E ne doit PAS :
- créer training_items ;
- créer practice_attempts ;
- modifier due_at ;
- modifier Daily Plan ;
- créer une session Practice ;
- lancer analyse ;
- importer PGN ;
- appeler /games/{game_id}/review ;
- appeler une route Practice sans preuve anti-mutation ;
- appeler une route Daily Plan sans preuve anti-mutation ;
- appeler une route training item qui crée/ensure ;
- créer XP ;
- créer rang ;
- créer Transfer Score ;
- créer Opening Mastery ;
- exposer une métrique non validée ;
- afficher raw WDL ;
- afficher centipawn loss brut ;
- afficher criticality_score ;
- afficher diagnostic_gap ;
- afficher ETV ;
- afficher FSRS ;
- afficher SkillTrace mastery ;
- ajouter Spline/WebGL ;
- ajouter dépendance.

## 5. Sources candidates à auditer

R3E doit commencer par auditer les sources read-only existantes.

### A. Truth Chain moments read-only

Source :
GET /games/{game_id}/truth-chain/moments

Usage Forge :
- moments persistés peuvent devenir “opportunités de Forge” ;
- FEN/SAN/UCI peuvent alimenter un aperçu de position ;
- reviewAvailable / exerciseAvailable peut guider l’état.

Avantage :
déjà sécurisé par R2/R3.

Risque :
exerciseAvailable peut signifier training_item existant, mais ne doit jamais créer.

### B. Moves-only fallback

Source :
GET /games/{game_id}/moves

Usage Forge :
- afficher “position à explorer” ;
- pas “drill disponible”.

Avantage :
safe.

Risque :
ne pas confondre coup lu avec erreur/training.

### C. Training items existants en lecture seule

Usage possible :
- seulement si une route/service read-only prouvé existe ;
- lire des items déjà persistés ;
- jamais ensure/create.

Risque :
très élevé. Beaucoup de services training peuvent créer ou planifier.

R3E doit STOP si aucune preuve anti-mutation n’existe.

### D. Practice routes

Par défaut :
interdites.

Clarification R3E :
toute route Practice safe future appartient à un contrat ultérieur dédié, pas à R3E.
R3E doit rester strictement sans Practice route.

Autorisation future seulement après contrat dédié prouvant :
- GET-only ;
- no practice_attempt created ;
- no session mutation ;
- no due_at mutation ;
- no scoring write.

### E. Daily Plan

Par défaut :
interdit.

Autorisation future seulement après contrat dédié prouvant :
- read-only strict ;
- no plan generation ;
- no rebuild ;
- no due_at mutation.

## 6. Source recommandée R3E

Recommandation prudente :
R3E doit utiliser uniquement Truth Chain read-only comme source principale.

Cas :

1. truth-chain moments avec exerciseAvailable=true
- afficher “Exercice existant détecté”
- action : “Voir la position” ou “Préparer la Forge”
- ne pas lancer Practice sauf route safe dédiée.

2. truth-chain moments sans exerciseAvailable
- afficher “Moment à transformer”
- action : “Inspecter la position”
- pas “S’entraîner maintenant”.

3. moves-only fallback
- afficher “Partie lue, Forge non disponible”
- action : “Voir la Truth Chain”

4. no games
- afficher “Importer une partie” prototype/non-mutating.

5. backend unavailable
- état degraded propre.

## 7. View-model Forge recommandé

Définir :

```ts
type RexForgeSnapshot = {
  backendStatus: "loading" | "ready" | "empty" | "unavailable";
  source:
    | "truth_chain_moments"
    | "moves_only"
    | "existing_training_items"
    | "empty"
    | "unavailable";
  opportunities: RexForgeOpportunity[];
  limitations: string[];
  readOnlyProof: {
    routesUsed: string[];
    methodsObserved: string[];
    writesObserved: boolean;
    dailyPlanTouched: boolean;
    dueAtTouched: boolean;
    trainingItemsCreated: boolean;
    practiceAttemptsCreated: boolean;
  };
};

type RexForgeOpportunity = {
  id: string;
  gameId?: string;
  title: string;
  subtitle?: string;
  san?: string;
  uci?: string;
  fenBefore?: string;
  fenAfter?: string;
  openingName?: string;
  source:
    | "truth_chain_moment"
    | "moves_only"
    | "existing_training_item"
    | "fallback";
  kind:
    | "review_moment"
    | "position_review"
    | "opening_exit"
    | "existing_exercise"
    | "unknown";
  actionStatus:
    | "preview_only"
    | "existing_exercise_available"
    | "disabled"
    | "prototype";
  actionLabel: string;
  visualSeverity: "positive" | "low" | "medium" | "high" | "critical" | "unknown";
  exerciseAvailable: boolean;
  limitations: string[];
};
```

Important :
- exerciseAvailable=true signifie uniquement exercice/training item déjà persisté si confirmé.
- Ne jamais utiliser exerciseAvailable pour créer quoi que ce soit.

## 8. UX Forge attendue R3E

Forge doit être une preview read-only.

États :

### ready with truth-chain moments

Titre :
“Transformer un moment en entraînement”

Sous-texte :
“Forge lit les moments existants. Aucun exercice n’est créé.”

Artefact :
Forge Core.

Cards/opportunities :
maximum 3 opportunités.

Actions :
- “Voir la position”
- “Préparer la Forge”
- “Exercice existant” seulement si réellement existant.

### moves-only fallback

Titre :
“Partie lue · Forge non disponible”

Copy :
“Les coups sont disponibles, mais aucun moment Review persisté n’est prêt pour Forge.”

Action :
“Voir la Truth Chain”

### empty

Titre :
“Importer une partie”

CTA prototype/non-mutating.

### degraded

Titre :
“Lecture indisponible”

QG/Forge restent lisibles.

## 9. UX anti-mensonge

Interdits de copy :
- “Exercice créé”
- “Drill prêt” si aucun exercice existant
- “S’entraîner maintenant” si aucune route Practice safe
- “XP à gagner”
- “Compétence maîtrisée”
- “Score de Forge”
- “Plan généré”
- “Révision programmée”

Copies autorisées :
- “Moment à transformer”
- “Position à inspecter”
- “Exercice existant détecté”
- “Preview read-only”
- “Aucune création”
- “Aucun due_at modifié”
- “Forge non disponible”

## 10. Actions autorisées/interdites

Actions autorisées R3E :
- sélectionner une opportunité ;
- afficher position/FEN read-only ;
- naviguer vers Parties / Truth Chain ;
- afficher détails repliés ;
- afficher “prototype” / “preview”.

Actions interdites R3E :
- créer session practice ;
- commencer tentative ;
- marquer fait ;
- modifier due_at ;
- créer training item ;
- lancer analyse ;
- importer ;
- scorer XP ;
- révéler solution si pas déjà disponible.

## 11. Network contract R3E

Routes autorisées :
- GET /games/history
- GET /games/{game_id}/truth-chain/moments
- GET /games/{game_id}/moves si fallback nécessaire

Routes interdites :
- /games/{game_id}/review
- Practice routes
- Daily Plan routes
- POST/PATCH/PUT/DELETE
- import route
- analyze route
- training item creation route
- due_at/schedule route

Smoke doit échouer si :
- /games/{game_id}/review apparaît même en GET ;
- Practice route apparaît ;
- Daily Plan route apparaît ;
- POST/PATCH/PUT/DELETE apparaît.

## 12. Visual / DA contract Forge

Forge ne doit pas devenir RPG cheap.

Règles :
- amber/gold contrôlé ;
- pas de casino ;
- pas de confetti ;
- pas d’XP ;
- pas de barre de niveau ;
- pas de gros trophée ;
- maximum 3 opportunités visibles ;
- un Forge Core dominant ;
- moins de texte, plus d’état visuel ;
- détails techniques repliés.

Forge doit donner :
“voici une position/moment que je peux transformer”,
pas :
“voici un dashboard de tâches”.

## 13. Smoke R3E attendu

Créer futur :
scripts/browser_rex_forge_readonly_smoke.mjs

Scénarios à mocker :

1. truth-chain moments avec exerciseAvailable=false
- Forge affiche “Moment à transformer”
- action preview-only
- no Practice route
- no write

2. truth-chain moments avec exerciseAvailable=true
- Forge affiche “Exercice existant détecté”
- ne crée rien
- no Practice route sauf explicitement autorisée dans futur contrat

3. moves-only fallback
- Forge affiche “Partie lue · Forge non disponible”

4. empty
- CTA importer prototype/non-mutating

5. degraded
- état propre

Vérifier aussi :
- GET /games/{game_id}/truth-chain/moments est bien observé dans les scénarios truth-chain.
- /app normal accessible
- /app?rex=1 accessible
- Design Lab accessible
- FX Lab accessible
- QG smoke still passes
- Parties smoke still passes

## 14. Screenshots R3E attendus

À fournir en QA externe :
- Forge truth-chain moments preview
- Forge existing exercise detected si mock safe
- Forge moves-only fallback
- Forge empty
- Forge degraded

## 15. Tests R3E attendus

Obligatoires :
- git diff --check
- frontend build
- tsc
- Forge read-only smoke
- QG smoke
- Truth Chain moments smoke
- Parties read-only smoke
- Shell smoke
- Design Lab smoke
- FX Lab smoke
- V1 smoke

## 16. Risques majeurs

Lister :
- training item side effect ;
- due_at mutation ;
- Daily Plan mutation ;
- practice_attempt creation ;
- faux exercice disponible ;
- CTA “S’entraîner” trompeur ;
- métrique non validée présentée comme vérité utilisateur ;
- RPG cheap ;
- UI trop card-like ;
- texte trop long ;
- confusion opportunity vs exercise.

## 17. Rollback R3E

Rollback :
- retirer hook/view-model Forge ;
- revenir Forge placeholders ;
- retirer smoke Forge ;
- aucune migration ;
- aucune DB cleanup ;
- aucun backend rollback.

## 18. GO / NO-GO

GO_FOR_R3E seulement si :
- ce contrat est validé ;
- R3E reste frontend/rex only ;
- routes safe identifiées ;
- no Practice/Daily Plan route ;
- no write methods ;
- no training item creation ;
- no due_at ;
- no XP/rang/Transfer Score.

GO_FOR_R3E_AFTER_HUMAN_REVIEW: pending
