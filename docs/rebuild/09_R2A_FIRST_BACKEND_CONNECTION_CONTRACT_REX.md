# R2A First Backend Connection Contract - NeuroChess REX

## 1. Decision

La premiere connexion backend REX cible :

> Parties / Truth Chain.

Ne pas commencer par :
- QG complet ;
- Profil stats ;
- XP ;
- rang ;
- Transfer Score ;
- Opening Forge ;
- Spline ;
- Arene ;
- Autopilot Index.

Justification :
Parties est la source de verite du produit. Le shell doit d'abord prouver que les vraies parties peuvent alimenter la chaine :

> PGN -> Analyse -> Decision -> Exercice.

Preuves observees :
- `docs/rebuild/02_NAVIGATION_AND_SURFACES_REX.md` definit Parties comme surface des vraies parties et de la Review.
- `docs/rebuild/08_VISUAL_DIRECTION_DECISION_RECORD_REX.md` definit Truth Chain comme artefact Parties : partie reelle, analyse, moment critique, exercice.
- `frontend/src/rex/rexCopy.ts` expose deja le flow Parties : `PGN`, `Analyse`, `Moment critique`, `Exercice`.
- `backend/neurochess/api/game_routes.py` expose des routes GET candidates pour games, history, analyses, review, practice sessions et opening.

## 2. Objectif R2B En Une Phrase

R2B doit connecter la surface Parties du shell REX aux donnees backend existantes en lecture seule, sans creer de nouvelle logique metier.

## 3. Scope Exact R2B

R2B doit afficher dans Parties :
- nombre de parties importees reel si disponible ;
- derniere partie ou liste courte de parties si endpoint existant ;
- statut Review si disponible ;
- un etat vide si aucune partie ;
- un etat erreur propre si backend inaccessible ;
- un etat loading ;
- un debut de Truth Chain alimentee par donnees reelles quand disponible.

R2B ne doit PAS :
- declencher une nouvelle analyse ;
- creer un import PGN reel dans REX ;
- creer un training item ;
- modifier Daily Plan ;
- modifier `due_at` ;
- ecrire en DB ;
- creer de nouvelles metriques ;
- afficher Transfer Score ;
- afficher XP ;
- afficher rang ;
- afficher Opening Mastery ;
- brancher Profil.

## 4. Backend Existant A Inspecter

Endpoints candidats a verifier avant R2B :

| Endpoint candidat | Methode | Statut observe | Preuve | Usage R2B possible | Risque |
|---|---:|---|---|---|---|
| `/games` | GET | Existant | `backend/neurochess/api/game_routes.py:231` | liste simple de parties via repository | peut etre moins riche que l'historique PGN |
| `/games/history` | GET | Existant | `backend/neurochess/api/game_routes.py:258` | historique import PGN, pagination, scope | route probablement plus adaptee pour Parties |
| `/games/{game_id}` | GET | Existant | `backend/neurochess/api/game_routes.py:268` | details d'une partie | peut charger session, a verifier pour side effects |
| `/games/{game_id}/moves` | GET | Existant | `backend/neurochess/api/game_routes.py:286` | coups et etat courant | utile seulement si Truth Chain a besoin d'un resume |
| `/games/{game_id}/analyses` | GET | Existant | `backend/neurochess/api/game_routes.py:412` | analyses profondes deja stockees | ne doit pas lancer analyse |
| `/games/{game_id}/review` | GET | Existant | `backend/neurochess/api/game_routes.py:545` | statut/payload Review | attention : enrichit le payload avec training items disponibles |
| `/review/jobs/{job_id}` | GET | Existant | `backend/neurochess/api/game_routes.py:493` | statut job Review si `job_id` connu | ne doit pas reconcilier/cancel |
| `/games/{game_id}/review/practice/sessions` | GET | Existant | `backend/neurochess/api/game_routes.py:649` | savoir si exercices existent deja | ne pas creer de session |
| `/review/practice/sessions/{session_id}` | GET | Existant | `backend/neurochess/api/game_routes.py:680` | detail session existante si deja referencee | probablement hors R2B initial |
| `/games/{game_id}/opening` | GET | Existant | `backend/neurochess/api/game_routes.py:851` | nom d'ouverture si deja classifie | ne pas appeler classify |
| `/api/training/daily-plan/today` | GET | Existant | `backend/neurochess/api/game_routes.py:588` | a connaitre, mais hors Parties R2B | ne pas melanger avec Daily Plan |

Note de prudence :
Les endpoints listes sont des candidats, pas des routes garanties. R2B doit d'abord inspecter le client API frontend existant, les routes backend reelles et les conventions de base path (`/api` ou autre) avant d'implementer un appel reseau. R2B ne doit pas hardcoder `/games` ou `/api/games` par hypothese. Si les routes reelles ne sont pas claires ou si aucun endpoint read-only existant ne suffit, R2B doit STOP et proposer un contrat backend separe.

Routes explicitement interdites en R2B read-only :
- `POST /games/import-pgn/preview` et `POST /games/import-pgn` ;
- `POST /games/{game_id}/review/generate` ;
- `POST /games/{game_id}/review/jobs` ;
- `POST /review/jobs/{job_id}/reconcile` ;
- `POST /review/jobs/{job_id}/cancel` ;
- `POST /games/{game_id}/review/rebuild-metrics` ;
- `POST /api/training/daily-plan` ;
- `POST /api/training/daily-plan/practice` ;
- `POST /games/{game_id}/review/practice/sessions` ;
- `POST /games/{game_id}/review/practice/revisions` ;
- `POST /review/practice/sessions/{session_id}/attempts` ;
- `POST /games/{game_id}/opening/classify` ;
- tout `PATCH`, `DELETE`, analyse/recompute ou mutation scheduling.

R2B doit preferer les endpoints existants. Pas de nouvel endpoint sauf preuve qu'aucun endpoint existant ne suffit.

Si un nouvel endpoint devient necessaire, R2B doit STOP et proposer une mission separee :

> R2B-backend-contract.

## 5. Contrat De Lecture Seule

R2B doit etre read-only.

Interdit :
- `POST` ;
- `PATCH` ;
- `DELETE` ;
- analyse/recompute ;
- practice attempt ;
- training item creation ;
- schedule mutation ;
- `due_at` mutation ;
- Daily Plan mutation.

Autorise :
- `GET` existants ;
- affichage ;
- transformation frontend legere de donnees deja recues ;
- view-model REX local, sans remplacer les types API existants.

Regle reseau :
Le smoke R2B doit observer les requetes du shell REX Parties et echouer si une requete `POST`, `PATCH` ou `DELETE` part depuis `/app?rex=1` lors du chargement/affichage de Parties.

## 6. UX Attendue Parties / Truth Chain

Etats obligatoires :
- loading ;
- empty ;
- loaded ;
- degraded/backend unavailable ;
- review not ready ;
- review ready.

Truth Chain doit rester claire :
- PGN ;
- Analyse ;
- Moment critique ;
- Exercice.

Chaque etape doit pouvoir etre :
- inactive ;
- pending ;
- available ;
- unavailable.

Aucune etape ne doit mentir.

Si une donnee manque, afficher :
- `non disponible` ;
- `a brancher plus tard` ;
- ou une limitation explicite.

Ne jamais afficher une fausse donnee comme reelle.

Exemples de wording autorise :
- `Backend indisponible : la Truth Chain reste en mode degrade.`
- `Review pas encore disponible pour cette partie.`
- `Exercice non cree : R2B est lecture seule.`
- `Donnees reelles quand disponibles, placeholders signales sinon.`

Exemples interdits :
- `Analyse en cours` si aucune analyse n'a ete lancee ;
- `Exercice pret` si aucun training item ou session existante n'est prouve ;
- `XP gagne` ;
- `Transfer Score confirme` ;
- `Opening Mastery`.

## 7. Data Contract Frontend

Definir un type frontend REX dedie, par exemple :

```ts
type RexPartiesBackendStatus = "loading" | "ready" | "empty" | "unavailable";

type RexTruthChainStepStatus = "inactive" | "pending" | "available" | "unavailable";

type RexPartiesSnapshot = {
  totalGames: number;
  latestGame?: {
    id: string | number;
    white?: string;
    black?: string;
    result?: string;
    playedAt?: string;
    importedAt?: string;
    openingName?: string;
    reviewStatus?: "not_started" | "pending" | "ready" | "failed" | "unknown";
    trainingAvailable?: boolean;
  };
  reviewReadyCount?: number;
  criticalMomentsCount?: number | null;
  trainingItemsCount?: number | null;
  backendStatus: RexPartiesBackendStatus;
  truthChain: {
    pgn: RexTruthChainStepStatus;
    analysis: RexTruthChainStepStatus;
    criticalMoment: RexTruthChainStepStatus;
    exercise: RexTruthChainStepStatus;
  };
  limitations: string[];
};
```

Regles :
- ces types REX ne remplacent pas les types API existants ;
- ils servent de view-model shell REX ;
- ils doivent rester dans `frontend/src/rex/**` sauf justification explicite ;
- ils ne doivent pas imposer de schema backend nouveau ;
- ils doivent separer `unknown`, `unavailable`, `pending` et `ready`.

## 8. UI Contract R2B

R2B doit modifier uniquement :
- `frontend/src/rex/**` ;
- eventuellement un api client existant si deja dedie au frontend, mais a eviter si possible ;
- un smoke script REX.

R2B ne doit pas modifier :
- `backend/` ;
- `plan/` ;
- `docs/rebuild/` ;
- `frontend/src/v2/product-vision/` ;
- `package.json` ;
- `package-lock.json` ;
- Spline ;
- `App.tsx`.

Si `App.tsx` doit etre touche, R2B doit STOP sauf micro-gate deja existant et explicitement autorise.

UI Parties attendue :
- conserver l'identite `Truth Chain` ;
- remplacer seulement les placeholders pertinents par donnees reelles prouvees ;
- garder `Prototype REX` ou une mention equivalente tant que la surface n'est pas produit final ;
- rendre les limitations visibles sans transformer la page en debug panel ;
- ne pas ajouter de dashboard dense ;
- ne pas afficher de metrique non contractee.

## 9. Tests Attendus R2B

Obligatoires :
- `git diff --check` ;
- `npm --prefix frontend run build` ;
- depuis `frontend` : `npx tsc --noEmit` ;
- `node scripts/browser_rex_shell_navigation_smoke.mjs` ;
- nouveau smoke REX Parties data si cree ;
- `node scripts/browser_v1_flow_smoke.mjs`.

Smoke REX Parties doit verifier :
- `/app?rex=1` charge ;
- Parties surface charge ;
- aucun crash si backend indisponible ;
- empty/degraded state visible si pas de donnees ;
- loaded state visible si donnees disponibles dans l'environnement ;
- textes interdits absents ;
- `/app` normal reste accessible ;
- pas de `POST`, `PATCH` ou `DELETE` reseau depuis REX Parties ;
- pas de Spline/CDN ;
- aucun appel a `review/generate`, `review/jobs`, `daily-plan`, `practice/attempts` ou `opening/classify`.

## 10. Preuves Attendues R2B

R2B doit fournir :
- screenshots Parties empty/degraded ou loaded selon environnement ;
- network notes : endpoints GET appeles ;
- routes reellement appelees ;
- source de verite utilisee pour les routes : client API existant ou backend route file ;
- confirmation qu'aucune route n'a ete devinee ;
- confirmation aucun `POST`/`DELETE`/`PATCH` ;
- confirmation aucun backend modifie ;
- confirmation aucun Daily Plan side effect ;
- confirmation aucun `due_at` side effect ;
- confirmation aucun `training_item` cree ;
- rapport limitations honnetes.

Preuves utiles a collecter dans le rapport R2B :
- output du smoke REX Parties ;
- liste des requetes reseau observees ;
- diff stat ;
- fichiers modifies ;
- statut Git ;
- capture Parties.

## 11. Risques

Risques identifies :
- endpoint existant pas assez riche ;
- confusion vraie donnee vs prototype ;
- REX pourrait donner l'impression de lancer import/analyse alors que ce n'est pas encore branche ;
- risque de transformer R2B en refactor API ;
- risque de modifier backend trop tot ;
- risque de casser V1 ;
- `GET /games/{game_id}/review` peut enrichir le payload avec training items disponibles : verifier que cela ne cree rien de nouveau ;
- `GET /games/{game_id}` peut charger une session : verifier que ce chargement n'a pas d'effet produit visible ;
- history/import PGN et repository list peuvent ne pas avoir les memes champs ;
- opening disponible uniquement si deja classifiee.

## 12. Rollback R2B

Rollback attendu :
- retirer hook/view-model REX Parties ;
- revenir aux placeholders Parties ;
- retirer smoke REX Parties ;
- retirer notes reseau specifiques si elles sont dans des artefacts externes ;
- aucune migration ;
- aucun rollback DB necessaire ;
- aucun changement backend a inverser.

## 13. GO / NO-GO R2B

GO_FOR_R2B seulement si :
- ce contrat est valide ;
- repo clean ;
- endpoints existants identifies ;
- R2B reste read-only ;
- pas de backend write ;
- pas de metriques reelles hors donnees existantes ;
- R2B cible uniquement Parties / Truth Chain ;
- l'ancien `/app` reste intact ;
- Design Lab et Product Vision V2 restent hors scope.

NO_GO_FOR_R2B si :
- R2B veut creer un endpoint ;
- R2B veut lancer import/analyse/review job ;
- R2B veut creer des training items ;
- R2B veut brancher Daily Plan ;
- R2B veut exposer XP, rang, Transfer Score ou Opening Mastery ;
- R2B veut modifier backend dans la meme mission ;
- R2B veut corriger V1 hors scope.

GO_FOR_R2B_AFTER_HUMAN_REVIEW: pending
