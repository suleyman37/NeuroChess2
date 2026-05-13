# R1 FRONTEND SHELL CONTRACT - REX

## 1. Mission R1 En Une Phrase

Creer un nouveau shell frontend isole, DEV-only ou feature-flagged, avec 5 surfaces :

QG - Parties - Forge - Arene - Profil.

## 2. Objectif Exact

R1 doit prouver :

- la nouvelle navigation fonctionne ;
- les 5 surfaces existent ;
- chaque surface a une question utilisateur claire ;
- chaque surface a un etat vide premium ;
- aucune logique backend nouvelle n'est creee ;
- aucune metrique reelle non validee n'est affichee ;
- la V1 existante reste intacte.

R1 est un contrat de shell, pas une reconstruction produit complete. Le but est de poser la charpente visible de la nouvelle doctrine sans rebrancher prematurement la science, les metriques ou la gamification.

## 3. Non-Objectifs R1

R1 ne doit PAS :

- coder XP reel ;
- coder Transfer Score reel ;
- coder Opening Forge reel ;
- coder Autopilot Index ;
- integrer Spline en produit ;
- refactorer backend ;
- modifier les anciens plans ;
- reecrire `App.tsx` massivement ;
- brancher des metriques non validees ;
- creer une UI complete finale ;
- toucher aux routes V1 existantes au-dela du minimum necessaire pour acceder au shell isole.

## 4. Route / Acces Recommande

Route recommandee :

```text
/app?rex=1
```

Justification :

- le mode REX reste un acces discret DEV-only par query param ;
- `/app` normal reste la V1 existante ;
- aucun quatrieme ou cinquieme onglet n'est ajoute a l'ancienne V1 ;
- la navigation 5 surfaces vit uniquement dans le nouveau shell REX ;
- le choix suit le precedent des flags prototype par URL et limite le risque de collision avec les routes hash existantes.

Contraintes :

- ne pas remplacer la V1 par defaut ;
- ne pas casser `/app` existant ;
- acces discret DEV-only ;
- aucun quatrieme/cinquieme onglet ajoute dans l'ancienne V1 ;
- la nouvelle navigation 5 surfaces vit uniquement dans le nouveau shell REX.

## 5. Dossier Cible Recommande

Architecture recommandee :

```text
frontend/src/rex/
  RexApp.tsx
  RexShell.tsx
  RexNav.tsx
  surfaces/
    QGSurface.tsx
    PartiesSurface.tsx
    ForgeSurface.tsx
    ArenaSurface.tsx
    ProfileSurface.tsx
  components/
  data/
  rexStyles.css
```

Regles :

- ne pas empiler dans `frontend/src/v2/product-vision/` ;
- ne pas continuer l'ancien Product Vision WIP ;
- ne pas grossir `App.tsx` sauf micro-route gate ;
- garder les composants REX isolables et supprimables ;
- ne pas importer de dependance lourde pour R1.

## 6. Contrat De Chaque Surface

### QG

User question :

> Que dois-je faire maintenant pour progresser ?

Primary empty-state message :

> Ton QG est pret. La prochaine version connectera tes vraies parties, tes revisions et tes priorites.

Primary CTA placeholder :

> Voir la mission du jour

Forbidden content :

- dashboard complet ;
- metriques reelles non validees ;
- 3D lourde ;
- prediction Elo ;
- claim cerveau/neuroscience.

### Parties

User question :

> Que disent mes vraies parties ?

Primary empty-state message :

> Tes parties deviendront la source des reviews, des erreurs utiles et des bonnes decisions a conserver.

Primary CTA placeholder :

> Preparer un import PGN

Forbidden content :

- liste morte de parties ;
- verdict vague ;
- raw WDL ;
- `criticality_score` ;
- donnees fake presentees comme reelles.

### Forge

User question :

> Comment je transforme mes erreurs en force ?

Primary empty-state message :

> La Forge transformera tes moments critiques en exercices, revisions et lignes d'ouverture a consolider.

Primary CTA placeholder :

> Voir les exercices a venir

Forbidden content :

- puzzle trainer generique ;
- XP reel non contracte ;
- mastery numerique non validee ;
- FSRS visible ;
- due_at fake presente comme vrai.

### Arene

User question :

> Est-ce que ce que j'ai appris passe en vraie partie ?

Primary empty-state message :

> L'Arene verifiera plus tard si tes entrainements tiennent en blitz, rapid et parties longues.

Primary CTA placeholder :

> Voir les defis de transfert

Forbidden content :

- Transfer Gap brut ;
- leaderboard force ;
- humiliation ;
- prediction Elo ;
- score de transfert reel sans seuils.

### Profil

User question :

> Qui suis-je comme joueur et comment je progresse ?

Primary empty-state message :

> Ton Profil deviendra le hub de ton rang, de ton repertoire, de tes habitudes et de ta progression.

Primary CTA placeholder :

> Voir le profil prototype

Forbidden content :

- profil reduit a parametres ;
- stats infinies sans action ;
- cerveau du joueur ;
- 3D decorative non reliee a une metrique ;
- diagnostic mental.

Important :

Les surfaces peuvent utiliser des fake placeholders, mais doivent etre clairement marquees comme prototype REX. Aucune fausse donnee ne doit etre presentee comme reelle.

## 7. UI/UX Acceptance Criteria

R1 doit fournir :

- nav 5 surfaces visible et claire ;
- une seule surface active a la fois ;
- aucun scroll absurde desktop ;
- pas de surcharge de metriques ;
- pas de Spline ;
- pas de 3D ;
- pas de dashboard dense ;
- pas de wording fake neuroscience ;
- pas de prediction Elo ;
- pas de "ton cerveau" ;
- jugement de coup autorise uniquement comme exemple de copy, pas comme donnee reelle ;
- design premium mais sobre ;
- screenshots obligatoires.

## 8. Technical Acceptance Criteria

R1 doit :

- compiler ;
- passer tsc ;
- passer build frontend ;
- preserver V1 browser smoke ;
- creer un smoke REX minimal ;
- eviter `App.tsx` monolithique ;
- limiter modifications `App.tsx` a un gate d'acces si necessaire ;
- ne pas modifier backend ;
- ne pas modifier plans ;
- ne pas modifier `docs/rebuild` sauf si mission dediee.

## 9. Tests Attendus R1

Commandes attendues :

- `git diff --check` ;
- `npm --prefix frontend run build` ;
- `npx tsc --noEmit` depuis `frontend` ;
- `node scripts/browser_v1_flow_smoke.mjs` ;
- `node scripts/browser_rex_shell_navigation_smoke.mjs`.

Le smoke REX doit verifier :

- route REX charge ;
- les 5 surfaces existent ;
- navigation entre surfaces fonctionne ;
- V1 route normale existe toujours ;
- pas de textes interdits ;
- pas de crash console critique.

## 10. Screenshots Attendus R1

R1 doit fournir des screenshots :

- QG ;
- Parties ;
- Forge ;
- Arene ;
- Profil ;
- V1 inchangee ou smoke evidence.

Les screenshots doivent montrer le shell dans son etat vide premium, pas une fausse app deja connectee.

## 11. Rollback R1

Rollback attendu :

- supprimer `frontend/src/rex/` ;
- supprimer le smoke REX ;
- retirer le micro-route gate dans `App.tsx` ;
- verifier que la V1 revient inchangee.

Le rollback doit etre possible sans migration, sans data cleanup et sans changement backend.

## 12. GO / NO-GO R1

`GO_FOR_R1` seulement si :

- ce document est valide ;
- repo clean ;
- R1 reste shell-only ;
- le scope est accepte.

`NO_GO_FOR_R1` si :

- R1 veut brancher des metriques reelles ;
- R1 veut introduire Spline/3D produit ;
- R1 veut refactorer massivement `App.tsx` ;
- R1 veut modifier backend ou anciens plans ;
- R1 ne prevoit pas de smoke V1 unchanged.
