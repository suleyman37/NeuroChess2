# Codex Execution Guardrails REX

## But

Adapter l'esprit de Plan3 a la refondation NeuroChess sans perdre la discipline qui a evite les grosses regressions.

## Regles De Mission

- une mission = un objectif ;
- pas de commit/stage/push par defaut ;
- jamais `git add -A` ;
- pas de backend + frontend + docs en meme temps sauf mission explicitement systeme ;
- pas de modification des anciens plans sans mission dediee ;
- pas de Spline en produit sans Visual Lab ;
- pas de tests qui ne font que suivre la mauvaise UI ;
- chaque mission UI doit fournir screenshots ;
- chaque mission frontend doit eviter `App.tsx` monolithique ;
- chaque metrique visible doit avoir formule + sample threshold + limitation + tests ;
- chaque nouvel onglet doit avoir `user_question` + primary action + empty/loading/error states ;
- chaque refactor doit avoir rollback.

## Anti-Patterns Codex Observes

- prompts trop larges ;
- WIP visuel enorme ;
- smokes PASS mais UX mauvaise ;
- `App.tsx` qui grossit ;
- CSS monolithe ;
- `qa_artifacts` dans repo ;
- `.serena` dirty ;
- Spline exploratoire trop couteux ;
- Brain Core integre au mauvais endroit.

## Discipline Rebuild

R1 et les missions suivantes doivent privilegier les dossiers isoles, les feature flags et les preuves visuelles. Le rebuild partiel ne doit pas devenir un refactor opportuniste de tout le repo.

Chaque mission frontend doit declarer :

- surface concernee ;
- question utilisateur ;
- primary action ;
- etats empty/loading/error ;
- donnees lues ;
- donnees ecrites ;
- rollback.

Chaque mission metrique doit declarer :

- definition ;
- formule ;
- source data ;
- sample threshold ;
- limite ;
- risque d'interpretation ;
- test de non-regression.

Chaque mission 3D doit declarer :

- pourquoi la 2D ne suffit pas ;
- contexte rare ;
- fallback ;
- reduced motion ;
- cout runtime ;
- screenshot valide ;
- `GO_FOR_PROMOTION`.

## Tests Pour R0

Pour cette mission documentaire :

- `git diff --check` ;
- pas besoin de build si seuls `docs/rebuild/*` sont crees ;
- verifier que seuls `docs/rebuild/*` sont modifies/crees, avec exception possible de bruit local `.serena/project.yml` jamais stage.

## Regle Finale

Le futur NeuroChess doit etre plus ambitieux, mais Codex doit rester plus strict. Le produit peut devenir plus competitif, plus visuel et plus RPG ; l'execution doit rester petite, prouvable et reversible.
