import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { Arrow } from "react-chessboard/dist/chessboard/types";
import {
  BoardMoveOutcomeOverlay,
  type BoardMoveOutcomeOverlayState,
} from "./review/BoardMoveOutcomeOverlay";

export type BoardArrow = [string, string, string?];

type ChessBoardPanelProps = {
  fen: string | null;
  disabled: boolean;
  ariaLabel: string;
  orientation?: "white" | "black";
  testId?: string;
  squareStyles?: Record<string, CSSProperties>;
  customArrows?: BoardArrow[];
  animationDuration?: number;
  moveOutcome?: BoardMoveOutcomeOverlayState | null;
  onMove: (uci: string, optimisticFen: string | null) => Promise<void>;
};

export function ChessBoardPanel({
  fen,
  disabled,
  ariaLabel,
  orientation = "white",
  testId,
  squareStyles,
  customArrows,
  animationDuration = 300,
  moveOutcome,
  onMove,
}: ChessBoardPanelProps) {
  const boardPanelRef = useRef<HTMLDivElement | null>(null);
  const [boardWidth, setBoardWidth] = useState(() => getBoardWidth());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  useEffect(() => {
    const element = boardPanelRef.current;
    if (!element) {
      return;
    }
    const boardElement = element;

    function updateBoardWidth() {
      const measuredWidth = boardElement.getBoundingClientRect().width;
      const nextWidth =
        measuredWidth > 0
          ? Math.min(520, Math.max(260, Math.round(measuredWidth)))
          : getBoardWidth();
      setBoardWidth(nextWidth);
    }

    updateBoardWidth();
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateBoardWidth)
        : null;
    resizeObserver?.observe(boardElement);
    window.addEventListener("resize", updateBoardWidth);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateBoardWidth);
    };
  }, []);

  useEffect(() => {
    setSelectedSquare(null);
  }, [fen, disabled, orientation]);

  function handlePieceDrop(
    sourceSquare: string,
    targetSquare: string,
    piece: string,
  ): boolean {
    if (!fen || disabled) {
      return false;
    }

    setSelectedSquare(null);
    return submitMove(sourceSquare, targetSquare, piece);
  }

  function handleSquareClick(square: string) {
    if (!fen || disabled) {
      return;
    }

    try {
      const board = new Chess(fen);
      const piece = board.get(square as Square);
      const isOwnTurnPiece = piece?.color === board.turn();

      if (!selectedSquare) {
        if (isOwnTurnPiece) {
          setSelectedSquare(square);
        }
        return;
      }

      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      if (isOwnTurnPiece) {
        setSelectedSquare(square);
        return;
      }

      const selectedPiece = board.get(selectedSquare as Square);
      setSelectedSquare(null);
      submitMove(selectedSquare, square, selectedPiece ? `${selectedPiece.color}${selectedPiece.type.toUpperCase()}` : "");
    } catch {
      setSelectedSquare(null);
    }
  }

  function submitMove(
    sourceSquare: string,
    targetSquare: string,
    piece: string,
  ): boolean {
    const promotion = isPromotionAttempt(piece, targetSquare) ? "q" : "";
    // TODO: V4+: add promotion selection dialog.
    const uci = `${sourceSquare}${targetSquare}${promotion}`;
    let optimisticFen: string | null = null;

    try {
      const visualBoard = new Chess(fen ?? undefined);
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
    return Boolean(optimisticFen);
  }

  const clickSquareStyles = selectedSquare && !disabled && fen
    ? buildClickSquareStyles(fen, selectedSquare)
    : {};
  const mergedSquareStyles = {
    ...(squareStyles ?? {}),
    ...clickSquareStyles,
  };

  return (
    <div
      ref={boardPanelRef}
      className="board-panel"
      role="img"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      tabIndex={fen && !disabled ? 0 : -1}
      data-testid={testId}
      data-board-orientation={orientation}
      data-board-fen={fen ?? ""}
    >
      <Chessboard
        position={fen ?? "start"}
        onPieceDrop={handlePieceDrop}
        onSquareClick={handleSquareClick}
        arePiecesDraggable={Boolean(fen) && !disabled}
        boardOrientation={orientation}
        animationDuration={animationDuration}
        boardWidth={boardWidth}
        customSquareStyles={mergedSquareStyles}
        customArrows={customArrows as Arrow[] | undefined}
        customDarkSquareStyle={{
          backgroundColor: "#0f1730",
        }}
        customLightSquareStyle={{
          backgroundColor: "#222b48",
        }}
        customDropSquareStyle={{
          boxShadow: "inset 0 0 0 3px rgba(0, 229, 255, 0.72)",
        }}
        showBoardNotation
        customBoardStyle={{
          borderRadius: 0,
          boxShadow:
            "0 0 0 1px rgba(34, 211, 238, 0.16), 0 24px 70px rgba(0, 0, 0, 0.55)",
        }}
      />
      {moveOutcome && (
        <BoardMoveOutcomeOverlay
          {...moveOutcome}
          orientation={orientation}
        />
      )}
    </div>
  );
}

function isPromotionAttempt(piece: string, targetSquare: string): boolean {
  const targetRank = targetSquare[1];
  return piece[1] === "P" && (targetRank === "1" || targetRank === "8");
}

function buildClickSquareStyles(
  fen: string,
  selectedSquare: string,
): Record<string, CSSProperties> {
  const styles: Record<string, CSSProperties> = {
    [selectedSquare]: {
      boxShadow: "inset 0 0 0 3px rgba(48, 242, 164, 0.88)",
    },
  };

  try {
    const board = new Chess(fen);
    for (const move of board.moves({ square: selectedSquare as Square, verbose: true })) {
      styles[move.to] = {
        background:
          "radial-gradient(circle, rgba(48, 242, 164, 0.38) 0 24%, transparent 25%)",
      };
    }
  } catch {
    return styles;
  }

  return styles;
}

function getBoardWidth(): number {
  if (typeof window === "undefined") {
    return 520;
  }

  const horizontalMargin = window.innerWidth < 640 ? 32 : 120;
  return Math.min(520, Math.max(260, window.innerWidth - horizontalMargin));
}
