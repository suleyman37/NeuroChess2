import type { ReviewMoment, ReviewMoveAnnotation, ReviewPracticeItem, ReviewPracticeSummary, ReviewPvLineMove } from "../../api/client";
import type { ReviewPvLineMode } from "./reviewTypes";

type ReviewStepStatusGuidedPhase =
  | "context"
  | "decision"
  | "played_move"
  | "impact"
  | "best_move"
  | "pv_line"
  | "summary";

type ReviewStepStatusPracticeState = {
  active: boolean;
  itemState:
    | "awaiting_attempt"
    | "hint_shown"
    | "attempted"
    | "solution_revealed"
    | "pv_line"
    | "completed";
  items: ReviewPracticeItem[];
  currentIndex: number;
  summary: ReviewPracticeSummary | null;
  saving: boolean;
};

type ReviewStepStatusPvLineState = {
  active: boolean;
  moves: ReviewPvLineMove[];
  currentIndex: number;
  lineMode: ReviewPvLineMode;
};

type ReviewStepStatusCopy = {
  title: string;
  message: string;
  detail?: string;
  primaryLabel?: string;
};

type ReviewStepStatusProps = {
  focusKey: string;
  annotation: ReviewMoveAnnotation | null;
  moment: ReviewMoment | null;
  guidedPhase: ReviewStepStatusGuidedPhase | null;
  pvLineState: ReviewStepStatusPvLineState | null;
  practiceState: ReviewStepStatusPracticeState | null;
  openingFocusMessage: string | null;
  canPrevious: boolean;
  canNext: boolean;
  canReplay: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onReplay: () => void;
};

export function ReviewStepStatus({
  focusKey,
  annotation,
  moment,
  guidedPhase,
  pvLineState,
  practiceState,
  openingFocusMessage,
  canPrevious,
  canNext,
  canReplay,
  onPrevious,
  onNext,
  onReplay,
}: ReviewStepStatusProps) {
  const status = buildReviewStepStatusView(focusKey, annotation, moment, guidedPhase, pvLineState, practiceState, openingFocusMessage);
  if (!status) return null;
  return (
    <div className="review-step-status-panel" aria-label="Statut d'étape Review">
      <div>
        <strong>{status.title}</strong>
        <span>{status.message}</span>
      </div>
      {status.detail && <span className="review-step-status-detail">{status.detail}</span>}
      {(canPrevious || canNext || canReplay) && (
        <div className="review-step-status-actions">
          {canPrevious && (
            <button type="button" onClick={onPrevious}>
              Précédent
            </button>
          )}
          {(canNext || canReplay) && (
            <button
              className="primary"
              type="button"
              onClick={canNext ? onNext : onReplay}
            >
              {status.primaryLabel ?? (canNext ? "Continuer" : "Rejouer")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function buildReviewStepStatusView(
  focusKey: string,
  annotation: ReviewMoveAnnotation | null,
  moment: ReviewMoment | null,
  guidedPhase: ReviewStepStatusGuidedPhase | null,
  pvLineState: ReviewStepStatusPvLineState | null,
  practiceState: ReviewStepStatusPracticeState | null,
  openingFocusMessage: string | null,
): ReviewStepStatusCopy | null {
  if (practiceState?.active) {
    if (practiceState.itemState === "attempted") return { title: "Correction", message: "Ton essai est enregistré.", primaryLabel: "Continuer" };
    if (practiceState.itemState === "solution_revealed") return { title: "Correction", message: "Ton coup et la correction sont affichés.", primaryLabel: "Continuer" };
    if (practiceState.itemState === "completed") return { title: "Entraînement", message: "À retenir : cherche les coups forcing.", primaryLabel: "Continuer" };
    return { title: "Défi", message: "Position critique - trouve le meilleur coup.", primaryLabel: "Continuer" };
  }
  if (focusKey === "summary" && !pvLineState?.active) {
    return {
      title: "Résumé Review",
      message: "NeuroScore, priorités et plan sont dans le panneau coach.",
      primaryLabel: "Continuer",
    };
  }
  if (focusKey === "practice" && !pvLineState?.active) return { title: "Entraînement", message: "Démarre une session depuis le panneau de droite.", primaryLabel: "Continuer" };
  if (focusKey === "lab" && !pvLineState?.active) return { title: "Explorer", message: openingFocusMessage ?? "Mode exploration." };
  if (pvLineState?.active) return { title: "Correction", message: "Compare les deux futurs.", detail: pvLineState.currentIndex < 0 ? `Départ / ${pvLineState.moves.length}` : `Coup ${pvLineState.currentIndex + 1} / ${pvLineState.moves.length}`, primaryLabel: "Continuer" };
  if (annotation && guidedPhase) {
    if (guidedPhase === "played_move" || guidedPhase === "impact") return { title: "Correction", message: "Ton coup et la correction sont affichés.", primaryLabel: "Continuer" };
    if (guidedPhase === "best_move") return { title: "Correction", message: "La correction montre l'idée à retenir.", primaryLabel: "Continuer" };
    if (guidedPhase === "pv_line") return { title: "Correction", message: "Compare les deux futurs.", primaryLabel: "Continuer" };
    if (guidedPhase === "summary") return { title: "Entraînement", message: "À retenir : cherche les coups forcing.", primaryLabel: "Continuer" };
    return { title: "Défi", message: "Position critique - trouve le meilleur coup.", primaryLabel: "Continuer" };
  }
  if (annotation) return { title: "Défi", message: "Position critique - trouve le meilleur coup.", primaryLabel: "Continuer" };
  if (moment) return { title: "Défi", message: "Position critique sélectionnée.", primaryLabel: "Continuer" };
  return null;
}
