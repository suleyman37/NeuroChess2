import { fr } from "../../i18n";
import type { ReviewPvLineMode, ReviewPvLineViewState } from "./reviewTypes";

function ReviewPracticePvStepper({
  state,
  onPrevious,
  onNext,
  onRestart,
  onToggleAutoplay,
  onSelectLine,
  onClose,
}: {
  state: ReviewPvLineViewState;
  onPrevious: () => void;
  onNext: () => void;
  onRestart: () => void;
  onToggleAutoplay: () => void;
  onSelectLine: (lineMode: ReviewPvLineMode) => void;
  onClose: () => void;
}) {
  const currentMove =
    state.currentIndex >= 0 ? state.moves[state.currentIndex] : null;
  const total = state.moves.length;
  const hasPrevious = state.currentIndex >= 0;
  const hasNext = state.currentIndex < total - 1;
  return (
    <div
      className="review-practice-pv-stepper"
      data-testid="review-line-player"
      data-active-line={state.lineMode}
      data-current-fen={state.currentFen}
      data-current-index={state.currentIndex}
    >
      <div className="review-block-title">
        <span data-testid="review-line-player-context">
          {state.lineMode === "played"
            ? fr.lines.playbackGameContext
            : fr.lines.playbackSolutionContext}
        </span>
        <strong data-testid="review-line-player-step-label">
          {state.currentIndex < 0
            ? fr.lines.stepStart(total)
            : fr.lines.stepLabel(state.currentIndex + 1, total)}
        </strong>
      </div>
      <p data-testid="review-line-player-current-move">
        {currentMove
          ? currentMove.san ?? currentMove.uci
          : fr.lines.startPosition}
      </p>
      {state.message && <div className="warning">{state.message}</div>}
      <div
        className="review-pv-line-mode"
        aria-label={fr.lines.choosePvLineAria}
        data-testid="review-line-player-active-line"
      >
        <button
          type="button"
          className={state.lineMode === "played" ? "active" : ""}
          onClick={() => onSelectLine("played")}
          disabled={!state.playedLineAvailable}
          data-testid="review-line-player-played-line"
        >
          {fr.lines.playedLineChoice}
        </button>
        <button
          type="button"
          className={state.lineMode === "solution" ? "active" : ""}
          onClick={() => onSelectLine("solution")}
          disabled={!state.solutionLineAvailable}
          data-testid="review-line-player-solution-line"
        >
          {fr.lines.solutionLineChoice}
        </button>
      </div>
      <div className="review-action-row">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!hasPrevious}
          data-testid="review-line-player-prev"
        >
          {fr.lines.previous}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          data-testid="review-line-player-next"
        >
          {fr.lines.next}
        </button>
        <button
          type="button"
          onClick={onRestart}
          data-testid="review-line-player-restart"
        >
          {fr.lines.restart}
        </button>
        <button type="button" onClick={onToggleAutoplay} disabled={!hasNext}>
          {state.autoplay ? fr.lines.pause : fr.lines.autoplay}
        </button>
        <button type="button" onClick={onClose}>
          {fr.lines.close}
        </button>
      </div>
    </div>
  );
}


export const ReviewPvStepper = ReviewPracticePvStepper;
