# V3.9c Live State Audit

Etat documente avant correction V3.9c.

## 1. Stockage frontend de "analyse live indisponible"

- L'etat est stocke dans `frontend/src/App.tsx` via `liveStatus`.
- Le rendu affiche `liveStatus` dans un bloc `.warning`, donc en warning jaune.

## 2. Evenements qui declenchent le warning

- `analysis_error` dans `eventSource.onmessage` appelle
  `setLiveStatus("analyse live indisponible")`.
- Toute erreur `EventSource.onerror` appelle aussi
  `setLiveStatus("analyse live indisponible")`.

## 3. Effacement sur update valide

- Une update live valide appelle `setLiveStatus(null)`.
- Probleme: un `onerror` ulterieur peut retablir le warning meme apres une
  update live valide, ce qui permet l'etat contradictoire `+1.51 live` + warning.

## 4. Close normal interprete comme erreur

- Le code V3.9b ferme l'EventSource sur cleanup et peut recevoir un `onerror`
  quand le stream se termine cote navigateur.
- Avant V3.9c, `onerror` ne distingue pas fermeture normale, stop volontaire,
  ancienne session ou vraie indisponibilite avant premiere update.

## 5. analysis_stopped vs analysis_error

- `analysis_stopped` est distingue dans `onmessage`, mais le code fait seulement
  `return`.
- Il ne ferme pas explicitement le stream et ne marque pas la session comme stop
  normal.
- `analysis_error` est distingue et affiche un warning jaune.

## 6. Source live avec live_error actif

- Oui, c'est possible avant V3.9c:
  1. update live valide;
  2. `EvaluationBar` affiche une source `live`;
  3. `onerror` se declenche ensuite;
  4. `liveStatus` devient `analyse live indisponible`.

## 7. evaluation_source.kind live alors que source reelle shallow

- `POST /moves` retourne `evaluation_source.kind = "shallow"`.
- Les updates SSE retournent `evaluation_source.kind = "live"`.
- Le frontend remplace shallow par live seulement dans le handler SSE quand
  `update.evaluation_source` existe.
- Le probleme observe n'est donc pas une mauvaise source shallow/live; c'est un
  warning live stale qui reste actif ou se rallume apres une update valide.
