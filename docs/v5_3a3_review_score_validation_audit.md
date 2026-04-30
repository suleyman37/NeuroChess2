# V5.3.A3 - Audit de validation du score Review

## Objet

Audit du score Review apres observation utilisateur :

- Review parfois instantanee ;
- ecart important avec Chess.com ;
- suspicion sur la source d'analyse et la perspective de score ;
- besoin d'auditer mathematiquement chaque coup score.

## Pourquoi une Review peut etre instantanee

Le backend lit d'abord les analyses deep deja presentes dans `position_analyses`.

Une reponse instantanee peut donc venir de :

- `cached_full` : toutes les positions requises ont deja une analyse deep `done` ;
- `cached_partial` : assez de positions sont disponibles pour une Review partielle ;
- ancienne review courante avec meme `selection_algorithm_version` ;
- cache d'analyses deep cree par une tentative precedente.

Ce comportement est acceptable seulement si le payload l'explique. V5.3.A3 expose
donc `review_analysis_origin`, `review_analysis_state`, `review_analysis_quality`
et les compteurs de couverture.

Le score ne doit pas utiliser live, shallow, currentFen, fallback 50 % ou fallback
100 %. Si des deep manquent, le payload expose `newly_scheduled`, `pending`,
`deep_missing_count` et `review_work_active`.

## Donnees scorees

Le score est calcule sur tous les coups analysables, pas seulement les moments
Review.

Un coup est inclus si :

- `played_by` est connu ;
- `fen_before` a une analyse deep `done` exploitable ;
- `fen_after` a une analyse deep `done` exploitable ;
- une evaluation ou un mate est disponible avant et apres.

Un coup exclu incremente `score_missing_moves_white` ou
`score_missing_moves_black` et apparait dans `review_score_audit_rows` avec
`included_in_score=false` et `exclusion_reason`.

## Perspective verifiee

Convention :

- `eval_cp` est toujours POV Blancs ;
- Blancs : `P = white_percent` ;
- Noirs : `P = 100 - white_percent`.

Pour chaque coup :

```text
win_loss = max(0, P_before - P_after)
```

Le score ne lit pas l'evaluation du mauvais joueur.

## Couverture et qualite

Le payload expose :

- `number_of_moves_white`
- `number_of_moves_black`
- `score_analyzed_moves_white`
- `score_analyzed_moves_black`
- `score_missing_moves_white`
- `score_missing_moves_black`
- `required_position_count`
- `deep_done_count`
- `deep_missing_count`
- `deep_failed_count`
- `deep_coverage`
- `review_analysis_quality`
- `review_analysis_origin`
- `review_analysis_state`

Le mode actuellement supporte reellement est surtout `cached` / `standard` :

- `cached` : analyses deja disponibles ;
- `standard` : analyses deep programmees par le pipeline existant.

`fast` et `deep` sont des qualites reservees : elles ne sont pas pretendues si
l'infrastructure ne les garantit pas.

## Profondeur et moteur

Les composants debug par couleur exposent maintenant :

- `depth_min`
- `depth_max`
- `depth_avg`
- `engine_versions`

Ces champs permettent de verifier si les evaluations utilisees ressemblent a des
analyses deep stables ou a des donnees insuffisantes.

## Colonnes audit par coup

`review_score_audit_rows` expose :

- ply, side, SAN/UCI ;
- eval/mate avant et apres ;
- Win% Blancs avant/apres ;
- Win% joueur avant/apres ;
- win_loss ;
- score coup ;
- criticality_score ;
- move_weight ;
- inclusion/exclusion ;
- analysis_kind before/after ;
- depth before/after ;
- source before/after ;
- engine_version before/after.

Ce tableau est destine au debug DEV replie, pas a l'interface normale.

## Cause probable des ecarts

Les ecarts importants avec Chess.com peuvent venir de :

- formule proprietaire Chess.com CAPS2 ;
- profondeur et moteur differents ;
- difference de conversion Win% ;
- cap V5.3.A2 trop punitif sur une seule grosse perte ;
- coverage deep insuffisante ;
- difference de ponderation des positions deja perdues/gagnees.

V5.3.A3 adoucit donc les caps, garde le score sur tous les coups analysables et
rend chaque coup auditable.
