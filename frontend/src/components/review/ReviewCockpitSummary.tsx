import type { ReviewMoveAnnotation, ReviewResponse, ReviewSections } from "../../api/client";
import { fr } from "../../i18n";
import { errorTypeLabel, reviewScoreConfidenceLabel } from "./reviewLabels";
import { ReviewPovSelector } from "./ReviewScoreDetails";
import { MoveQualityBadge } from "./MoveQualityBadge";
import { ReviewDecisionCard } from "./ReviewDecisionCard";
import { ReviewQualityLegend } from "./ReviewQualityLegend";
import { ReviewQualityRibbon } from "./ReviewQualityRibbon";
import { getMoveQualityGlyphForHistoricalCategory } from "./moveQualityGlyphs";
import {
  formatHeadlineScore,
  hasReviewScoreValue,
  isMicroReviewObservation,
  reviewMomentImportanceLabel,
  reviewMomentReason,
} from "./reviewUtils";
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

  const priorityMoments = filteredSections.priority_training ?? [];
  const secondaryMoments = filteredSections.secondary_training ?? [];
  const microGaps = filteredSections.micro_gaps ?? [];
  const goodDecisions = filteredSections.good_decisions ?? [];
  const priorities = reviewCockpitPriorities(filteredSections);
  const visibleMoments = priorityMoments.slice(0, 3);
  const fallbackMoment =
    priorities[0] ?? secondaryMoments[0] ?? microGaps[0] ?? goodDecisions[0] ?? filteredSections.all[0] ?? null;
  const mainMoment = selectedCoachAnnotation ?? visibleMoments[0] ?? fallbackMoment;
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
  const hasSecondaryReviewGroups =
    secondaryMoments.length > 0 || microGaps.length > 0 || goodDecisions.length > 0;

  return (
    <section
      className="review-cockpit-summary review-summary-simple"
      aria-label="Résumé Review"
      data-testid="review-summary"
    >
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

      <ReviewQualityRibbon
        annotations={filteredSections.all.length ? filteredSections.all : priorities}
        selectedPly={mainMoment?.ply ?? null}
        showColor={povContext.targetColor === "both"}
        onSelectAnnotation={onOpenLesson}
      />

      {mainMoment && (
        <ReviewDecisionCard
          className="review-summary-decision-card"
          historical={{
            label: fr.decisionCard.historicalMove,
            move: mainMoment.san ?? mainMoment.uci,
            qualityId: safeHistoricalQualityId(mainMoment.primary_category),
            qualityContext: "historical",
            rowTestId: "review-decision-card-historical-row",
            badgeTestId: "historical-move-quality-badge",
            detail: mainMoment.move_quality_label ?? mainMoment.category_label,
            showUnknownQuality: true,
          }}
          why={reviewMomentReason(mainMoment) ?? humanReason(mainMoment)}
          whyLabel={fr.decisionCard.whyThisMoment}
          momentLabel={reviewMomentImportanceLabel(mainMoment)}
          microObservation={isMicroReviewObservation(mainMoment)}
        />
      )}

      <ReviewQualityLegend />

      {metricsNeedRebuild && (
        <div className="review-score-rebuild">
          <span>Cette analyse complète peut être mise à jour depuis Explorer.</span>
          <small>{reviewScoreAvailabilityReason(review)}</small>
        </div>
      )}

      <section className="review-cockpit-section review-key-moments" aria-label="Moments clés">
        <div className="review-block-title">
          <span>{fr.momentImportance.summaryGroups.priority_training}</span>
          <strong>{priorityMoments.length}</strong>
        </div>
        {visibleMoments.length === 0 ? (
          <div className="review-cockpit-empty">
            <p>{fr.momentImportance.noPriority}</p>
            {hasSecondaryReviewGroups && <small>{fr.momentImportance.noPriorityDetail}</small>}
          </div>
        ) : (
          <ol className="review-key-moment-list">
            {visibleMoments.map((annotation, index) => (
              <li
                key={`${annotation.ply}-${annotation.uci}-${index}`}
                data-testid="review-moment-card"
              >
                <button type="button" onClick={() => onOpenLesson(annotation)}>
                  <span>Coup {annotation.move_number}</span>
                  {reviewMomentImportanceLabel(annotation) && (
                    <em className="review-moment-importance-pill">
                      {reviewMomentImportanceLabel(annotation)}
                    </em>
                  )}
                  {safeHistoricalQualityId(annotation.primary_category) && (
                    <span className="review-key-moment-quality">
                      <MoveQualityBadge
                        qualityId={safeHistoricalQualityId(annotation.primary_category)}
                        context="historical"
                        size="sm"
                        testId="historical-move-quality-badge"
                      />
                    </span>
                  )}
                  <strong>
                    {errorTypeLabel(annotation.pedagogical_explanation?.error_type, annotation)}
                  </strong>
                  <p>{reviewMomentReason(annotation) ?? humanReason(annotation)}</p>
                  <small>Voir</small>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {hasSecondaryReviewGroups && (
        <section className="review-cockpit-section review-moment-groups" aria-label="Autres moments analysés">
          <ReviewMomentGroup
            title={fr.momentImportance.summaryGroups.secondary_training}
            moments={secondaryMoments}
            onOpenLesson={onOpenLesson}
          />
          <ReviewMomentGroup
            title={fr.momentImportance.summaryGroups.micro_gap}
            moments={microGaps}
            onOpenLesson={onOpenLesson}
          />
          <ReviewMomentGroup
            title={fr.momentImportance.summaryGroups.good_decision}
            moments={goodDecisions}
            onOpenLesson={onOpenLesson}
          />
        </section>
      )}

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
          <button
            type="button"
            className="primary"
            data-testid="review-practice-button"
            onClick={onStartPractice}
          >
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

function safeHistoricalQualityId(category: string | null | undefined) {
  const qualityId = getMoveQualityGlyphForHistoricalCategory(category);
  return qualityId === "unknown" ? null : qualityId;
}

function ReviewMomentGroup({
  title,
  moments,
  onOpenLesson,
}: {
  title: string;
  moments: ReviewMoveAnnotation[];
  onOpenLesson: (annotation: ReviewMoveAnnotation | null) => void;
}) {
  if (!moments.length) {
    return null;
  }
  return (
    <div className="review-moment-group">
      <div className="review-block-title">
        <span>{title}</span>
        <strong>{moments.length}</strong>
      </div>
      <ol className="review-moment-group-list">
        {moments.slice(0, 4).map((annotation) => (
          <li key={`${title}-${annotation.ply}-${annotation.uci}`}>
            <button type="button" onClick={() => onOpenLesson(annotation)}>
              <span>Coup {annotation.move_number}</span>
              <strong>{annotation.san ?? annotation.uci}</strong>
              <small>{reviewMomentReason(annotation) ?? annotation.category_label}</small>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
