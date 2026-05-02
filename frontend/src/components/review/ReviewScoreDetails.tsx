import { useState } from "react";
import type { ReviewResponse, ReviewSections } from "../../api/client";
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

  return (
    <div className="review-pov-selector compact" aria-label="Joueur analysé">
      <span>{summaryLabel}</span>
      <button
        type="button"
        className="review-pov-change"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Changer
      </button>
      {open && (
        <div className="review-pov-options" role="group" aria-label="Choix du joueur analysé">
          {povContext.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === povContext.selectedPov ? "active" : ""}
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
    return "Comparaison : Blancs vs Noirs";
  }
  if (povContext.isUserPov) {
    return "Joueur analysé : Toi";
  }
  return `Joueur analysé : ${povContext.targetColor === "black" ? "Noirs" : "Blancs"}`;
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
