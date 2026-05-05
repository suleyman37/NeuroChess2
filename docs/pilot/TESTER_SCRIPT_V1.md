# Tester Script V1

Use this script during a 45-60 minute controlled local pilot. The facilitator
may read it aloud or use it as a checklist.

## A. Setup

What tester does:
- Open NeuroChess V1 on the prepared local machine.
- Confirm they are using copied or non-sensitive PGNs.

Expected result:
- The app opens on the main V1 shell.
- Main navigation shows Aujourd'hui, Mes parties, Entrainement.

Report if it fails:
- App does not open.
- Main navigation is missing or has extra primary tabs.
- Tester is unsure whether data is safe.

## B. Import A PGN

What tester does:
- Go to Mes parties.
- Open Import PGN.
- Paste a copied PGN.
- Import it.

Expected result:
- The game appears in Mes parties.
- Invalid text produces a calm recovery state, not a crash.

Report if it fails:
- Import blocks without explanation.
- Raw technical text appears.
- Tester does not know what to do next.

## C. Launch Standard Analysis

What tester does:
- Start the recommended/standard analysis for the imported game.

Expected result:
- Progress is visible.
- The analysis ends in Review ready, Review partial, or a recoverable state.
- The timer does not reset each move or spin forever.

Report if it fails:
- Spinner never ends.
- The last move appears stuck.
- No retry/recovery action appears.

## D. Launch Or Inspect Deep Analysis

What tester does:
- If deep analysis is available and time allows, launch or inspect it.

Expected result:
- Deep analysis also reaches a terminal or recoverable state.
- Standard analysis behavior does not regress.

Report if it fails:
- Deep analysis blocks the app.
- Standard/deep states conflict or are unclear.

## E. Review Summary

What tester does:
- Open the Review summary.
- Read the main score and moments.

Expected result:
- The tester understands that Review selected useful moments.
- Raw formulas and internal metrics are hidden from normal UI.

Report if it fails:
- Tester feels the score is presented as scientific truth.
- Internal debug values are visible in normal flow.

## F. Explore One Position Locally

What tester does:
- Choose a Review position.
- Click Explorer la position or the equivalent local exploration control.
- Play one legal move on the board.
- Try undo/reset/exit.

Expected result:
- The board changes for legal local exploration.
- Undo/reset/exit work.
- Exploration does not save a Practice attempt.

Report if it fails:
- Board cannot be used.
- Illegal move has unclear feedback.
- Exploration creates training/practice data.

## G. Start Practice From Review

What tester does:
- Start Practice from the Review.
- Look at the position and available actions.

Expected result:
- Board is usable.
- Main actions are reachable.
- Live analysis/best move is not shown before attempt or reveal.

Report if it fails:
- Tester sees the answer before trying.
- Practice does not start.
- Board input is not usable.

## H. Play One Wrong Move If Comfortable

What tester does:
- Try a legal move they suspect may be wrong.

Expected result:
- Feedback is calm and useful.
- The app does not humiliate or blame the tester.
- Attempt is saved only after the move is played.

Report if it fails:
- Feedback feels unfair or contradictory.
- The app marks a good/accepted move as a problem.

## I. Try The Best Move In A Controlled Scenario

What tester does:
- After feedback or in a controlled facilitator scenario, play the known best
  move.

Expected result:
- Feedback is success/accepted.
- The UI never says the best move was missed when the tester just played it.

Report if it fails:
- "Ton coup - Probleme" appears for the exact best/accepted move.
- "Le meilleur coup etait X" appears as a reproach when X was played.

## J. Check Daily Plan

What tester does:
- Go to Entrainement.
- Open Plan du jour.
- Start one Daily Plan Practice item if available.

Expected result:
- Exactly three training entries exist: Plan du jour, Mes positions ratees,
  Revisions.
- Daily Plan Practice opens and saves attempts.

Report if it fails:
- Extra training mode appears.
- Plan cannot open.
- Attempt/due state is missing.

## K. Export Data

What tester does:
- Open Profil / Parametres.
- Export data.

Expected result:
- Export is available and understandable.
- Export does not delete data.

Report if it fails:
- Export crashes.
- Export leaks unrelated project/system files.

## L. Optional Delete Flow On Temp Data Only

What tester does:
- Only with temp/copied data, test delete.
- Confirm exact required text if instructed by the facilitator.

Expected result:
- Delete requires explicit confirmation.
- A first accidental click does not delete data.
- Delete clears local user data only.

Report if it fails:
- Delete happens without confirmation.
- Project files or non-user data are affected.

## M. Feedback Interview

Ask:
- What was the first useful moment?
- What was confusing?
- Did feedback feel fair?
- Did you know what to do next?
- Would you import more games tomorrow?
