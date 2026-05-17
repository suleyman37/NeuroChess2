# Desktop-First NeuroChess Skill Policy

NeuroChess is PC / desktop-first, not mobile-first.

Internal design and frontend review skills must optimize for:

- desktop browser / PC experience;
- mouse and keyboard;
- chessboard-centered layouts;
- board plus visible panels;
- large readable decision context;
- high-information but controlled density;
- 1366px, 1440px, and 1920px desktop review;
- stable layout during analysis;
- visible primary action;
- fast scanability;
- no mobile-first bottom navigation as the primary UX;
- no phone-sized UI as the primary target;
- no touch-only assumptions;
- no hidden critical actions behind mobile-style menus.

Mobile responsiveness can exist as secondary resilience. It is not the primary
product goal.

## Skill Implications

- `frontend-visual-review` must require desktop screenshots and visual evidence.
- `neurochess-desktop-game-like-interface-design` must keep the board as the
  central stage.
- `neurochess-react-performance-review` must protect board interaction
  responsiveness.
- Any future UI skill must state how it preserves desktop decision clarity.

## Forbidden Design Prompts

Do not accept vague UI prompts such as:

- "make it beautiful";
- "polish everything";
- "modernize the app";
- "make it mobile-friendly";
- "add cool effects".

Use concrete desktop goals tied to player clarity, CTA truthfulness, and the
Potential Unlock Loop.
