# Protocole de collaboration IA - NeuroChess2

Ce protocole organise la collaboration entre l'humain, ChatGPT, Claude Opus,
Codex et Claude Code sur NeuroChess2.

## Rôles

- Humain : product owner, arbitre final, testeur navigateur.
- ChatGPT 5.5 Thinking : architecte strategique, construction des prompts,
  synthese, controle du scope.
- Claude Opus 4.7 : contre-architecte strategique, critique produit et
  architecture, detection des angles morts.
- Codex : implementeur principal par defaut.
- Claude Code : auditeur principal par defaut; peut corriger seulement les
  petits bugs triviaux si cela est demande explicitement.

## Règle centrale

Un seul agent modifie le code a la fois.

Un agent peut auditer, lire, proposer ou rediger un handoff pendant qu'un autre
prepare une mission, mais une seule entite doit avoir la responsabilite active
des modifications de fichiers.

## Règles Git

- Idealement : une branche Git par mission.
- Si Git n'est pas disponible : faire au minimum un backup/copie du dossier
  avant chaque mission IA.
- Ne pas modifier `main` directement si possible.
- Ne pas merger sans validation humaine.
- Inspecter le diff apres chaque mission IA quand Git est disponible; sinon
  comparer manuellement les fichiers modifies avec le backup.

## Niveaux de décision

### 1. Stratégique

Exemples :

- nouvelle version ;
- migration ;
- nouvel endpoint ;
- changement UX important ;
- changement de formule ;
- changement roadmap ;
- refactor important.

Regle : debat ChatGPT + Claude Opus avant execution.

### 2. Tactique

Exemples :

- wording ;
- petit CSS ;
- test simple ;
- doc simple ;
- bug local.

Regle : un seul modele suffit.

### 3. Trivial

Exemples :

- typo ;
- import manquant ;
- null check ;
- petite condition evidente ;
- lint warning.

Regle : Claude Code peut corriger si l'humain l'autorise explicitement.

## Workflow standard

1. Besoin identifie.
2. Classer la mission : strategique, tactique ou trivial.
3. Si strategique : debat ChatGPT + Claude Opus.
4. Implementation : Codex par defaut.
5. Handoff apres mission.
6. Audit Claude Code si version importante ou bug risque.
7. Test humain navigateur si UI.
8. Version suivante seulement apres validation.

## Règle anti-débat infini

Maximum 2 rounds ChatGPT <-> Claude Opus avant execution, sauf decision
exceptionnelle explicite de l'humain.

## Règle bug persistant

Si un bug utilisateur survit a 2 corrections :

- arreter les nouvelles features ;
- diagnostiquer le flux reel ;
- verifier les logs ;
- verifier le reseau ;
- verifier le state frontend ;
- construire une reproduction minimale ;
- ne pas continuer la roadmap tant que ce bug existe.

## Règle de passage version suivante

Ne pas passer a une nouvelle version si :

- bug UX bloquant encore visible ;
- test navigateur non fait alors qu'il est necessaire ;
- comportement reel different du prompt ;
- handoff incomplet ;
- scope incertain.
