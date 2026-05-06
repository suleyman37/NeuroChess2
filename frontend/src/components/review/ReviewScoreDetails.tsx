import { useState } from "react";
import type { ReviewResponse, ReviewSections } from "../../api/client";
import { fr } from "../../i18n";
import { buildReviewScoreViewModel, reviewScoreAvailabilityReason } from "./reviewViewModel";
import { formatReviewScore, hasReviewScoreValue } from "./reviewUtils";
import type { ReviewPov, ReviewPovContext } from "./reviewTypes";

export function ReviewScoreSummary({
  review,
  povContext,
  filteredSections,
  onPovChange,
  onRebuildMetrics,
}: {
  review: ReviewResponse | null;
  povContext: ReviewPovContext;
  filteredSections: ReviewSections;
  onPovChange: (pov: ReviewPov) => void;
  onRebuildMetrics: () => void;
}) {
  if (!review) {
    return null;
  }

  const hasUserScores =
    hasReviewScoreValue(review.user_lichess_like_accuracy ?? review.user_review_score) ||
    hasReviewScoreValue(review.opponent_lichess_like_accuracy ?? review.opponent_review_score);
  const hasSideScores =
    hasReviewScoreValue(review.white_lichess_like_accuracy ?? review.white_review_score) ||
    hasReviewScoreValue(review.black_lichess_like_accuracy ?? review.black_review_score);
  if (!hasUserScores && !hasSideScores) {
    return null;
  }

  const {
    headlineDisplay,
    headlineLabel,
    summarySentence,
    scoreDetails,
    scoreAuditDetails,
    qualitativeLabel,
    comparisonLabel,
    confidenceLabel,
    compactAnalysisLabel,
    metricsNeedRebuild,
    referencePrecisionLabel,
  } = buildReviewScoreViewModel(review, povContext, filteredSections);
  const confidenceIsLow = review.review_score_confidence === "low";

  return (
    <section className="review-score-summary review-coach-summary" aria-label="Résumé coach">
      <div className="review-score-title">
        <span>{headlineLabel}</span>
        {confidenceIsLow && (
          <strong className="review-score-indicative">
            Score indicatif — données limitées
          </strong>
        )}
      </div>
      <div className="review-headline-score">
        <strong>{povContext.targetColor === "both" ? headlineDisplay : `NeuroScore ${headlineDisplay}`}</strong>
        {povContext.targetColor === "both" ? null : <span>/ 100</span>}
      </div>
      <p className="review-score-kind">Score coach · corrigé par les moments critiques · {qualitativeLabel}</p>
      <p className="review-reference-precision">{referencePrecisionLabel}</p>
      <p className="review-coach-sentence">
        {summarySentence}
      </p>
      <ReviewPovSelector
        povContext={povContext}
        onChange={onPovChange}
      />
      <div className="review-coach-meta">
        <span>Confiance : {confidenceLabel}</span>
        <span>{compactAnalysisLabel}</span>
      </div>
      <div className="review-score-comparison">
        <span>Comparaison</span>
        <strong>{comparisonLabel}</strong>
      </div>
      {metricsNeedRebuild && (
        <div className="review-score-rebuild">
          <span>
            Cette analyse complète doit être mise à jour avec les nouvelles métriques.
          </span>
          <button onClick={onRebuildMetrics}>Recalculer les métriques</button>
          <small>{reviewScoreAvailabilityReason(review)}</small>
        </div>
      )}
      <details className="review-score-details">
        <summary>Détails techniques / audit</summary>
        <div className="review-score-grid">
          {scoreDetails.map((metric) => (
            <ReviewScoreMetric
              key={metric.label}
              label={metric.label}
              value={metric.value}
              signed={metric.signed}
              suffix={metric.suffix}
            />
          ))}
          {scoreAuditDetails.map((metric) => (
            <ReviewScoreMetric
              key={metric.label}
              label={metric.label}
              value={metric.value}
              signed={metric.signed}
              suffix={metric.suffix}
            />
          ))}
        </div>
        <p className="review-score-note">
          Le NeuroScore est un score coach. La précision de référence est affichée séparément ; l'écart diagnostique reste une métrique d'audit non calibrée.
        </p>
      </details>
    </section>
  );
}

export function ReviewPovSelector({
  povContext,
  onChange,
}: {
  povContext: ReviewPovContext;
  onChange: (pov: ReviewPov) => void;
}) {
  const [open, setOpen] = useState(false);
  const summaryLabel = povSummaryLabel(povContext);
  const detectedColorLabel = povContext.userColor
    ? povColorLabel(povContext.userColor)
    : null;

  return (
    <div
      className="review-pov-selector compact"
      aria-label={fr.review.pov.analyzedPlayer}
      data-testid="review-analyzed-player-panel"
    >
      <span data-testid="review-analyzed-player-current">{summaryLabel}</span>
      {detectedColorLabel ? (
        <small data-testid="review-user-color-detected-label">
          {fr.review.pov.detectedColor(detectedColorLabel)}
        </small>
      ) : (
        <small data-testid="review-analyzed-player-me-disabled-reason">
          {fr.review.pov.unknownColor} {fr.review.pov.chooseSide}
        </small>
      )}
      <button
        type="button"
        className="review-pov-change"
        data-testid="review-analyzed-player-change-button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {fr.review.pov.change}
      </button>
      {open && (
        <div
          className="review-pov-options"
          role="group"
          aria-label={fr.review.pov.choiceAria}
        >
          {povContext.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === povContext.selectedPov ? "active" : ""}
              data-testid={`review-analyzed-player-option-${optionTestIdSuffix(option.value)}`}
              aria-pressed={option.value === povContext.selectedPov}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function povSummaryLabel(povContext: ReviewPovContext): string {
  if (povContext.targetColor === "both") {
    return fr.review.pov.bothSummary;
  }
  if (povContext.isUserPov) {
    return fr.review.pov.meSummary;
  }
  return fr.review.pov.colorSummary(povColorLabel(povContext.targetColor));
}

function povColorLabel(color: "white" | "black"): string {
  return color === "black" ? fr.review.pov.black : fr.review.pov.white;
}

function optionTestIdSuffix(value: ReviewPov): string {
  if (value === "user") return "me";
  return value;
}

export function ReviewScoreMetric({
  label,
  value,
  signed = false,
  suffix = " %",
}: {
  label: string;
  value: number | null | undefined;
  signed?: boolean;
  suffix?: string;
}) {
  return (
    <div className="review-score-metric">
      <span>{label}</span>
      <strong>{formatReviewScore(value, { signed, suffix })}</strong>
    </div>
  );
}


export const ReviewScoreDetails = ReviewScoreSummary;
