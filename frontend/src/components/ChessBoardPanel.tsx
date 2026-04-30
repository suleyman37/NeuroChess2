import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { Arrow } from "react-chessboard/dist/chessboard/types";

export type BoardArrow = [string, string, string?];

type ChessBoardPanelProps = {
  fen: string | null;
  disabled: boolean;
  ariaLabel: string;
  squareStyles?: Record<string, CSSProperties>;
  customArrows?: BoardArrow[];
  animationDuration?: number;
  onMove: (uci: string, optimisticFen: string | null) => Promise<void>;
};

export function ChessBoardPanel({
  fen,
  disabled,
  ariaLabel,
  squareStyles,
  customArrows,
  animationDuration = 300,
  onMove,
}: ChessBoardPanelProps) {
  const [boardWidth, setBoardWidth] = useState(() => getBoardWidth());

  useEffect(() => {
    function handleResize() {
      setBoardWidth(getBoardWidth());
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handlePieceDrop(
    sourceSquare: string,
    targetSquare: string,
    piece: string,
  ): boolean {
    if (!fen || disabled) {
      return false;
    }

    const promotion = isPromotionAttempt(piece, targetSquare) ? "q" : "";
    // TODO: V4+: add promotion selection dialog.
    const uci = `${sourceSquare}${targetSquare}${promotion}`;
    let optimisticFen: string | null = null;

    try {
      const visualBoard = new Chess(fen);
      const visualMove = visualBoard.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: promotion || undefined,
      });
      optimisticFen = visualMove ? visualBoard.fen() : null;
    } catch {
      optimisticFen = null;
    }

    void onMove(uci, optimisticFen);
    return true;
  }

  return (
    <div className="board-panel" role="img" aria-label={ariaLabel}>
      <Chessboard
        position={fen ?? "start"}
        onPieceDrop={handlePieceDrop}
        arePiecesDraggable={Boolean(fen) && !disabled}
        animationDuration={animationDuration}
        boardWidth={boardWidth}
        customSquareStyles={squareStyles}
        customArrows={customArrows as Arrow[] | undefined}
        customBoardStyle={{
          borderRadius: "6px",
          boxShadow: "0 18px 42px rgba(15, 23, 42, 0.18)",
        }}
      />
    </div>
  );
}

function isPromotionAttempt(piece: string, targetSquare: string): boolean {
  const targetRank = targetSquare[1];
  return piece[1] === "P" && (targetRank === "1" || targetRank === "8");
}

function getBoardWidth(): number {
  if (typeof window === "undefined") {
    return 480;
  }

  return Math.min(480, Math.max(280, window.innerWidth - 140));
}
