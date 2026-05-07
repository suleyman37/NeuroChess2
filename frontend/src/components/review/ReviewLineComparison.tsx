import type { ReviewMoveAnnotation } from "../../api/client";
import { fr } from "../../i18n";
import { MoveQualityBadge } from "./MoveQualityBadge";
import { getMoveQualityGlyphForHistoricalCategory } from "./moveQualityGlyphs";
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
  const historicalQualityId = getMoveQualityGlyphForHistoricalCategory(
    annotation.primary_category,
  );
  return (
    <div className="review-line-comparison" aria-label={fr.lines.compare}>
      <div className="review-line-comparison-head">
        <span>{fr.lines.compareTwoFutures}</span>
        <strong>{view.mainDifference ?? fr.lines.defaultDifference}</strong>
      </div>
      <div className="review-line-comparison-grid">
        <article className="review-line-card review-line-card-played">
          <span>{fr.feedback.lineHistoricalContext}</span>
          <MoveQualityBadge
            qualityId={historicalQualityId}
            context="historical"
            size="sm"
            testId="review-line-game-quality-badge"
          />
          <strong>{fr.feedback.historicalPlayedMove(view.playedMove)}</strong>
          <p>{view.playedSummary}</p>
          <p>
            {fr.lines.playedLinePrefix} :{" "}
            {view.playedLinePreview || fr.lines.unavailable}
          </p>
          <button
            type="button"
            onClick={() => onShowPvLineAnnotation(annotation, index, "played")}
            disabled={!view.playedLineAvailable}
            data-testid="review-line-game-play-button"
          >
            {fr.lines.playGameLine}
          </button>
        </article>
        <article className="review-line-card review-line-card-solution">
          <span>{fr.lines.solutionContext}</span>
          <MoveQualityBadge
            qualityId="critical_best"
            context="solution"
            size="sm"
            testId="review-line-solution-quality-badge"
          />
          <strong>{fr.lines.solutionMove(view.solutionMove)}</strong>
          <p>{fr.lines.mainIdea(view.solutionSummary)}</p>
          <p>
            {fr.lines.solutionLinePrefix} :{" "}
            {view.solutionLinePreview || fr.lines.unavailable}
          </p>
          <button
            type="button"
            onClick={() => onShowPvLineAnnotation(annotation, index, "solution")}
            disabled={!view.solutionLineAvailable}
            data-testid="review-line-solution-play-button"
          >
            {fr.lines.playSolutionLine}
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

