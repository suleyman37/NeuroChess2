import type { ReviewMoveAnnotation, ReviewResponse, ReviewSections } from "../../api/client";
import {
  NeuroMonitorBrain3D,
} from "../neuro3d/NeuroMonitorBrain3D";
import type { BrainDomainKey } from "../neuro3d/neuroBrainTypes";
import {
  buildNeuroMonitorBrainData,
  findNeuroMonitorAnnotationForDomain,
} from "../neuro3d/neuroBrainVisualModel";
import { errorTypeLabel, reviewScoreConfidenceLabel } from "./reviewLabels";
import { ReviewPovSelector } from "./ReviewScoreDetails";
import { formatHeadlineScore, formatImpact, hasReviewScoreValue } from "./reviewUtils";
import {
  coachNeuroScoreForReview,
  coachScoreLabelForPov,
  coachScoreUsesReferenceFallback,
  comparisonLabelForPov,
  qualitativeGameLabelForPov,
  referencePrecisionLabelForPov,
  reviewCockpitIndicators,
  reviewCockpitPriorities,
  reviewCockpitTakeaways,
  reviewCompactAnalysisLabel,
  reviewMetricsNeedRebuild,
  reviewSummaryForPov,
  reviewScoreAvailabilityReason,
} from "./reviewViewModel";
import type { GameStoryEvent, ReviewCockpitIndicator, ReviewFocusKey, ReviewPov, ReviewPovContext } from "./reviewTypes";

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
  onTimelineEventSelect,
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
  onTimelineEventSelect: (event: GameStoryEvent) => void;
}) {
  if (!review) {
    return null;
  }

  const indicators = reviewCockpitIndicators(review, filteredSections);
  const priorities = reviewCockpitPriorities(filteredSections);
  const takeaways = reviewCockpitTakeaways(indicators, review, filteredSections);
  const mainMoment = selectedCoachAnnotation ?? priorities[0] ?? filteredSections.all[0] ?? null;
  const reviewForBrain = { ...review, review_sections: filteredSections };
  const brainData = buildNeuroMonitorBrainData(reviewForBrain, selectedCoachAnnotation, "summary");
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
  const handleBrainDomainClick = (domain: BrainDomainKey) => {
    if (domain === "opening") {
      onFocusChange("lab");
      return;
    }
    const annotation =
      findNeuroMonitorAnnotationForDomain(reviewForBrain, domain, selectedCoachAnnotation) ??
      annotationForMonitorDomain(domain, filteredSections, priorities);
    if (annotation) {
      onOpenLesson(annotation);
      return;
    }
    onFocusChange("lab");
  };

  return (
    <section className="review-cockpit-summary review-summary-simple" aria-label="Résumé Review">
      <div className="review-cockpit-hero">
        <div className="review-cockpit-score">
          <span>{coachScoreLabel}</span>
          <strong>{headlineDisplay}</strong>
          <small>{referencePrecisionLabel}</small>
          <em>{qualitativeLabel}</em>
          <p>{summarySentence}</p>
        </div>
        <div className="review-cockpit-meta">
          <span>{comparisonLabelForPov(review, povContext)}</span>
          <span>{reviewCompactAnalysisLabel(review)} · confiance {confidenceLabel}</span>
          <ReviewPovSelector povContext={povContext} onChange={onPovChange} />
        </div>
      </div>

      <div className="review-cockpit-actions">
        {practiceEligibleCount > 0 ? (
          <button
            type="button"
            className="primary"
            onClick={onStartPractice}
            title="Démarrer une session courte sur les moments prioritaires"
          >
            S'entraîner sur cette Review
          </button>
        ) : mainMoment ? (
          <button
            type="button"
            className="primary"
            onClick={() => onOpenLesson(mainMoment)}
          >
            Voir la leçon clé
          </button>
        ) : null}
        {practiceEligibleCount > 0 && mainMoment && (
          <button type="button" onClick={() => onOpenLesson(mainMoment)}>
            Voir la leçon clé
          </button>
        )}
        <button type="button" className="ghost" onClick={() => onFocusChange("lab")}>
          Explorer
        </button>
      </div>

      {metricsNeedRebuild && (
        <div className="review-score-rebuild">
          <span>
            Cette analyse complète peut être mise à jour depuis Explorer.
          </span>
          <small>{reviewScoreAvailabilityReason(review)}</small>
        </div>
      )}

      <div className="review-summary-dashboard">
        {brainData && (
          <div className="review-neuro3d-monitor" aria-label="NeuroMonitorBrain3D Review">
            <NeuroMonitorBrain3D
              data={brainData}
              onDomainClick={handleBrainDomainClick}
            />
          </div>
        )}

        <div className="review-summary-insights">
          <section className="review-cockpit-section" aria-label="3 priorités">
            <div className="review-block-title">
              <span>3 priorités</span>
              <strong>{priorities.length}</strong>
            </div>
            {priorities.length === 0 ? (
              <p className="review-cockpit-empty">Aucun moment prioritaire détecté.</p>
            ) : (
              <ol className="review-cockpit-priority-list">
                {priorities.map((annotation, index) => (
                  <li key={`${annotation.ply}-${annotation.uci}-${index}`}>
                    <button type="button" onClick={() => onOpenLesson(annotation)}>
                      <span>#{index + 1}</span>
                      <strong>
                        {errorTypeLabel(annotation.pedagogical_explanation?.error_type, annotation)}
                      </strong>
                      <em>Coup {annotation.move_number}</em>
                      <b>{formatImpact(annotation.win_loss)}</b>
                      <small className="review-priority-action">Voir</small>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="review-cockpit-section" aria-label="3 choses à retenir">
            <div className="review-block-title">
              <span>3 choses à retenir</span>
              <strong>Coach</strong>
            </div>
            <ul className="review-cockpit-takeaways">
              {takeaways.map((takeaway) => (
                <li key={takeaway}>{takeaway}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}

function annotationForMonitorDomain(
  domain: BrainDomainKey,
  filteredSections: ReviewSections,
  priorities: ReviewMoveAnnotation[],
): ReviewMoveAnnotation | null {
  if (domain === "opening") {
    return null;
  }
  const seen = new Set<string>();
  const candidates = [...priorities, ...filteredSections.all].filter((annotation) => {
    const key = `${annotation.ply ?? "?"}:${annotation.uci ?? ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  return candidates.find((annotation) => annotationMatchesDomain(annotation, domain)) ?? null;
}

function annotationMatchesDomain(
  annotation: ReviewMoveAnnotation,
  domain: Exclude<BrainDomainKey, "opening">,
): boolean {
  const tags = new Set(annotation.tags ?? []);
  const errorType = annotation.pedagogical_explanation?.error_type;
  const primary = String(annotation.primary_category ?? "").toLowerCase();
  const category = String(annotation.category_label ?? "").toLowerCase();
  const before = annotation.player_win_percent_before ?? annotation.player_percent_before ?? null;
  if (domain === "tactical") {
    return (
      errorType === "tactical" ||
      tags.has("missed_opportunity") ||
      annotation.primary_category === "critical" ||
      annotation.primary_category === "decisive"
    );
  }
  if (domain === "conversion") {
    return (
      errorType === "conversion" ||
      tags.has("conversion_issue") ||
      (Number(before ?? 0) >= 75 && Number(annotation.win_loss ?? 0) >= 10)
    );
  }
  if (domain === "plan") {
    return (
      errorType === "positional" ||
      primary === "plan" ||
      primary === "positional" ||
      category.includes("plan") ||
      category.includes("position") ||
      tags.has("persistent_loss")
    );
  }
  return (
    errorType === "defensive" ||
    tags.has("defensive_resource_missed") ||
    (Number(before ?? 100) <= 35 &&
      (Number(annotation.missed_gain ?? 0) >= 8 || Number(annotation.win_loss ?? 0) >= 8))
  );
}

function ReviewCockpitIndicatorRow({
  indicators,
}: {
  indicators: ReviewCockpitIndicator[];
}) {
  return (
    <div className="review-cockpit-indicators" aria-label="Indicateurs synthétiques">
      {indicators.map((indicator) => (
        <div
          key={indicator.key}
          className={`review-cockpit-indicator review-cockpit-indicator-${indicator.tone}`}
          title={indicator.detail}
        >
          <span>{indicator.label}</span>
          <strong>{indicator.statusLabel}</strong>
          <em>{indicator.detail}</em>
        </div>
      ))}
    </div>
  );
}

function GameStoryTimeline({
  events,
  onSelectEvent,
}: {
  events: GameStoryEvent[];
  onSelectEvent: (event: GameStoryEvent) => void;
}) {
  if (events.length === 0) {
    return null;
  }
  return (
    <section className="review-game-story" aria-label="Frise narrative de la partie">
      <div className="review-block-title">
        <span>Frise narrative</span>
        <strong>{events.length}</strong>
      </div>
      <div className="review-game-story-track">
        {events.map((event) => (
          <button
            key={event.id}
            type="button"
            className={`review-game-story-event review-game-story-${event.tone}`}
            onClick={() => onSelectEvent(event)}
          >
            <span>{event.label}</span>
            <strong>{event.moveLabel}</strong>
            <em>{event.impactLabel}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

