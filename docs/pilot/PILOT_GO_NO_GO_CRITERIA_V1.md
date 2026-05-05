# Pilot Go / No-Go Criteria V1

## GO For Next Tester

Continue to the next controlled tester if:

- no P0 occurred;
- the core loop completed: import -> analysis -> Review -> Practice;
- tester understood the next useful action;
- no trust contradiction appeared;
- no unsafe data behavior occurred;
- no live analysis spoiler appeared in Practice before attempt/reveal;
- Profile export/delete behaved safely when tested on temp/copied data.

## NO-GO / Pause Pilot

Pause the pilot if:

- analysis hangs without terminal or recoverable state;
- best/accepted move is marked wrong;
- live analysis spoils Practice;
- delete/export is unsafe;
- app crashes on core flow;
- tester cannot complete import -> analysis -> Practice;
- raw stack trace or fatal technical state appears in normal UI;
- data loss occurs.

## After Each Tester

1. Collect issues.
2. Classify each issue as P0/P1/P2/P3.
3. Preserve screenshots, videos, logs, PGN fixture, browser/OS, and DB type.
4. Create a focused Codex mission only for P0/P1.
5. Put P2/P3 issues into polish/backlog.
6. Separate usability feedback from feature requests.
7. Do not add V2/V3 features from pilot feedback without a new explicit
   mission.

## Pilot Completion

The pilot is successful if 2-3 controlled testers complete the core loop without
P0 and with no repeated P1 that blocks trust.
