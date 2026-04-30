# V5.3.A4 - Audit analyse Review time-budgeted

## Constat

Avant V5.3.A4, une analyse Review pouvait paraitre instantanee meme quand
l'utilisateur demandait une analyse approfondie. Le flux durable stockait deja
des lignes `position_analyses` avec `analysis_kind="deep"`, mais ces lignes ne
portaient pas de profil de qualite explicite.

## Appel Stockfish avant correction

Le chemin deep passait par `AnalysisService._call_engine`, puis
`StockfishService.analyze_stabilized_fen` quand disponible.

Le mode implicite etait equivalent a un mode mixte :

```text
Limit(depth=depth, time=time_budget_sec)
```

Avec les valeurs par defaut historiques :

- `depth = 12`
- `TIME_BUDGET_MS_DEEP = 5000`
- `multipv = 3`

Cela veut dire que Stockfish pouvait s'arreter des que la profondeur 12 etait
atteinte, meme si le budget temps n'etait pas consomme. Une analyse appelee
`deep` pouvait donc etre rapide, et parfois trop faible pour un score Review
serieux.

## Pourquoi une nouvelle Review pouvait etre instantanee

Causes trouvees :

- des analyses legacy `analysis_kind="deep"` existaient deja en cache ;
- ces analyses n'avaient pas `analysis_profile`, `requested_time_ms` ni
  `analysis_limit_mode` ;
- le cache etait consulte comme une analyse deep valide sans verifier un profil
  standard/deep ;
- les anciennes analyses depth12 pouvaient donc satisfaire une Review qui se
  presentait comme approfondie ;
- le score pouvait etre calcule sur ces donnees si la couverture etait suffisante.

Ce n'etait pas un lancement massif cache : le probleme etait surtout un manque
de qualification de la profondeur/du temps reel.

## Champs disponibles et champs manquants

Champs deja presents dans `position_analyses` :

- `depth`
- `multipv`
- `analysis_time_ms`
- `engine_version`
- `schema_version`
- `analysis_kind`
- `status`
- `reliability_score`
- `reliability_label`
- `analysis_json`

Champs ajoutes par V5.3.A4 :

- `analysis_profile`
- `requested_time_ms`
- `requested_depth`
- `requested_multipv`
- `analysis_limit_mode`
- `settings_json`

## Conclusion

La cause exacte de l'instantaneite suspecte etait la reutilisation possible de
caches legacy/depth12 et l'appel Stockfish mixte `depth + time`. V5.3.A4 separe
desormais les profils `quick`, `standard` et `deep`, utilise `Limit(time=...)`
pour standard/deep, et refuse qu'un cache legacy satisfasse une demande standard
ou deep.
