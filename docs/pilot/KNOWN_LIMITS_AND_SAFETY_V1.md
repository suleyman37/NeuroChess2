# Known Limits And Safety V1

## Product Limits

- Local-first only.
- No cloud sync.
- No Lichess/Chess.com sync yet.
- No LLM coach.
- No Candidate Trainer.
- No guaranteed Elo improvement.
- No public release.
- No real neuro measurement.
- No native mobile app.
- Stockfish local configuration may vary.
- Large PGNs may expose performance issues.

## Safety Rules For The Pilot

- Use copied/non-sensitive PGNs.
- Use backup or copied DB for testing.
- Run destructive delete only on test data.
- Do not test delete on valuable real data unless a backup exists.
- Preserve screenshots/logs for bugs.
- Do not paste secrets, tokens, cookies, or `.env` contents into reports.

## Allowed Claims

- NeuroChess helps review chess decisions.
- NeuroChess highlights useful moments from games.
- NeuroChess turns selected moments into Practice.
- NeuroChess can schedule local revision signals.
- NeuroChess V1 is local-first test software.

## Forbidden Claims

- NeuroChess measures the brain.
- NeuroChess guarantees Elo improvement.
- NeuroChess predicts future Elo.
- NeuroChess is a medical/cognitive diagnostic tool.
- NeuroChess replaces a coach.
- NeuroChess is ready for public release.

## Brand Note

"Neuro" is a brand/metaphor for decision learning. It is not biological
measurement.

## Export/Delete Note

Export/delete are user-data functions. They are not project-file functions.
They must not delete source code, Git files, Stockfish binaries, system files,
or non-NeuroChess data.
