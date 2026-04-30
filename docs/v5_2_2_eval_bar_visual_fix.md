# V5.2.2 Evaluation Bar Visual Fix

## Audit

Le composant concerne `frontend/src/components/EvaluationBar.tsx` et le rendu
CSS dans `frontend/src/styles.css`.

Avant correction:

1. Le conteneur visible utilisait `.eval-bar`.
2. La partie noire utilisait `.eval-segment.eval-black`.
3. La partie blanche utilisait `.eval-segment.eval-white`.
4. Le track avait une largeur CSS de `46px` et une hauteur
   `clamp(240px, 38vh, 320px)`.
5. Le parent `.eval-wrap` etait en flex horizontal dans la premiere colonne du
   layout (`76px`).
6. Le label et la source etaient dans le meme flux horizontal que la jauge.
7. Dans l'application reelle, ce parent pouvait compresser visuellement la
   jauge: le label prenait la place disponible et le track se comportait comme
   une ligne verticale.
8. La zone blanche pouvait aussi se confondre avec le fond clair si la bordure
   n'etait pas assez perceptible.
9. Les segments recevaient bien `blackPercent` et `whitePercent`; le probleme
   etait donc DOM/CSS, pas moteur ni formule.

## Correction

La structure DOM est maintenant volontairement simple:

```tsx
<div className="eval-bar-track">
  <div className="eval-bar-black" style={{ height: `${blackPercent}%` }} />
  <div className="eval-bar-cursor" style={{ top: `${blackPercent}%` }} />
  <div className="eval-bar-white" style={{ height: `${whitePercent}%` }} />
</div>
```

En etat indisponible, les deux segments restent visibles a 50/50, avec une
apparence dashed/patterned pour ne pas ressembler a une egalite reelle.

## Dimensions garanties

`.eval-bar-track` impose:

- `width: 28px`;
- `min-width: 28px`;
- `height: 260px`;
- `min-height: 240px`;
- `flex: 0 0 260px`;
- `border: 1px solid #64748b`;
- `overflow: hidden`;
- `display: flex`;
- `flex-direction: column`.

`.eval-wrap` passe en colonne et a une largeur de `76px`. Le label n'est donc
plus en concurrence horizontale avec la jauge.

## Pourcentages

- `blackPercent = 100 - whitePercent`;
- segment noir en haut: `height: blackPercent%`;
- segment blanc en bas: `height: whitePercent%`;
- le curseur est place a `top: blackPercent%`.

La formule d'evaluation, `white_percent`, Stockfish, live-analysis, review,
openings et les conventions POV ne sont pas modifies.

## Verification attendue

- `white_percent=50`: moitie noire, moitie blanche.
- `white_percent=80`: petite zone noire, grande zone blanche.
- `white_percent=20`: grande zone noire, petite zone blanche.
- mate blanc: zone blanche complete avec bordure visible.
- mate noir: zone noire complete.
- pending/indisponible: track visible, pattern discret, pas de label `0.00`.

## Tests

Les tests statiques verifient:

- presence de `.eval-bar-track`;
- presence de `.eval-bar-black` et `.eval-bar-white`;
- application des hauteurs dynamiques;
- largeur minimale visible;
- hauteur minimale visible;
- absence de dependance a `positionMode` dans `EvaluationBar`.

Playwright n'est pas configure dans ce projet; la verification navigateur reste
manuelle.

