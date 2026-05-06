import type { ReviewMoveAnnotation } from "../../api/client";
import { fr } from "../../i18n";
import { buildLineComparisonView } from "./reviewViewModel";
import type { ReviewPovContext, ReviewPvLineMode } from "./reviewTypes";

export function ReviewLineComparison({
  annotation,
  index,
  contrastCoach,
  explanation,
  povContext,
  onShowPvLineAnnotation,
}: {
  annotation: ReviewMoveAnnotation;
  index: number;
  contrastCoach: NonNullable<ReviewMoveAnnotation["contrast_coach_explanation"]>;
  explanation: ReviewMoveAnnotation["pedagogical_explanation"];
  povContext: ReviewPovContext;
  onShowPvLineAnnotation: (
    annotation: ReviewMoveAnnotation,
    index: number,
    lineMode?: ReviewPvLineMode,
  ) => void;
}) {
  const view = buildLineComparisonView(annotation, contrastCoach, explanation, povContext);
  return (
    <div className="review-line-comparison" aria-label="Comparaison des lignes">
      <div className="review-line-comparison-head">
        <span>Comparer les deux futurs</span>
        <strong>{view.mainDifference ?? "La solution limite mieux les réponses adverses."}</strong>
      </div>
      <div className="review-line-comparison-grid">
        <article className="review-line-card review-line-card-played">
          <span>{fr.feedback.lineHistoricalContext}</span>
          <strong>{fr.feedback.historicalPlayedMove(view.playedMove)}</strong>
          <p>{view.playedSummary}</p>
          <p>
            Ligne du coup joué :{" "}
            {view.playedLinePreview || "ligne indisponible."}
          </p>
          <button
            type="button"
            onClick={() => onShowPvLineAnnotation(annotation, index, "played")}
            disabled={!view.playedLineAvailable}
          >
            Voir la ligne
          </button>
        </article>
        <article className="review-line-card review-line-card-solution">
          <span>Avec la solution</span>
          <strong>Solution : {view.solutionMove}</strong>
          <p>Idée principale : {view.solutionSummary}</p>
          <p>
            Ligne de la solution :{" "}
            {view.solutionLinePreview || "ligne indisponible."}
          </p>
          <button
            type="button"
            onClick={() => onShowPvLineAnnotation(annotation, index, "solution")}
            disabled={!view.solutionLineAvailable}
          >
            Voir la ligne
          </button>
        </article>
      </div>
    </div>
  );
}

export function CoachExplanationBlock({
  title,
  text,
}: {
  title: string;
  text: string | null | undefined;
}) {
  if (!text) {
    return null;
  }
  return (
    <div className="review-coach-explanation">
      <span>{title}</span>
      <p>{text}</p>
    </div>
  );
}

