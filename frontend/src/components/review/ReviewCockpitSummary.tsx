import type { ReviewMoveAnnotation, ReviewResponse, ReviewSections } from "../../api/client";
import { errorTypeLabel, reviewScoreConfidenceLabel } from "./reviewLabels";
import { ReviewPovSelector } from "./ReviewScoreDetails";
import { formatHeadlineScore, hasReviewScoreValue } from "./reviewUtils";
import {
  coachNeuroScoreForReview,
  coachScoreLabelForPov,
  coachScoreUsesReferenceFallback,
  comparisonLabelForPov,
  humanReason,
  qualitativeGameLabelForPov,
  referencePrecisionLabelForPov,
  reviewCockpitPriorities,
  reviewCompactAnalysisLabel,
  reviewMetricsNeedRebuild,
  reviewScoreAvailabilityReason,
  reviewSummaryForPov,
} from "./reviewViewModel";
import type { ReviewFocusKey, ReviewPov, ReviewPovContext } from "./reviewTypes";

export function ReviewCockpitSummary({
  review,
  povContext,
  filteredSections,
  selectedCoachAnnotation,
  practiceEligibleCount,
  onPovChange,
  onStartPractice,
  onOpenLesson,
  onFocusChange,
}: {
  review: ReviewResponse | null;
  povContext: ReviewPovContext;
  filteredSections: ReviewSections;
  selectedCoachAnnotation: ReviewMoveAnnotation | null;
  practiceEligibleCount: number;
  onPovChange: (pov: ReviewPov) => void;
  onStartPractice: () => void;
  onOpenLesson: (annotation: ReviewMoveAnnotation | null) => void;
  onFocusChange: (focus: ReviewFocusKey) => void;
  onTimelineEventSelect: unknown;
}) {
  if (!review) {
    return null;
  }

  const priorities = reviewCockpitPriorities(filteredSections);
  const visibleMoments = priorities.slice(0, 3);
  const mainMoment = selectedCoachAnnotation ?? visibleMoments[0] ?? filteredSections.all[0] ?? null;
  const confidenceLabel = reviewScoreConfidenceLabel(review.review_score_confidence);
  const metricsNeedRebuild = reviewMetricsNeedRebuild(review);
  const coachScore = coachNeuroScoreForReview(review, povContext);
  const scoreFallback = coachScoreUsesReferenceFallback(review, povContext);
  const coachScoreLabel = coachScoreLabelForPov(povContext, scoreFallback);
  const referencePrecisionLabel = referencePrecisionLabelForPov(review, povContext);
  const headlineDisplay =
    povContext.targetColor === "both"
      ? comparisonLabelForPov(review, povContext)
      : hasReviewScoreValue(coachScore)
        ? `NeuroScore ${formatHeadlineScore(coachScore)} / 100`
        : "Score indisponible";
  const qualitativeLabel = qualitativeGameLabelForPov(review, povContext, filteredSections);
  const summarySentence = reviewSummaryForPov(review, povContext, filteredSections);
  const practicePositionCount = Math.min(5, practiceEligibleCount);
  const estimatedPracticeMinutes = estimatePracticeMinutes(practicePositionCount);

  return (
    <section className="review-cockpit-summary review-summary-simple" aria-label="Résumé Review">
      <div className="review-cockpit-hero">
        <div className="review-cockpit-score">
          <span>{coachScoreLabel}</span>
          <strong>{headlineDisplay}</strong>
          <em>{qualitativeLabel}</em>
          <p>{summarySentence}</p>
        </div>
        <div className="review-cockpit-meta">
          <span>{comparisonLabelForPov(review, povContext)}</span>
          <ReviewPovSelector povContext={povContext} onChange={onPovChange} />
        </div>
      </div>

      <details className="review-reference-details">
        <summary>Voir le détail du score</summary>
        <p>{referencePrecisionLabel}</p>
        <p>Le Score coach combine précision et gravité des moments critiques.</p>
        <small>{reviewCompactAnalysisLabel(review)} - confiance {confidenceLabel}</small>
      </details>

      {metricsNeedRebuild && (
        <div className="review-score-rebuild">
          <span>Cette analyse complète peut être mise à jour depuis Explorer.</span>
          <small>{reviewScoreAvailabilityReason(review)}</small>
        </div>
      )}

      <section className="review-cockpit-section review-key-moments" aria-label="Moments clés">
        <div className="review-block-title">
          <span>Moments clés</span>
          <strong>{visibleMoments.length}/3</strong>
        </div>
        {visibleMoments.length === 0 ? (
          <p className="review-cockpit-empty">Aucun moment prioritaire détecté.</p>
        ) : (
          <ol className="review-key-moment-list">
            {visibleMoments.map((annotation, index) => (
              <li key={`${annotation.ply}-${annotation.uci}-${index}`}>
                <button type="button" onClick={() => onOpenLesson(annotation)}>
                  <span>Coup {annotation.move_number}</span>
                  <strong>
                    {errorTypeLabel(annotation.pedagogical_explanation?.error_type, annotation)}
                  </strong>
                  <p>{humanReason(annotation)}</p>
                  <small>Voir</small>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="review-training-card" aria-label="Entraînement Review">
        <div>
          <span>Entraînement</span>
          <strong>S'entraîner sur cette Review</strong>
          <p>
            {practiceEligibleCount > 0
              ? `${practicePositionCount} position${practicePositionCount > 1 ? "s" : ""} - environ ${estimatedPracticeMinutes} minutes.`
              : "Aucune position fiable prête pour une session courte."}
          </p>
        </div>
        {practiceEligibleCount > 0 ? (
          <button type="button" className="primary" onClick={onStartPractice}>
            Commencer
          </button>
        ) : (
          <button type="button" className="primary" onClick={() => onOpenLesson(mainMoment)}>
            Voir
          </button>
        )}
      </section>

      <button
        type="button"
        className="review-advanced-link"
        onClick={() => onFocusChange("lab")}
      >
        Explorer les détails
      </button>
    </section>
  );
}

function estimatePracticeMinutes(positionCount: number): number {
  if (positionCount <= 0) {
    return 0;
  }
  return Math.max(3, Math.min(10, positionCount * 2));
}
