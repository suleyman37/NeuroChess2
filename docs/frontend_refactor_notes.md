# Frontend Review Refactor Notes

V5.4.FRONT-REF1 split the Review UI into `frontend/src/components/review/`.

Future hook candidates, intentionally not implemented in this pass:

- `useReviewOverlays`
- `useReviewPractice`
- `usePvStepper`
- `useReviewNavigation`
- `useOpeningGuide`

`App.tsx` still owns the board lifecycle, overlays, practice session state, and PV animation timing. Those areas are coupled to board position updates and should be extracted only after this component split has settled.
