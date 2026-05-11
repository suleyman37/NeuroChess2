import type { CSSProperties } from "react";
import { ChessBoardPanel, type BoardArrow } from "../../components/ChessBoardPanel";
import type { VisionMoment } from "./visionMockData";

export type VisionBoardMood = "calm" | "learn" | "active" | "success" | "explore";

type VisionBoardProps = {
  moment: VisionMoment;
  interactive?: boolean;
  mood?: VisionBoardMood;
  showGuides?: boolean;
  testId?: string;
};

function countPieces(fen: string): number {
  const placement = fen.split(" ")[0] ?? "";
  return [...placement].filter((token) => /[pnbrqk]/i.test(token)).length;
}

function buildSquareStyles(moment: VisionMoment, showGuides: boolean): Record<string, CSSProperties> {
  if (!showGuides) {
    return {};
  }

  return moment.highlights.reduce<Record<string, CSSProperties>>((styles, square, index) => {
    styles[square] = {
      boxShadow:
        index === 0
          ? "inset 0 0 0 4px rgba(56, 189, 248, 0.82)"
          : "inset 0 0 0 3px rgba(245, 158, 11, 0.58)",
      background:
        index === 0
          ? "linear-gradient(135deg, rgba(14, 165, 233, 0.32), rgba(20, 184, 166, 0.24))"
          : "linear-gradient(135deg, rgba(245, 158, 11, 0.22), rgba(244, 114, 182, 0.14))",
    };
    return styles;
  }, {});
}

export function VisionBoard({
  moment,
  interactive = false,
  mood = "calm",
  showGuides = true,
  testId = "v2-vision-board",
}: VisionBoardProps) {
  const arrows: BoardArrow[] = showGuides ? [moment.arrow] : [];

  return (
    <div
      className={`v2-vision-board-shell is-${mood} ${showGuides ? "has-guides" : "has-hidden-guides"}`}
      data-board-cases="64"
      data-board-kind="vision-main-board"
      data-board-mood={mood}
      data-piece-count={countPieces(moment.fen)}
      data-guides-visible={showGuides ? "true" : "false"}
      data-solution-visible={showGuides ? "true" : "false"}
      data-tone={mood}
      data-v2-stage-board="true"
      data-testid={`${testId}-shell`}
    >
      <ChessBoardPanel
        fen={moment.fen}
        disabled={!interactive}
        ariaLabel={`Echiquier Decision Lab, coup ${moment.moveNumber} ${moment.san}`}
        testId={testId}
        squareStyles={buildSquareStyles(moment, showGuides)}
        customArrows={arrows}
        animationDuration={180}
        onMove={async () => undefined}
      />
    </div>
  );
}
