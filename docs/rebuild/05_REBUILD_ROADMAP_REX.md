# Rebuild Roadmap REX

## R0 - Doctrine Et Contrats

Statut : cette mission.

Objectif :

Creer la doctrine de metamorphose et les contrats de rebuild.

Scope autorise :

- `docs/rebuild/*`.

Scope interdit :

- backend ;
- frontend applicatif ;
- anciens plans ;
- feature produit.

Preuves attendues :

- sept documents REX presents ;
- diff limite a `docs/rebuild/*` et bruit local Serena eventuel.

Tests attendus :

- `git diff --check` ;
- verification que seuls `docs/rebuild/*` sont crees/modifies.

Rollback :

- supprimer uniquement `docs/rebuild/*` si la doctrine est refusee.

## R1 - Greenfield Frontend Shell 5 Surfaces

Objectif :

Creer un nouveau shell isole, feature-flag/dev route, avec QG, Parties, Forge, Arene et Profil.

Scope autorise :

- nouveau shell frontend isole ;
- route dev ou feature flag ;
- navigation 5 surfaces ;
- empty/loading/error states de shell.

Scope interdit :

- backend changes ;
- vieux `App.tsx` refactor massif ;
- connexion metriques reelles non contractees ;
- 3D produit.

Preuves attendues :

- screenshots desktop ;
- navigation stable ;
- ancien flux V1 non casse.

Tests attendus :

- build frontend ;
- smoke route shell ;
- V1 unchanged smoke.

Rollback :

- retirer la route/flag et le nouveau dossier shell sans toucher au backend.

## R2 - Reconnecter Backend Existant

Objectif :

Reconnecter import, Review, Practice et Daily Plan dans le nouveau shell.

Scope autorise :

- clients API existants ;
- mapping UI vers endpoints existants ;
- etats de chargement/erreur.

Scope interdit :

- nouvelles formules ;
- migration DB non necessaire ;
- mutation Daily Plan hors contrats existants.

Preuves attendues :

- import -> analyse -> Review -> Practice visible dans le shell ;
- backend conserve.

Tests attendus :

- browser flow ;
- backend targeted tests si endpoint touche ;
- no forbidden metrics.

Rollback :

- desactiver les connexions via feature flag.

## R3 - Profil V1 Utile

Objectif :

Creer un Profil utile : XP, ouvertures, transfer status, pressure, habit cards en 2D.

Scope autorise :

- cartes Profil 2D ;
- seuils d'echantillon visibles ;
- donnees existantes ou mock explicite si dev-only.

Scope interdit :

- Spline prod ;
- prediction Elo ;
- diagnostic mental.

Preuves attendues :

- Profil actionnable ;
- parametres toujours accessibles mais secondaires.

Tests attendus :

- smoke Profil ;
- no fake science ;
- no forbidden metrics.

Rollback :

- retirer les cartes Profil ou revenir au Profil minimal.

## R4 - Opening Forge

Objectif :

Construire l'entrainement ligne/variation, le score mastery prudent, la sortie d'ouverture et le plan post-ouverture.

Scope autorise :

- Forge opening ;
- preuves par parties ;
- thresholds documentes.

Scope interdit :

- pourcentage sans echantillon ;
- claim de maitrise absolue.

Preuves attendues :

- une ouverture reliee a parties et exercices.

Tests attendus :

- tests service si metrique ;
- browser Forge ;
- registry metrique/action si necessaire.

Rollback :

- masquer le module opening via feature flag.

## R5 - Arene / Transfer Visible

Objectif :

Afficher le Transfer Score par paliers, les defis de transfert et la robustesse cadence.

Scope autorise :

- paliers prudents ;
- defis opt-in ;
- evidence par opportunites.

Scope interdit :

- Transfer Gap brut ;
- humiliation ;
- leaderboard force.

Preuves attendues :

- explication d'echantillon ;
- action recommandee.

Tests attendus :

- no raw internal metrics ;
- transfer threshold tests.

Rollback :

- revenir a statut interne non visible.

## R6 - Habit/Autopilot Index Shadow -> Visible

Objectif :

Rendre visibles des patterns negatifs avec preuves et exemples.

Scope autorise :

- exemples de positions ;
- langage prudent ;
- seuils.

Scope interdit :

- diagnostic mental ;
- etiquette humiliante.

Preuves attendues :

- habit card liee a decisions observees.

Tests attendus :

- microcopy safety ;
- sample threshold checks.

Rollback :

- remettre l'index en shadow.

## R7 - XP/Rang/Ligues Opt-In

Objectif :

Ajouter saisons, rang interne et recompense utile.

Scope autorise :

- XP utile ;
- rangs ;
- ligues opt-in.

Scope interdit :

- XP clic passif ;
- leaderboard impose.

Preuves attendues :

- XP lie a effort, revision, transfert.

Tests attendus :

- anti-abuse XP ;
- UI opt-in.

Rollback :

- desactiver saisons/ligues via flag.

## R8 - Visual Lab -> Premier Widget 3D Promu

Objectif :

Promouvoir un seul asset 3D valide, probablement Profil/repertoire.

Scope autorise :

- un asset ;
- fallback 2D ;
- lazy loading ;
- reduced motion.

Scope interdit :

- board central ;
- feedback coup systematique ;
- CDN critique.

Preuves attendues :

- screenshots valides humainement ;
- performance acceptable ;
- `GO_FOR_PROMOTION`.

Tests attendus :

- load/fallback ;
- reduced motion ;
- no fake science.

Rollback :

- retirer l'asset et garder fallback 2D.
