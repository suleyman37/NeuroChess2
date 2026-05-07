import type { CSSProperties } from "react";
import {
  getMoveQualityGlyphDefinition,
  type MoveQualityGlyphId,
} from "./moveQualityGlyphs";

type BoardOrientation = "white" | "black";

export type BoardMoveOutcomeOverlayState = {
  visible: boolean;
  qualityId: MoveQualityGlyphId;
  result?: string | null;
  square?: string | null;
  moveUci?: string | null;
};

export type BoardMoveOutcomeOverlayProps = BoardMoveOutcomeOverlayState & {
  orientation: BoardOrientation;
  testId?: string;
};

export function BoardMoveOutcomeOverlay({
  visible,
  qualityId,
  result,
  square,
  moveUci,
  orientation,
  testId = "board-move-outcome-overlay",
}: BoardMoveOutcomeOverlayProps) {
  if (!visible) {
    return null;
  }

  const definition = getMoveQualityGlyphDefinition(qualityId);
  const squareCoordinates = squareToBoardCoordinates(square, orientation);
  const knownSquare = squareCoordinates !== null;
  const displayedSquare = knownSquare ? String(square) : "unknown";
  const style = knownSquare
    ? ({
        left: `${(squareCoordinates.column + 0.74) * 12.5}%`,
        top: `${(squareCoordinates.row + 0.28) * 12.5}%`,
      } as CSSProperties)
    : undefined;
  const ariaText = `${definition.label}. ${definition.shortDescription}`;

  return (
    <>
      <span
        className={[
          "board-move-outcome-overlay",
          `board-move-outcome-overlay--${definition.tone}`,
          knownSquare ? "board-move-outcome-overlay--square" : "board-move-outcome-overlay--fallback",
        ].join(" ")}
        style={style}
        data-testid={testId}
        data-quality-id={definition.id}
        data-result={result ?? ""}
        data-square={displayedSquare}
        data-move-uci={moveUci ?? ""}
        data-board-orientation={orientation}
        aria-hidden="true"
      >
        <span
          className="board-move-outcome-glyph"
          data-testid="board-move-outcome-glyph"
        >
          {definition.glyph}
        </span>
        <span
          className="board-move-outcome-label"
          data-testid="board-move-outcome-label"
        >
          {definition.label}
        </span>
      </span>
      <span className="board-move-outcome-live" aria-live="polite">
        {ariaText}
      </span>
    </>
  );
}

export function squareToBoardCoordinates(
  square: string | null | undefined,
  orientation: BoardOrientation,
): { column: number; row: number } | null {
  if (!square || !/^[a-h][1-8]$/.test(square)) {
    return null;
  }
  const fileIndex = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]);
  if (orientation === "black") {
    return {
      column: 7 - fileIndex,
      row: rank - 1,
    };
  }
  return {
    column: fileIndex,
    row: 8 - rank,
  };
}
