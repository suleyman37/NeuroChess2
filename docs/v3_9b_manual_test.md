# V3.9b Manual Test Protocol

## Objectif

Verifier que l'analyse live progressive demarre, streame, s'arrete et redemarre
proprement sans polluer la DB ni bloquer `POST /moves`.

## Protocole

1. Lancer l'application.
2. Creer une nouvelle partie.
3. Jouer `e2e4`.
4. Verifier que la barre affiche l'evaluation shallow immediate.
5. Verifier que la reponse `POST /moves` contient `live_analysis_session_id`.
6. Ouvrir les outils reseau du navigateur et verifier la connexion
   `GET /live-analysis/stream?session_id=...`.
7. Verifier que la barre peut passer en source `live` et se mettre a jour avec
   des profondeurs/nodes croissants.
8. Jouer un nouveau coup, par exemple `e7e5`.
9. Verifier que l'ancien `EventSource` est ferme et qu'une nouvelle session est
   utilisee.
10. Verifier qu'aucune update de l'ancien `session_id` ne modifie la barre.
11. Verifier que `position_analyses` ne contient aucune ligne
    `analysis_kind='live'`.
12. Executer le build frontend.

## Commandes utiles

```powershell
python -m unittest discover backend/tests
cd frontend
npm run build
```

## Resultat attendu

- La partie reste jouable meme si l'analyse live echoue.
- `POST /moves` retourne rapidement et ne contient pas d'update live.
- La barre conserve la shallow immediate, puis accepte les updates live SSE.
- Le frontend ignore les updates stale par `session_id` et FEN/ply.
- Les updates live restent en memoire/streaming et ne deviennent pas des
  analyses canoniques.
