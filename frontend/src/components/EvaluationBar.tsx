import type { Evaluation, EvaluationSource } from "../api/client";

export type EvaluationBarPlaceholder = {
  label: string;
  sourceLabel?: string;
  sourceTitle?: string;
};

export type EvaluationDelta = {
  label: string;
  tone: "loss" | "gain" | "neutral";
  title: string;
};

export type EvaluationDeltaOverlay = {
  topPercent: number;
  heightPercent: number;
  tone: "loss" | "gain" | "neutral";
  label: string;
};

type EvaluationBarProps = {
  evaluation: Evaluation | null;
  source: EvaluationSource | null;
  placeholder?: EvaluationBarPlaceholder | null;
  delta?: EvaluationDelta | null;
  deltaOverlay?: EvaluationDeltaOverlay | null;
  hidden?: boolean;
};

export function EvaluationBar({
  evaluation,
  source,
  placeholder,
  delta,
  deltaOverlay,
  hidden = false,
}: EvaluationBarProps) {
  if (hidden) {
    return (
      <div className="eval-wrap eval-disabled eval-hidden" aria-label="Évaluation masquée">
        <div className="eval-bar-track">
          <div className="eval-bar-black" style={{ height: "50%" }} />
          <div
            className="eval-bar-cursor eval-bar-cursor-muted"
            style={{ top: "50%" }}
          />
          <div className="eval-bar-white" style={{ height: "50%" }} />
        </div>
        <div className="eval-label">
          <span>Évaluation masquée</span>
        </div>
      </div>
    );
  }

  if (!evaluation) {
    const sourceLabel = placeholder?.sourceLabel;
    const sourceTitle = placeholder?.sourceTitle ?? "evaluation non affichee";

    return (
      <div className="eval-wrap eval-placeholder" aria-label="Evaluation en attente">
        <div className="eval-bar-track">
          <div className="eval-bar-black" style={{ height: "50%" }} />
          <div
            className="eval-bar-cursor"
            style={{ top: "50%" }}
          />
          <div className="eval-bar-white" style={{ height: "50%" }} />
        </div>
        <div className="eval-label">
          <span>
            {placeholder?.label ?? "Analyse indisponible"}
            {sourceLabel && (
              <small className="eval-source" title={sourceTitle}>
                {sourceLabel}
              </small>
            )}
          </span>
        </div>
      </div>
    );
  }

  const sourceLabel = labelForSource(source?.kind);
  const sourceTitle = titleForSource(source?.kind);
  const sourceDetails = detailsForSource(source);
  const whitePercent = clampPercent(evaluation.white_percent);
  const blackPercent = clampPercent(100 - whitePercent);

  return (
    <div className="eval-wrap" aria-label="Evaluation">
      <div className="eval-bar-track">
        <div className="eval-bar-black" style={{ height: `${blackPercent}%` }} />
        {deltaOverlay && (
          <div
            className={`eval-delta-overlay eval-delta-overlay-${deltaOverlay.tone}`}
            style={{
              top: `${clampPercent(deltaOverlay.topPercent)}%`,
              height: `${Math.max(2, clampPercent(deltaOverlay.heightPercent))}%`,
            }}
            title={`Delta ${deltaOverlay.label}`}
          />
        )}
        <div className="eval-bar-cursor" style={{ top: `${blackPercent}%` }} />
        <div className="eval-bar-white" style={{ height: `${whitePercent}%` }} />
      </div>
      <div className="eval-label">
        <span>
          {evaluation.label}
          {sourceLabel && (
            <small className="eval-source" title={sourceTitle}>
              {sourceLabel}
            </small>
          )}
          {sourceDetails && (
            <small className="eval-source-details" title={sourceTitle}>
              {sourceDetails}
            </small>
          )}
        </span>
        {delta && (
          <span
            className={`eval-delta eval-delta-${delta.tone}`}
            title={delta.title}
          >
            {delta.label}
          </span>
        )}
      </div>
    </div>
  );
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 50;
  }
  return Math.max(0, Math.min(100, value));
}

function labelForSource(kind: string | undefined): string {
  if (kind === "shallow") {
    return "≈";
  }
  if (kind === "live") {
    return "live";
  }
  if (kind === "deep") {
    return "=";
  }
  if (kind === "calibration") {
    return "✓";
  }
  if (kind === "historical_deep") {
    return "hist. · deep";
  }
  if (kind === "historical_pending") {
    return "hist. · en cours";
  }
  if (kind === "review_deep") {
    return "review · deep";
  }
  if (kind === "review_deep_snapshot") {
    return "review snapshot";
  }
  if (kind === "historical_live") {
    return "historique · live";
  }
  if (kind === "review_saved") {
    return "review · saved";
  }
  if (kind === "review_stabilized_deep") {
    return "review stable";
  }
  if (kind === "review_live") {
    return "review · live";
  }
  if (kind === "final_live") {
    return "finale · live";
  }
  if (kind === "initial_live") {
    return "départ · live";
  }
  if (kind) {
    return "?";
  }
  return "";
}

function titleForSource(kind: string | undefined): string {
  if (kind === "shallow") {
    return "analyse rapide";
  }
  if (kind === "live") {
    return "analyse live";
  }
  if (kind === "deep") {
    return "analyse approfondie";
  }
  if (kind === "calibration") {
    return "calibration";
  }
  if (kind === "historical_deep") {
    return "analyse approfondie de la position historique";
  }
  if (kind === "historical_pending") {
    return "analyse historique en cours";
  }
  if (kind === "review_deep") {
    return "evaluation deep du moment de review";
  }
  if (kind === "review_deep_snapshot") {
    return "snapshot deep stable du moment de review";
  }
  if (kind === "historical_live") {
    return "analyse live de la position historique";
  }
  if (kind === "review_saved") {
    return "evaluation stockee du moment de review";
  }
  if (kind === "review_stabilized_deep") {
    return "snapshot deep stabilise du moment de review";
  }
  if (kind === "review_live") {
    return "analyse live du moment de review";
  }
  if (kind === "final_live") {
    return "analyse live de la position finale";
  }
  if (kind === "initial_live") {
    return "analyse live de la position initiale";
  }
  return "source d'analyse inconnue";
}

function detailsForSource(source: EvaluationSource | null): string {
  if (!source || !isLiveLikeSource(source.kind)) {
    return "";
  }
  const parts: string[] = ["Stockfish analyse tant que la position reste affichee"];
  if (source.depth !== null && source.depth !== undefined) {
    parts.push(`Depth ${source.depth}`);
  }
  const elapsedMs = source.elapsed_ms ?? source.time_ms;
  if (elapsedMs !== null && elapsedMs !== undefined) {
    parts.push(`${Math.max(0, Math.round(elapsedMs / 1000))}s`);
  }
  if (source.threads !== null && source.threads !== undefined) {
    parts.push(`Threads ${source.threads}`);
  }
  if (source.hash_mb !== null && source.hash_mb !== undefined) {
    parts.push(`Hash ${source.hash_mb} MB`);
  }
  if (source.analysis_limit_mode) {
    parts.push(source.analysis_limit_mode);
  }
  return parts.join(" · ");
}

function isLiveLikeSource(kind: string | undefined): boolean {
  return Boolean(kind && kind.includes("live"));
}
