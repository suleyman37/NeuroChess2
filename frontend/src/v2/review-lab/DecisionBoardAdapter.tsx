import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ChessBoardPanel } from "../../components/ChessBoardPanel";
import type { BoardArrow } from "../../components/ChessBoardPanel";
import type { DecisionLabMoment } from "./decisionLabMockData";

type DecisionBoardAdapterProps = {
  moment: DecisionLabMoment;
  interactive: boolean;
};

export function DecisionBoardAdapter({ moment, interactive }: DecisionBoardAdapterProps) {
  const [visualFen, setVisualFen] = useState(moment.boardFen);
  const squareStyles = useMemo(() => buildSquareStyles(moment.highlightSquares), [moment.highlightSquares]);
  const arrows = useMemo<BoardArrow[]>(() => [moment.arrow], [moment.arrow]);

  useEffect(() => {
    setVisualFen(moment.boardFen);
  }, [moment.boardFen]);

  return (
    <div className="decision-lab-board-shell" data-testid="decision-lab-board-shell">
      <ChessBoardPanel
        fen={visualFen}
        disabled={!interactive}
        ariaLabel="Échiquier statique Decision Lab V2"
        orientation={moment.sideToMove === "Noirs" ? "black" : "white"}
        testId="decision-lab-board"
        squareStyles={squareStyles}
        customArrows={arrows}
        animationDuration={140}
        moveOutcome={null}
        onMove={async (_uci, optimisticFen) => {
          if (optimisticFen) {
            setVisualFen(optimisticFen);
          }
        }}
      />
    </div>
  );
}

function buildSquareStyles(squares: string[]): Record<string, CSSProperties> {
  return squares.reduce<Record<string, CSSProperties>>((styles, square) => {
    styles[square] = {
      boxShadow:
        "inset 0 0 0 3px rgba(255, 217, 102, 0.78), inset 0 0 22px rgba(255, 217, 102, 0.2)",
    };
    return styles;
  }, {});
}
