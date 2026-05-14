const PIECE_SYMBOLS: Record<string, string> = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

function fenPieces(fen?: string): string[] | null {
  const board = String(fen ?? "").trim().split(/\s+/)[0];
  const rows = board.split("/");
  if (rows.length !== 8) {
    return null;
  }

  const squares: string[] = [];
  for (const row of rows) {
    for (const char of row) {
      const emptyCount = Number(char);
      if (Number.isInteger(emptyCount) && emptyCount > 0) {
        squares.push(...Array.from({ length: emptyCount }, () => ""));
      } else if (PIECE_SYMBOLS[char]) {
        squares.push(char);
      } else {
        return null;
      }
    }
  }

  return squares.length === 64 ? squares : null;
}

export function RexMiniBoard({ fen, label }: { fen?: string; label: string }) {
  const squares = fenPieces(fen);
  if (!squares) {
    return (
      <div
        className="rex-mini-board rex-mini-board--empty"
        data-testid="rex-mini-board"
        aria-label={`${label} : position non disponible`}
      >
        position non disponible
      </div>
    );
  }

  return (
    <div className="rex-mini-board" data-testid="rex-mini-board" aria-label={label}>
      {squares.map((piece, index) => (
        <span
          aria-hidden="true"
          data-piece-color={piece && piece === piece.toUpperCase() ? "white" : piece ? "black" : "empty"}
          data-square-tone={(Math.floor(index / 8) + index) % 2 === 0 ? "light" : "dark"}
          key={`${piece || "empty"}-${index}`}
        >
          {piece ? PIECE_SYMBOLS[piece] : ""}
        </span>
      ))}
    </div>
  );
}
