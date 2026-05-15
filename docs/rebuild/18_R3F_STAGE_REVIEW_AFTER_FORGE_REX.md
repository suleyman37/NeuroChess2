# R3F Stage Review After Forge — NeuroChess REX

## 1. Statut

Statut :
Bilan stratégique après R3E.

But :
Décider la prochaine étape après avoir sécurisé :
- QG read-only ;
- Parties / Truth Chain read-only ;
- Forge read-only preview.

R3F ne code rien.
R3F décide la suite.

## 2. Ce qui est maintenant acquis

### QG

- Mission Core read-only ;
- mission proposée depuis données existantes ;
- states truth moments / moves-only / empty / degraded ;
- no Daily Plan ;
- no due_at ;
- no training item creation.

### Parties

- history read-only ;
- Truth Chain moments route ;
- frontend connected ;
- fallback moves-only ;
- mini-board ;
- no unsafe /review ;
- no write methods.

### Forge

- read-only preview ;
- moments -> opportunités ;
- existing exercise detected sans Practice ;
- moves-only -> Forge non disponible ;
- empty/degraded states ;
- no false drill ;
- no Practice route ;
- no training item creation ;
- no due_at ;
- no XP/rang/Transfer Score.

### Gouvernance

- contracts docs ;
- REX smokes ;
- V1 smoke ;
- backend read-only route ;
- migration nouveau PC réussie ;
- road-to-V2 propre.

## 3. Ce qui n’est PAS encore acquis

- aucune vraie session Practice REX ;
- aucun entraînement actif ;
- aucun drill créé ;
- aucun training item créé depuis Forge ;
- aucune tentative Practice créée ;
- aucune révision planifiée ;
- aucun due_at piloté ;
- aucun Daily Plan ;
- aucun Profil réel ;
- aucune Arène / Transfer réelle ;
- aucun Import PGN REX ;
- aucun XP/rang/ligue ;
- aucune boucle complète :
  jouer -> review -> Forge -> Practice -> révision -> transfert.

## 4. Évaluation Forge actuelle

### Forces

- Forge commence à répondre “comment transformer ?” ;
- preview read-only honnête ;
- no false drill ;
- no Practice route ;
- no training item side effect ;
- esthétique amber/gold contrôlée ;
- opportunités limitées ;
- no RPG cheap.

### Faiblesses

- pas encore d’entraînement réel ;
- “Préparer la Forge” reste une promesse future ;
- existing exercise detected ne lance rien ;
- mini-board encore petit ;
- Forge reste une preview ;
- valeur utilisateur encore partielle.

### Scores

- sécurité technique : 9/10 ;
- honnêteté produit : 9/10 ;
- clarté UI : 7/10 ;
- potentiel long terme : 8/10 ;
- utilité immédiate : 5/10 ;
- risque de surconstruction : 6/10.

## 5. Options de prochaine étape

### Option A — Forge UI polish

But :
Améliorer visuel, mini-board, labels, opportunités.

Avantages :
- surface plus convaincante.

Risques :
- polish infini ;
- ne débloque pas l’entraînement réel.

Verdict :
À éviter sauf bug bloquant.

### Option B — Practice / Training Boundary Contract

But :
Définir comment passer de preview Forge à action d’entraînement sans side effect accidentel.

Avantages :
- prochaine étape logique vers valeur réelle ;
- prépare vraie boucle.

Risques :
- zone dangereuse : practice_attempts, training_items, due_at, scoring.

Verdict :
Recommandé en docs-only contract avant tout code.

### Option C — Existing Exercise Read-Only Detail

But :
Afficher seulement les détails d’un exercice existant sans lancer Practice.

Avantages :
- moins risqué que Practice actif.

Risques :
- peut devenir faux entraînement si trop limité.

Verdict :
Option intermédiaire possible.

### Option D — Profil read-only

But :
Afficher progression/répertoire/habitudes.

Avantages :
- motivant.

Risques :
- fake progression ;
- dashboard creux ;
- métriques prématurées.

Verdict :
Trop tôt avant vraie boucle d’entraînement.

### Option E — Import PGN REX

But :
Rendre Parties autonome.

Avantages :
- augmente la matière.

Risques :
- pipeline import/analyse/review complexe ;
- side effects.

Verdict :
Important, mais pas maintenant.

### Option F — Arène / Transfer

But :
Vérifier transfert en vraie partie.

Avantages :
- différenciation forte.

Risques :
- trop tôt sans Practice/révision.

Verdict :
Trop tôt.

### Option G — CSS/component refactor

But :
Réduire dette CSS REX.

Avantages :
- CSS grossit.

Risques :
- refactor tunnel ;
- faible valeur utilisateur.

Verdict :
À différer sauf douleur réelle.

## 6. Recommandation

Recommandation principale :
R3G_PRACTICE_BOUNDARY_READONLY_CONTRACT

Pourquoi :
La suite naturelle est de définir la frontière entre :
- Forge preview ;
- exercice existant ;
- Practice actif ;
- création de tentative ;
- due_at ;
- révision ;
- scoring.

Mais il ne faut PAS coder Practice encore.
R3G doit être un contrat docs-only.

## 7. R3G direction proposée

R3G doit définir :

- quelles routes Practice existent ;
- lesquelles sont safe ou unsafe ;
- si une route read-only de détail d’exercice existe ;
- si lancer une tentative crée une practice_attempt ;
- quels effets sur due_at ;
- quels effets sur training_items ;
- quels effets sur Daily Plan ;
- ce qu’un CTA “Voir l’exercice existant” peut faire sans write ;
- ce qui exige un contrat backend anti-mutation.

R3G doit répondre :
“Quelle est la plus petite action d’entraînement honnête et sûre après Forge ?”

## 8. R3G interdits

R3G/R3H ne doivent pas encore :
- créer practice_attempt ;
- créer training_item ;
- modifier due_at ;
- modifier Daily Plan ;
- lancer scoring ;
- enregistrer résultat ;
- révéler solution ;
- créer XP/rang ;
- créer Transfer Score ;
- appeler route Practice unsafe ;
- appeler route Daily Plan ;
- appeler /games/{game_id}/review.

## 9. Risques à verrouiller

- practice_attempt creation ;
- training item creation ;
- due_at mutation ;
- Daily Plan mutation ;
- scoring write ;
- false “exercise ready” ;
- CTA trompeur ;
- replay qui devient tentative ;
- reveal solution ;
- route Practice qui écrit en GET ;
- métrique non validée ;
- frustration si action trop limitée.

## 10. Résultat attendu R3G

Créer futur document :
docs/rebuild/19_R3G_PRACTICE_BOUNDARY_READONLY_CONTRACT_REX.md

Il doit définir :
- audit Practice routes ;
- allowed/forbidden actions ;
- read-only exercise detail if exists ;
- view-model ;
- smokes ;
- anti-mutation tests ;
- screenshots R3H futurs ;
- GO/NO-GO.

## 11. Alternative si humain refuse Practice boundary

Alternative :
R3G_FORGE_POLISH_MICRO_CONTRACT

Seulement si :
- Forge est jugée trop faible visuellement ;
- on veut consolider avant Practice boundary.

Mais recommandation principale :
Practice boundary contract.

## 12. Décision finale

Recommended next mission:
R3G_PRACTICE_BOUNDARY_READONLY_CONTRACT

Do not start Practice implementation yet.
Do not start Profil.
Do not start Arène.
Do not start XP/rank.
Do not start Import PGN.

GO_FOR_R3G_AFTER_HUMAN_REVIEW: pending
