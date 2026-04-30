import type { GameMoveHistory, GameMoveHistoryItem } from "../api/client";

type MoveHistoryProps = {
  history: GameMoveHistory | null;
  loading: boolean;
  error: string | null;
  displayedPositionPly: number;
  selectedReviewMovePly: number | null;
  onSelectMove: (move: GameMoveHistoryItem) => void;
  onRetry: () => void;
};

export function MoveHistory({
  history,
  loading,
  error,
  displayedPositionPly,
  selectedReviewMovePly,
  onSelectMove,
  onRetry,
}: MoveHistoryProps) {
  if (loading) {
    return <div className="muted">Chargement de l'historique...</div>;
  }

  if (error) {
    return (
      <div className="history-error">
        <span>Impossible de charger l'historique.</span>
        <button onClick={onRetry}>Réessayer</button>
      </div>
    );
  }

  if (!history || history.moves.length === 0) {
    return <div className="muted">Aucun coup</div>;
  }

  const rows: Array<{
    moveNumber: number;
    white?: GameMoveHistoryItem;
    black?: GameMoveHistoryItem;
  }> = [];

  for (const move of history.moves) {
    const rowIndex = Math.floor((move.ply - 1) / 2);
    if (!rows[rowIndex]) {
      rows[rowIndex] = { moveNumber: rowIndex + 1 };
    }

    if (move.ply % 2 === 1) {
      rows[rowIndex].white = move;
    } else {
      rows[rowIndex].black = move;
    }
  }

  return (
    <div className="history-list">
      {rows.map((row) => (
        <div className="history-row" key={row.moveNumber}>
          <span className="move-number">{row.moveNumber}.</span>
          <MoveButton
            move={row.white}
            displayedPositionPly={displayedPositionPly}
            selectedReviewMovePly={selectedReviewMovePly}
            onSelectMove={onSelectMove}
          />
          <MoveButton
            move={row.black}
            displayedPositionPly={displayedPositionPly}
            selectedReviewMovePly={selectedReviewMovePly}
            onSelectMove={onSelectMove}
          />
        </div>
      ))}
    </div>
  );
}

function MoveButton({
  move,
  displayedPositionPly,
  selectedReviewMovePly,
  onSelectMove,
}: {
  move?: GameMoveHistoryItem;
  displayedPositionPly: number;
  selectedReviewMovePly: number | null;
  onSelectMove: (move: GameMoveHistoryItem) => void;
}) {
  if (!move) {
    return <span />;
  }

  const classes = [
    "move-button",
    displayedPositionPly === move.ply ? "active" : "",
    selectedReviewMovePly === move.ply ? "review-linked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} onClick={() => onSelectMove(move)}>
      {move.played_san}
    </button>
  );
}
