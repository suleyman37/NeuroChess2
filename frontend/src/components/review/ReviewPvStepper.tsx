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
    <div className="review-practice-pv-stepper">
      <div className="review-block-title">
        <span>
          {state.lineMode === "played"
            ? "Ligne après le coup joué"
            : "Ligne de la solution"}
        </span>
        <strong>
          {state.currentIndex < 0
            ? `Départ / ${total}`
            : `Coup ${state.currentIndex + 1} / ${total}`}
        </strong>
      </div>
      <p>
        {currentMove
          ? currentMove.san ?? currentMove.uci
          : "Position de départ de la ligne."}
      </p>
      {state.message && <div className="warning">{state.message}</div>}
      <div className="review-pv-line-mode" aria-label="Choix de ligne PV">
        <button
          type="button"
          className={state.lineMode === "played" ? "active" : ""}
          onClick={() => onSelectLine("played")}
          disabled={!state.playedLineAvailable}
        >
          Ligne du coup joué
        </button>
        <button
          type="button"
          className={state.lineMode === "solution" ? "active" : ""}
          onClick={() => onSelectLine("solution")}
          disabled={!state.solutionLineAvailable}
        >
          Ligne de la solution
        </button>
      </div>
      <div className="review-action-row">
        <button type="button" onClick={onPrevious} disabled={!hasPrevious}>
          ← Coup précédent
        </button>
        <button type="button" onClick={onNext} disabled={!hasNext}>
          Coup suivant →
        </button>
        <button type="button" onClick={onRestart}>
          Rejouer depuis le début
        </button>
        <button type="button" onClick={onToggleAutoplay} disabled={!hasNext}>
          {state.autoplay ? "Pause" : "Auto"}
        </button>
        <button type="button" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}


export const ReviewPvStepper = ReviewPracticePvStepper;
