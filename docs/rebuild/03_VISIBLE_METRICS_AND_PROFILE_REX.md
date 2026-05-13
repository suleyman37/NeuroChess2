# Visible Metrics And Profile REX

## Principe

Peu de metriques visibles, mais fortes, actionnables, fiables et addictives. Une metrique visible doit aider l'utilisateur a comprendre quoi travailler, quoi verifier, ou quoi celebrer.

Regles generales :

- jamais afficher une metrique sans echantillon minimal ;
- jamais afficher un pourcentage comme verite absolue si la metrique est shadow ou heuristique ;
- chaque metrique visible doit avoir une definition, une source data, un seuil d'echantillon, des limites, une action recommandee et un test prevu.

## 1. XP Utile

Definition :

XP gagne par effort reel, reussite, revision due et transfert confirme.

Regles :

- pas de XP pour clic passif ;
- XP pour tentative active ;
- XP pour revision faite au bon moment ;
- XP pour reussite utile ;
- XP bonus prudent quand un transfert est confirme.

## 2. Maitrise Theorique D'Ouverture

Exemple :

Najdorf 71%

Mesure :

Capacite a rejouer une ligne ou variation avec ponderation par difficulte, embranchements et rappel.

Limite :

Ce score ne doit pas dire que le joueur comprend toute l'ouverture. Il mesure d'abord la restitution theorique.

## 3. Execution Reelle D'Ouverture

Mesure :

Performance en vraie partie dans les coups theoriques.

Regles :

- afficher seulement avec seuil d'echantillon ;
- distinguer coups theoriques joues, deviations subies et erreurs de sortie ;
- relier chaque alerte a une partie ou une ligne observable.

## 4. Clarte De Plan Post-Ouverture

Mesure :

Capacite a savoir quoi faire apres la sortie du livre.

Distinguer :

- connaitre la ligne ;
- comprendre le plan.

Cette metrique doit eviter le piege "je connais 15 coups mais je ne sais pas jouer la position".

## 5. Transfer Score

Mesure :

Passage entrainement -> partie reelle.

Afficher en paliers :

- non confirme ;
- fragile ;
- en progression ;
- confirme.

Regle :

Pas d'opportunite reelle detectee = pas de conclusion forte.

## 6. Autopilot / Habit Index

Mesure :

Patterns de coups reflexes negatifs.

Exemples :

- coup de pion joue par habitude ;
- meme type de plan mauvais ;
- repetition dans positions similaires.

Prudence :

Afficher avec exemples, pas comme diagnostic mental. Cette metrique observe des decisions repetees, pas une psychologie cachee.

## 7. Robustesse Sous Pression

Mesure :

Qualite selon cadence, zeitnot, rapid, blitz ou classical.

Regles :

- seuil d'echantillon obligatoire ;
- ne pas confondre une mauvaise partie et un pattern ;
- relier la recommandation a un entrainement concret.

## 8. Reconnaissance Tactique Vs Strategique

But :

Aider l'utilisateur a comprendre s'il rate surtout :

- tactique forcee ;
- plan strategique ;
- conversion ;
- defense ;
- calcul ;
- ouverture.

Cette classification doit guider la Forge et le Profil. Elle ne doit pas devenir une etiquette humiliante.

## Contrat D'Une Metrique Visible

Chaque metrique visible doit declarer :

- definition ;
- source data ;
- seuil d'echantillon ;
- limites ;
- action recommandee ;
- test prevu.

## Exemple De Profil

- Rang : Calculateur III
- XP utile : 18 420
- Najdorf theory : 82%
- Najdorf real execution : 61%
- Plan post-ouverture : 44%
- Transfer tactique : fragile
- Habit alert : coups de pion reflexes en position floue
