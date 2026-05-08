# External References

These repositories are technical references only. They are not product source of
truth. NeuroChess remains governed by Plan1 and Plan2.

Do not clone these repositories into the working tree unless a dedicated mission
asks for it. Do not copy GPL code into NeuroChess without an explicit license
decision.

## Recommended References

### 1. chess.js

- Repository: `https://github.com/jhlywa/chess.js`
- Usage: chess rules, FEN, validation, and PGN handling on the JS/TS side.
- Possible command:

```powershell
git clone --depth=1 https://github.com/jhlywa/chess.js external_references/chess.js
```

### 2. react-chessboard

- Repository: `https://github.com/Clariity/react-chessboard`
- Usage: clean and responsive React board reference.
- Possible command:

```powershell
git clone --depth=1 https://github.com/Clariity/react-chessboard external_references/react-chessboard
```

### 3. chessground

- Repository: `https://github.com/lichess-org/chessground`
- Usage: strong board UX inspiration.
- License note: GPL-3.0. Do not copy directly without a license decision.
- Possible command:

```powershell
git clone --depth=1 https://github.com/lichess-org/chessground external_references/chessground
```

### 4. stockfish.js

- Repository: `https://github.com/nmrugg/stockfish.js`
- Usage: Stockfish web/WASM integration reference.
- Possible command:

```powershell
git clone --depth=1 https://github.com/nmrugg/stockfish.js external_references/stockfish.js
```

### 5. python-chess

- Repository: `https://github.com/niklasf/python-chess`
- Usage: backend PGN/FEN/UCI reference.
- License note: GPL-3.0. Do not copy directly without a license decision.
- Possible command:

```powershell
git clone --depth=1 https://github.com/niklasf/python-chess external_references/python-chess
```

## Rules

- Do not integrate these repos into product code without a dedicated mission.
- Do not copy GPL code into NeuroChess without an explicit legal/product
  decision.
- Use them as references for comparison, API behavior, and UX inspiration only.
- Plan1/Plan2 override any direction implied by these repositories.
