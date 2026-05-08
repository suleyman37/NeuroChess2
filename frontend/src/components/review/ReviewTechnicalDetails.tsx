import type { ReactNode } from "react";
import type { ReviewJobResponse, ReviewMoment, ReviewMoveAnnotation, ReviewResponse, ReviewScoreAuditRow, ReviewScoreDebug } from "../../api/client";
import { reviewScoreConfidenceLabel } from "./reviewLabels";
import {
  auditMoveScore,
  badgeClass,
  commentForLabel,
  formatDebugNumber,
  formatOptionalPercent,
  momentKey,
  momentTypeLabel,
  pvContrastLinePreview,
  reviewMomentDelta,
} from "./reviewUtils";
import type { ReviewRunOptions } from "./reviewTypes";

export function ReviewMessage({ children }: { children: ReactNode }) {
  return (
    <div className="review-content">
      <div className="panel-title">Moments à revoir</div>
      <div className="review-message">{children}</div>
    </div>
  );
}

export function ReviewPvContrastDebugList({
  annotations,
}: {
  annotations: ReviewMoveAnnotation[];
}) {
  const annotationsWithEvidence = annotations.filter(
    (annotation) => annotation.pv_contrast_evidence,
  );
  if (annotationsWithEvidence.length === 0) {
    return null;
  }
  return (
    <details className="review-pv-contrast-debug">
      <summary>Détails techniques PV</summary>
      {annotationsWithEvidence.slice(0, 12).map((annotation) => (
        <ReviewPvContrastTechnicalDetails
          key={annotation.ply}
          evidence={annotation.pv_contrast_evidence}
          label={`Ply ${annotation.ply} · ${annotation.san ?? annotation.uci ?? "coup"}`}
        />
      ))}
    </details>
  );
}

export function ReviewPvContrastTechnicalDetails({
  evidence,
  label,
}: {
  evidence: ReviewMoveAnnotation["pv_contrast_evidence"];
  label: string;
}) {
  if (!evidence) {
    return null;
  }
  const contrast = evidence.contrast;
  const playedPreview = pvContrastLinePreview(evidence.played_branch?.pv);
  const bestPreview = pvContrastLinePreview(evidence.best_branch?.pv);
  return (
    <div className="review-pv-contrast-debug-item">
      <strong>{label}</strong>
      <dl>
        <dt>main_difference_type</dt>
        <dd>{contrast?.main_difference_type ?? "unknown"}</dd>
        <dt>confidence</dt>
        <dd>{evidence.confidence ?? "low"}</dd>
        <dt>played_branch</dt>
        <dd>{playedPreview || "non disponible"}</dd>
        <dt>best_branch</dt>
        <dd>{bestPreview || "non disponible"}</dd>
        <dt>missing_data</dt>
        <dd>{evidence.missing_data?.join(", ") || "none"}</dd>
      </dl>
    </div>
  );
}

export function ReviewAnalysisOptions({
  review,
  analysisProfile,
  resetPicker,
  onRetry,
  onToggleResetPicker,
}: {
  review: ReviewResponse;
  analysisProfile: "quick" | "standard" | "deep";
  resetPicker: ReactNode;
  onRetry: (options?: ReviewRunOptions) => void;
  onToggleResetPicker: () => void;
}) {
  return (
    <details className="review-analysis-options">
      <summary>Options d'analyse</summary>
      <div className="review-action-row">
        <button onClick={() => onRetry()}>Recalculer {analysisProfile}</button>
        {analysisProfile !== "deep" && (
          <button onClick={() => onRetry({ profile: "deep" })}>
            Analyse approfondie
          </button>
        )}
        <button onClick={onToggleResetPicker}>Relancer depuis zéro</button>
      </div>
      {resetPicker}
      <div className="review-analysis-origin">
        {reviewAnalysisStatusLabel(review)}
      </div>
      <div className="review-analysis-settings">
        Mode {review.review_analysis_profile ?? review.review_analysis_quality ?? "standard"} ·{" "}
        {review.completed_position_count ?? review.deep_done_count ?? 0}/
        {review.required_position_count ?? 0} positions · temps prévu{" "}
        {review.total_budget_seconds ?? 0}s · Stockfish MultiPV{" "}
        {review.requested_multipv ?? 3} ·{" "}
        {review.analysis_limit_mode ?? "time-only"}
        {" "}· Threads {review.analysis_threads ?? "?"} · Hash{" "}
        {review.analysis_hash_mb ?? "?"} MB
      </div>
      {import.meta.env.DEV && (
        <details className="review-score-debug" data-review-score-debug="true">
          <summary>Debug score Review</summary>
          <ReviewAnalysisDebugBlock review={review} />
          <ReviewScoreDebugBlock label="Blancs" debug={review.white_score_debug} />
          <ReviewScoreDebugBlock label="Noirs" debug={review.black_score_debug} />
          <ReviewScoreAuditTable rows={review.review_score_audit_rows ?? []} />
          <ReviewPvContrastDebugList annotations={review.move_annotations ?? []} />
        </details>
      )}
    </details>
  );
}

export function ReviewLegacyMoments({
  review,
  selectedMomentId,
  hideEvaluation,
  onShowMoment,
}: {
  review: ReviewResponse;
  selectedMomentId: string | null;
  hideEvaluation: boolean;
  onShowMoment: (
    moment: ReviewMoment,
    index: number,
    moveMode?: "played" | "best",
  ) => void;
}) {
  return (
    <ol className="review-list">
      {review.moments.map((moment, index) => {
        const momentId = momentKey(moment, index);
        const bestMove = moment.best_move_san ?? moment.best_move_uci ?? "non disponible";
        const displayLabel = momentTypeLabel(moment.moment_type) ?? moment.cp_loss_label;
        const delta = reviewMomentDelta(moment);
        return (
          <li
            key={momentId}
            className={`review-item ${selectedMomentId === momentId ? "active" : ""}`}
          >
            <div className="review-item-head">
              <span>#{index + 1}</span>
              <strong>Coup {moment.ply}</strong>
              <span
                className={`review-badge ${badgeClass(displayLabel)}`}
                aria-label={`écart ${moment.cp_loss_label}`}
              >
                {displayLabel}
              </span>
            </div>
            <div className="review-line review-move-line">
              <span>Joué</span>
              <strong className="played-move">
                {moment.played_san ?? moment.played_uci}
              </strong>
              <span>Meilleur</span>
              <strong className="engine-move">{bestMove}</strong>
            </div>
            {hideEvaluation ? (
              <div className="review-line review-evaluation-hidden">
                <span>Évaluation</span>
                <strong>Évaluation masquée</strong>
              </div>
            ) : (
              <div className="review-line">
                <span>Évaluation</span>
                <strong>
                  {moment.eval_before_label} → {moment.eval_after_label}
                </strong>
              </div>
            )}
            {!hideEvaluation && delta && (
              <div className="review-line">
                <span>Variation joueur</span>
                <strong className={`review-delta review-delta-${delta.tone}`}>
                  {delta.label}
                </strong>
              </div>
            )}
            <p>{commentForLabel(displayLabel)}</p>
            <div className="review-action-row">
              <button onClick={() => onShowMoment(moment, index, "played")}>
                Voir le coup joué
              </button>
              <button
                onClick={() => onShowMoment(moment, index, "best")}
                disabled={!moment.best_move_uci}
                title={
                  moment.best_move_uci
                    ? "Voir la suggestion moteur depuis la même position"
                    : "Meilleur coup non disponible sur l'échiquier"
                }
              >
                Voir le meilleur coup
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function reviewJobStatusTitle(job: ReviewJobResponse): string {
  if (job.status === "cancelled") {
    return "Analyse annulée";
  }
  if (job.status === "failed") {
    return "Analyse échouée";
  }
  if (job.status === "stalled") {
    return "Analyse bloquée temporairement";
  }
  return "Analyse incomplète";
}

export function reviewJobReconcileTitle(job: ReviewJobResponse): string {
  if (job.derived_reconcile_reason === "coverage_complete") {
    return "Finalisation Review disponible";
  }
  if (job.derived_reconcile_reason === "completed_without_review") {
    return "Finalisation Review à vérifier";
  }
  return "Analyse peut être bloquée";
}

export function reviewJobReconcileMessage(job: ReviewJobResponse): string {
  if (job.derived_reconcile_reason === "coverage_complete") {
    return "Toutes les positions sont disponibles. Une vérification explicite peut construire la Review finale.";
  }
  if (job.derived_reconcile_reason === "completed_without_review") {
    return "Le job est marqué terminé, mais la Review finale doit être reconstruite explicitement.";
  }
  return "Le statut est lu sans correction automatique. Vous pouvez lancer une vérification explicite.";
}

export function ReviewAnalysisUnavailableMessage({
  title,
  detail,
  analysisProfile,
  onAnalysisProfileChange,
  onRunRecommended,
  onRunStandard,
  onRunDeep,
  resetPicker = null,
  onToggleResetPicker,
}: {
  title: string;
  detail: string;
  analysisProfile: "quick" | "standard" | "deep";
  onAnalysisProfileChange: (profile: "quick" | "standard" | "deep") => void;
  onRunRecommended: () => void;
  onRunStandard: () => void;
  onRunDeep: () => void;
  resetPicker?: ReactNode;
  onToggleResetPicker?: () => void;
}) {
  return (
    <ReviewMessage>
      <div
        className="review-job-progress review-analysis-unavailable"
        data-review-incomplete-single-cta="true"
      >
        <strong>{title}</strong>
        <span>Cette partie peut être analysée.</span>
        <span>{detail}</span>
        <div className="review-action-row">
          <button className="primary" onClick={onRunRecommended}>
            Lancer l'analyse recommandée
          </button>
        </div>
        <details className="review-analysis-options">
          <summary>Options d'analyse</summary>
          <ReviewAnalysisProfileSelector
            value={analysisProfile}
            onChange={onAnalysisProfileChange}
          />
          <div className="review-action-row">
            <button onClick={onRunStandard}>Standard recommand?</button>
            <button onClick={onRunDeep}>Approfondie</button>
            {onToggleResetPicker && (
              <button onClick={onToggleResetPicker}>Relancer depuis zéro</button>
            )}
          </div>
          {resetPicker}
          <div className="review-analysis-settings">
            Les options avancées restent fermées pour garder le mode standard simple.
          </div>
        </details>
      </div>
    </ReviewMessage>
  );
}

export function ReviewAnalysisProfileSelector({
  value,
  onChange,
}: {
  value: "quick" | "standard" | "deep";
  onChange: (profile: "quick" | "standard" | "deep") => void;
}) {
  return (
    <label className="review-analysis-profile">
      <span>Mode</span>
      <select
        data-testid="review-profile-select"
        value={value}
        onChange={(event) =>
          onChange(event.target.value as "quick" | "standard" | "deep")
        }
      >
        <option value="standard">Standard recommandé</option>
        <option value="deep">Approfondie</option>
      </select>
    </label>
  );
}

export function ForceReanalysisPicker({
  onSelect,
  onCancel,
}: {
  onSelect: (profile: "standard" | "deep") => void;
  onCancel: () => void;
}) {
  return (
    <div className="review-reset-picker">
      <span>
        Cela ignorera l'ancienne analyse et recalculera avec le moteur actuel.
      </span>
      <div className="review-action-row">
        <button onClick={() => onSelect("standard")}>Standard recommandée</button>
        <button onClick={() => onSelect("deep")}>Approfondie</button>
        <button className="ghost" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}

export function ReviewAnalysisDebugBlock({ review }: { review: ReviewResponse }) {
  return (
    <dl className="review-score-debug-block">
      <dt>Analyse</dt>
      <dd>profile: {review.review_analysis_profile ?? "unknown"}</dd>
      <dd>required_position_count: {review.required_position_count ?? 0}</dd>
      <dd>completed_position_count: {review.completed_position_count ?? 0}</dd>
      <dd>total_budget_seconds: {review.total_budget_seconds ?? 0}</dd>
      <dd>per_position_time_ms: {review.per_position_time_ms ?? 0}</dd>
      <dd>analysis_limit_mode: {review.analysis_limit_mode ?? "unknown"}</dd>
      <dd>requested_multipv: {review.requested_multipv ?? "unknown"}</dd>
      <dd>analysis_threads: {review.analysis_threads ?? "unknown"}</dd>
      <dd>analysis_hash_mb: {review.analysis_hash_mb ?? "unknown"}</dd>
      <dd>uci_analyse_mode: {String(review.uci_analyse_mode ?? "unknown")}</dd>
      <dd>uci_limit_strength: {String(review.uci_limit_strength ?? "unknown")}</dd>
      <dd>skill_level: {String(review.skill_level ?? "unknown")}</dd>
      <dd>syzygy_path_active: {String(review.syzygy_path_active ?? false)}</dd>
      <dd>average_depth_reached: {formatDebugNumber(review.average_depth_reached)}</dd>
      <dd>min_depth_reached: {formatDebugNumber(review.min_depth_reached)}</dd>
      <dd>max_depth_reached: {formatDebugNumber(review.max_depth_reached)}</dd>
      <dd>cache_hits: {review.cache_hits ?? 0}</dd>
      <dd>cache_misses: {review.cache_misses ?? 0}</dd>
      <dd>legacy_cache_ignored_count: {review.legacy_cache_ignored_count ?? 0}</dd>
    </dl>
  );
}

export function ReviewScoreDebugBlock({
  label,
  debug,
}: {
  label: string;
  debug: ReviewScoreDebug | null | undefined;
}) {
  if (!debug) {
    return (
      <div className="review-score-debug-block">
        <strong>{label}</strong>
        <span>non disponible</span>
      </div>
    );
  }

  return (
    <dl className="review-score-debug-block">
      <dt>{label}</dt>
      <dd>coups analysés: {debug.analyzed_moves}</dd>
      <dd>coups manquants: {debug.missing_moves}</dd>
      <dd>avg_win_loss: {formatDebugNumber(debug.avg_win_loss)}</dd>
      <dd>max_win_loss: {formatDebugNumber(debug.max_win_loss)}</dd>
      <dd>weighted_mean: {formatDebugNumber(debug.weighted_mean)}</dd>
      <dd>weighted_harmonic: {formatDebugNumber(debug.weighted_harmonic)}</dd>
      <dd>lichess_like_accuracy: {formatDebugNumber(debug.lichess_like_accuracy ?? debug.final_score)}</dd>
      <dd>neuro_score: {formatDebugNumber(debug.neuro_score)}</dd>
      <dd>diagnostic_gap: {formatDebugNumber(debug.diagnostic_gap)}</dd>
      <dd>tail_win_loss: {formatDebugNumber(debug.tail_win_loss)}</dd>
      <dd>mean_diagnostic_loss: {formatDebugNumber(debug.mean_diagnostic_loss)}</dd>
      <dd>tail_diagnostic_loss: {formatDebugNumber(debug.tail_diagnostic_loss)}</dd>
      <dd>tail_count: {formatDebugNumber(debug.tail_count ?? null)}</dd>
      <dd>z_value: {formatDebugNumber(debug.z_value)}</dd>
      <dd>confidence: {debug.confidence}</dd>
      <dd>depth_min: {formatDebugNumber(debug.depth_min ?? null)}</dd>
      <dd>depth_max: {formatDebugNumber(debug.depth_max ?? null)}</dd>
      <dd>depth_avg: {formatDebugNumber(debug.depth_avg ?? null)}</dd>
      <dd>engine_versions: {(debug.engine_versions ?? []).join(", ") || "unknown"}</dd>
    </dl>
  );
}

export function ReviewScoreAuditTable({ rows }: { rows: ReviewScoreAuditRow[] }) {
  if (rows.length === 0) {
    return <div className="review-score-debug-block">Audit coups : aucun coup</div>;
  }

  return (
    <div className="review-score-audit-table" data-review-score-audit-table="true">
      <div className="review-score-audit-title">Audit coups scorés</div>
      <table>
        <thead>
          <tr>
            <th>Ply</th>
            <th>Camp</th>
            <th>Coup</th>
            <th>Win loss</th>
            <th>Score coup</th>
            <th>Poids</th>
            <th>Depth</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.ply}-${row.uci}`}>
              <td>{row.ply}</td>
              <td>{row.side}</td>
              <td>{row.san ?? row.uci}</td>
              <td>{formatDebugNumber(row.win_loss)}</td>
              <td>
                {row.included_in_score
                  ? formatDebugNumber(auditMoveScore(row))
                  : row.exclusion_reason ?? "exclu"}
              </td>
              <td>{formatDebugNumber(row.move_weight)}</td>
              <td>
                {row.depth_before ?? "?"}/{row.depth_after ?? "?"}
              </td>
              <td>
                {row.source_before ?? "?"} → {row.source_after ?? "?"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function reviewAnalysisStatusLabel(review: ReviewResponse): string {
  const quality = review.review_analysis_quality ?? "cached";
  const profile = review.review_analysis_profile ?? quality;
  const coverage = `${review.deep_done_count ?? 0}/${review.required_position_count ?? 0} positions`;
  const confidence = reviewScoreConfidenceLabel(review.review_score_confidence);
  const budget = review.total_budget_seconds
    ? ` · temps prévu ${review.total_budget_seconds}s`
    : "";
  const settings =
    review.analysis_limit_mode || review.requested_multipv
      ? ` · Stockfish MultiPV ${review.requested_multipv ?? "?"} · ${
          review.analysis_limit_mode ?? "mode inconnu"
        } · Threads ${review.analysis_threads ?? "?"} · Hash ${
          review.analysis_hash_mb ?? "?"
        } MB`
      : "";
  if (
    (review.legacy_cache_ignored_count ?? 0) > 0 &&
    review.review_analysis_state === "pending"
  ) {
    return `Analyse rapide disponible · lancement ${profile} · ${coverage}${budget}${settings}`;
  }
  if (review.review_analysis_origin === "cached_full") {
    return `Analyse déjà disponible · ${quality} · ${coverage} · confiance ${confidence}`;
  }
  if (review.review_analysis_state === "pending") {
    return `Analyse ${quality} en cours · ${coverage} · confiance ${confidence}`;
  }
  if (review.review_analysis_state === "partial") {
    return `Review partielle · ${quality} · ${coverage} · confiance ${confidence}`;
  }
  if (review.review_analysis_state === "failed") {
    return `Analyse approfondie incomplète · ${coverage}`;
  }
  if (review.review_score_confidence === "low") {
    return `Score indicatif — données limitées · ${coverage}`;
  }
  return `Analyse ${quality} · ${coverage} · confiance ${confidence}`;
}


export const ReviewTechnicalDetails = ReviewAnalysisOptions;
