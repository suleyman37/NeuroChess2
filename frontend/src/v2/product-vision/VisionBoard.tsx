import type { CSSProperties } from "react";
import { ChessBoardPanel, type BoardArrow } from "../../components/ChessBoardPanel";
import type { VisionMoment } from "./visionMockData";
import {
  getBoardExperienceTone,
  getBoardStateCopy,
  type BoardExperienceState,
  type BoardExperienceTone,
} from "./visionState";

export type VisionBoardMood = BoardExperienceTone;

type VisionBoardProps = {
  moment: VisionMoment;
  interactive?: boolean;
  mood?: VisionBoardMood;
  experienceState?: BoardExperienceState;
  showGuides?: boolean;
  testId?: string;
};

function getDefaultExperienceState(mood: VisionBoardMood): BoardExperienceState {
  if (mood === "learn") return "learn";
  if (mood === "active") return "effort";
  if (mood === "success") return "feedback-success";
  if (mood === "miss") return "feedback-miss";
  if (mood === "explore") return "explore";
  if (mood === "memory") return "memory";
  return "observe";
}

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
  experienceState,
  showGuides = true,
  testId = "v2-vision-board",
}: VisionBoardProps) {
  const arrows: BoardArrow[] = showGuides ? [moment.arrow] : [];
  const boardState = experienceState ?? getDefaultExperienceState(mood);
  const boardTone = getBoardExperienceTone(boardState);
  const stateCopy = getBoardStateCopy(boardState);

  return (
    <div
      className={`v2-vision-board-shell is-${boardTone} ${showGuides ? "has-guides" : "has-hidden-guides"}`}
      data-board-cases="64"
      data-board-kind="vision-main-board"
      data-board-mood={boardTone}
      data-board-state={boardState}
      data-board-tone={boardTone}
      data-board-state-label={stateCopy.label}
      data-board-state-copy={stateCopy.microcopy}
      data-piece-count={countPieces(moment.fen)}
      data-guides-visible={showGuides ? "true" : "false"}
      data-solution-visible={showGuides ? "true" : "false"}
      data-tone={boardTone}
      data-v2-stage-board="true"
      data-testid={`${testId}-shell`}
    >
      <div className="v2-board-state-aura" aria-hidden="true" />
      <div className="v2-board-state-breath" aria-hidden="true" />
      <div className="v2-board-effort-silence" aria-hidden="true" />
      <div className="v2-board-feedback-reveal" aria-hidden="true" />
      <div className="v2-board-explore-branch-layer" aria-hidden="true" />
      <div className="v2-board-memory-preview-layer" aria-hidden="true" />
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
