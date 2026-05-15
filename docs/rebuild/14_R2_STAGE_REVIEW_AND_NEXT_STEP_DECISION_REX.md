# R2 Stage Review and Next Step Decision — NeuroChess REX

## 1. Statut

Statut :
Bilan stratégique après R2L.

But :
Décider la prochaine étape de refonte REX sans retomber dans :
- polish infini ;
- FX gratuits ;
- backend trop large ;
- frontend sans vraie donnée ;
- features trop nombreuses.

Ce document ne remplace pas Plan1, Plan2, Plan3, ni les contrats R2 précédents.
Il résume le jalon R2 et fixe une recommandation de suite.

## 2. Ce qui est maintenant acquis

R2 a transformé Parties / Truth Chain en première surface REX connectée à une donnée réelle ou contrôlée, avec garde-fous read-only.

Acquis :
- Shell REX `/app?rex=1`.
- Design Lab `/app?rex=1&designLab=1`.
- FX Lab `/app?rex=1&fxLab=1`.
- Parties / Truth Chain visuelle.
- Lecture history read-only via `GET /games/history?limit=50&offset=0&scope=mine`.
- Moves-only fallback avec coups, SAN/UCI, FEN et mini-board.
- Mini-board read-only.
- Route backend dédiée `GET /games/{game_id}/truth-chain/moments`.
- Service backend read-only pour moments Review persistés.
- Tests backend anti-mutation pour la route Truth Chain moments.
- Frontend REX connecté à `GET /games/{game_id}/truth-chain/moments`.
- Distinction UI entre Moments Review / Moves-only / Degraded.
- Smokes REX couvrant shell, Parties, Design Lab, FX Lab et intégration Truth Chain moments.
- Guardrails réseau : aucun appel REX à `GET /games/{game_id}/review`.
- Aucun `POST/PATCH/PUT/DELETE` dans les smokes REX concernés.
- Aucun side effect Daily Plan / `due_at` / training item attendu dans le flux REX Parties.

## 3. Ce qui n’est PAS encore acquis

R2 ne termine pas le produit REX. Il sécurise une première surface.

Non acquis :
- QG réel non branché.
- Mission du jour réelle non branchée.
- Forge réelle non branchée.
- Arène réelle non branchée.
- Profil réel non branché.
- Opening mastery non branchée.
- XP/rang non branchés.
- Transfer Score non branché.
- Visual identity encore jeune.
- Moments Review réels dépendants de données persistées.
- Gravité visuelle encore prudente et parfois peu informative.
- Pas encore de vrai loop complet jouer -> review -> drill -> révision -> transfert.
- Pas encore d’action utilisateur REX complète, seulement une lecture sûre.

## 4. Évaluation de Parties / Truth Chain

Forces :
- Première surface REX vraiment connectée au réel.
- Backend read-only dédié, séparé de la route Review unsafe.
- Route safe prouvée par tests ciblés.
- Mini-board visible et read-only.
- Différenciation Moments Review / Moves-only / Degraded.
- Fallback honnête quand aucun moment Review persisté n’existe.
- Smokes stricts sur `/review` interdit et méthodes write interdites.

Faiblesses :
- Encore prototype.
- Moments réels dépendants de `review_moments` persistés.
- `visualSeverity` reste prudent et pas toujours informatif.
- CTA import non branché.
- Shell global encore un peu web-app.
- Pas encore d’action utilisateur complète.
- La valeur utilisateur reste surtout démonstrative tant que QG / Forge / Practice ne guident pas l’effort suivant.

Score :
- Technique : 8.5/10. Architecture read-only propre, backend/frontend séparés, smokes solides.
- Produit : 7/10. La surface devient utile, mais ne ferme pas encore une boucle d’action.
- Visuel : 7/10. La Truth Chain a un instrument, mais la DA globale reste jeune.
- Potentiel long terme : 8.5/10. Le contrat peut porter Review, Forge, QG et Profil sans réintroduire de side effects.

## 5. Options de prochaine étape

### Option A — Polish Parties / Truth Chain

But :
Améliorer encore le visuel de Parties.

Avantages :
- Renforce la meilleure surface actuelle.
- Peut améliorer la perception premium rapidement.

Risques :
- Polish infini.
- Risque de travailler la forme avant que plus de surfaces aient une vraie raison d’exister.
- Risque de FX sans donnée supplémentaire.

Verdict :
À éviter sauf bug visuel bloquant.

### Option B — QG réel / Mission Core

But :
Brancher le QG sur une vraie priorité simple issue des données existantes.

Avantages :
- Donne une raison d’ouvrir l’app.
- Relie le shell à l’action quotidienne.
- Rend la navigation utile.
- Peut rester read-only si la priorité est dérivée d’objets existants.

Risques :
- Si la mission devient trop complexe, elle peut toucher Daily Plan trop tôt.
- Risque de confondre priorité lue et planning muté.
- Risque de créer implicitement une mécanique XP/rang.

Verdict :
Candidat recommandé si scope strictement read-only.

### Option C — Forge réelle

But :
Transformer Review/erreurs en entraînement.

Avantages :
- Cœur RPG/progression.
- Surface très proche de la valeur promise.

Risques :
- Risque de création `training_items`.
- Risque `due_at` / révision / scheduling.
- Gros scope backend/frontend.

Verdict :
Trop tôt sans contrat.

### Option D — Profil réel

But :
Commencer stats/répertoire/progression.

Avantages :
- Très désirable.
- Peut rendre le joueur curieux de son évolution.

Risques :
- Métriques non validées.
- Risque dashboard.
- Risque fake progression.
- Risque d’exposer XP/rang/Opening mastery avant contrat.

Verdict :
Trop tôt sauf version read-only très limitée.

### Option E — Arène / Transfer

But :
Tester transfert réel.

Avantages :
- Différenciation majeure.
- Relie entraînement et parties réelles.

Risques :
- Données et logique pas prêtes.
- Risque score fragile.
- Risque d’exposer Transfer Score trop tôt.

Verdict :
Trop tôt.

### Option F — Import PGN REX

But :
Brancher import depuis le shell REX.

Avantages :
- Complète Parties.
- Donne une action évidente dans la surface actuelle.

Risques :
- Peut déclencher import/analyse side effects.
- Scope backend/frontend plus large.
- Risque de dupliquer ou contourner le flux V1.

Verdict :
Possible plus tard, pas maintenant.

## 6. Recommandation

Recommandation principale :
R3A — QG Mission Core Read-Only Contract.

Pourquoi :
Après Parties, la prochaine surface la plus stratégique est QG.
Le QG doit répondre :
“Que dois-je faire maintenant ?”

Mais la prochaine mission ne doit pas encore coder la feature.
R3A doit être un contrat docs-only/read-only, pour éviter :
- mutation Daily Plan ;
- mutation `due_at` ;
- création de training item ;
- XP/rang prématurés ;
- priorité inventée ;
- mission du jour qui ressemble à une vraie planification alors qu’elle n’est pas sûre.

La bonne suite n’est pas plus de FX, ni encore plus de polish Parties.
La bonne suite est de définir une source de priorité lisible, honnête et read-only pour Mission Core.

## 7. R3A scope recommandé

R3A doit définir un contrat pour brancher QG sur une priorité simple read-only.

Sources possibles :
- due training items existants en lecture seule ;
- review moments disponibles ;
- latest game with moments ;
- fallback “importer une partie” si aucune donnée ;
- existing Daily Plan read-only uniquement si safe.

R3A doit décider :
- audit des sources QG read-only existantes ;
- source de priorité ;
- fallback ;
- statut loading/empty/degraded ;
- no side effect ;
- UX states ;
- copy courte ;
- preuves réseau ;
- tests ;
- screenshots.

Le Mission Core doit rester un instrument :
- une priorité dominante ;
- un contrat read-only visible ;
- une action principale honnête ;
- aucun score magique ;
- aucun debug au premier niveau.

## 8. R3A interdits

R3A/R3B ne doivent PAS :
- créer Daily Plan ;
- modifier `due_at` ;
- créer training item ;
- lancer analyse ;
- importer PGN ;
- créer XP ;
- créer rang ;
- créer Transfer Score ;
- modifier backend avant contrat ;
- afficher métrique non validée ;
- appeler une route qui écrit indirectement ;
- appeler une route Practice / Daily Plan sans preuve anti-mutation ;
- transformer un fallback en priorité réelle.

## 9. Tests et preuves attendus pour R3B futur

R3B futur devra prouver :
- GET only ;
- aucun `POST/PATCH/PUT/DELETE` ;
- aucun appel à route unsafe ;
- aucune mutation `due_at` ;
- aucune création training item ;
- aucune mutation Daily Plan ;
- priorité QG visible ;
- fallback empty/degraded visible ;
- contrat read-only visible ;
- screenshots QG loaded/empty/degraded ;
- REX shell smoke ;
- REX Parties smoke ;
- Design Lab smoke ;
- FX Lab smoke ;
- V1 smoke.

Si une source de priorité nécessite une route nouvelle ou une lecture Daily Plan ambiguë :
STOP et créer un contrat backend read-only dédié avant code.

## 10. Décision finale

Recommended next mission:
R3A_QG_MISSION_CORE_READONLY_CONTRACT

Alternative only if human disagrees:
R2M_PARTIES_VISUAL_POLISH_MICRO_PASS

GO_FOR_R3A_AFTER_HUMAN_REVIEW: pending
