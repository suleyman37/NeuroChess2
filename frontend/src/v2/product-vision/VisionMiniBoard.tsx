import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Chessboard } from "react-chessboard";
import type { Arrow } from "react-chessboard/dist/chessboard/types";

export type VisionMiniBoardArrow = {
  from: string;
  to: string;
};

export type VisionMiniBoardProps = {
  fen: string;
  highlightSquare?: string;
  arrow?: VisionMiniBoardArrow;
  size?: "xs" | "sm" | "md" | "lg" | "hero";
  mood?: "calm" | "active" | "explore";
  showCoords?: boolean;
  label?: string;
  testId?: string;
};

const defaultWidths: Record<NonNullable<VisionMiniBoardProps["size"]>, number> = {
  xs: 88,
  sm: 112,
  md: 148,
  lg: 220,
  hero: 266,
};

function countPieces(fen: string): number {
  const placement = fen.split(" ")[0] ?? "";
  return [...placement].filter((token) => /[pnbrqk]/i.test(token)).length;
}

function buildSquareStyles(highlightSquare?: string): Record<string, CSSProperties> {
  if (!highlightSquare) {
    return {};
  }
  return {
    [highlightSquare]: {
      boxShadow: "inset 0 0 0 3px rgba(94, 234, 212, 0.78)",
      background: "linear-gradient(135deg, rgba(20, 184, 166, 0.34), rgba(14, 165, 233, 0.18))",
    },
  };
}

export function VisionMiniBoard({
  fen,
  highlightSquare,
  arrow,
  size = "md",
  mood = "calm",
  showCoords = false,
  label,
  testId = "v2-vision-mini-board",
}: VisionMiniBoardProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [boardWidth, setBoardWidth] = useState(defaultWidths[size]);
  const pieceCount = countPieces(fen);
  const arrows = arrow ? ([[arrow.from, arrow.to, "rgba(94, 234, 212, 0.82)"]] as Arrow[]) : undefined;

  useEffect(() => {
    const element = boardRef.current;
    if (!element) {
      return;
    }

    const updateBoardWidth = () => {
      const measured = Math.round(element.getBoundingClientRect().width);
      setBoardWidth(measured > 0 ? Math.max(72, Math.min(320, measured)) : defaultWidths[size]);
    };

    updateBoardWidth();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateBoardWidth) : null;
    observer?.observe(element);
    window.addEventListener("resize", updateBoardWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateBoardWidth);
    };
  }, [size]);

  return (
    <figure
      className={`v2-vision-mini-board-card is-${size} is-${mood}`}
      data-board-cases="64"
      data-board-kind="vision-mini-board"
      data-board-mood={mood}
      data-board-size={size}
      data-piece-count={pieceCount}
      data-tone={mood}
      data-testid={testId}
    >
      <div className="v2-vision-mini-board-frame" ref={boardRef}>
        <Chessboard
          position={fen}
          arePiecesDraggable={false}
          boardWidth={boardWidth}
          animationDuration={160}
          customArrows={arrows}
          customSquareStyles={buildSquareStyles(highlightSquare)}
          customDarkSquareStyle={{ backgroundColor: "#0f1730" }}
          customLightSquareStyle={{ backgroundColor: "#222b48" }}
          customBoardStyle={{
            borderRadius: 0,
            boxShadow: "none",
          }}
          showBoardNotation={showCoords}
        />
      </div>
      {label ? <figcaption>{label}</figcaption> : null}
    </figure>
  );
}
