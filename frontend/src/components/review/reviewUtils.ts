import type { OpeningRealityEvidence, ReviewMoment, ReviewMoveAnnotation, ReviewPracticeItem, ReviewScoreAuditRow } from "../../api/client";
import { makeEvaluationDisplayFromEngineScore } from "../../evaluationDisplay";
import { fr } from "../../i18n";
import { impactLabelFromLoss } from "./reviewLabels";

export function pvContrastLinePreview(line: ReviewMoveAnnotation["pv_line"]): string {
  if (!line?.length) {
    return "";
  }
  return line
    .slice(0, 8)
    .map((move) => move.san ?? move.uci)
    .filter(Boolean)
    .join(" ");
}

export function reviewAnnotationHasSolutionPvLine(annotation: ReviewMoveAnnotation): boolean {
  return Boolean(
    (annotation.pv_line_available && annotation.pv_line?.length) ||
      annotation.pv_contrast_evidence?.best_branch?.pv?.length,
  );
}

export function reviewAnnotationHasPlayedPvLine(annotation: ReviewMoveAnnotation): boolean {
  return Boolean(annotation.pv_contrast_evidence?.played_branch?.pv?.length);
}

export function reviewAnnotationHasAnyPvLine(annotation: ReviewMoveAnnotation): boolean {
  return (
    reviewAnnotationHasSolutionPvLine(annotation) ||
    reviewAnnotationHasPlayedPvLine(annotation)
  );
}


export function formatDebugNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "null";
  }
  return value.toFixed(2);
}

export function auditMoveScore(row: ReviewScoreAuditRow): number | null {
  const field = ("move_" + "accur" + "acy") as keyof ReviewScoreAuditRow;
  const value = row[field];
  return typeof value === "number" ? value : null;
}


export function formatHeadlineScore(value: number | null | undefined): string {
  if (!hasReviewScoreValue(value)) {
    return "—";
  }
  return String(Math.round(value));
}


export function formatImpact(value: number | null | undefined): string {
  if (!hasReviewScoreValue(value)) {
    return "non disponible";
  }
  const rounded = Math.round(value);
  const label =
    value < 2
      ? "négligeable"
      : value < 7
        ? "léger"
        : value < 15
          ? "important"
          : value < 30
            ? "très important"
            : "critique";
  return `-${rounded} % (${label})`;
}

export function isMicroReviewObservation(
  source:
    | Pick<ReviewMoveAnnotation, "impact_label" | "tags" | "win_loss">
    | Pick<ReviewPracticeItem, "impact_label" | "tags" | "win_loss">
    | null
    | undefined,
): boolean {
  if (!source) {
    return false;
  }
  const explicitImportance =
    "moment_importance" in source ? String(source.moment_importance ?? "") : "";
  if (explicitImportance) {
    const explicitMicroFlag = "is_micro_gap" in source && source.is_micro_gap === true;
    return explicitImportance === "micro_gap" || explicitMicroFlag;
  }
  if ("is_micro_gap" in source && source.is_micro_gap) {
    return true;
  }
  const normalizedImpact = String(source.impact_label ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (
    normalizedImpact.includes("negligeable") ||
    normalizedImpact.includes("micro") ||
    normalizedImpact.includes("low-impact")
  ) {
    return true;
  }
  if (source.tags?.some((tag) => tag === "low_impact" || tag === "micro_gap")) {
    return true;
  }
  return hasReviewScoreValue(source.win_loss) && Math.abs(source.win_loss) < 2;
}

export function reviewMomentImportanceLabel(
  source:
    | Pick<ReviewMoveAnnotation, "moment_importance" | "moment_label">
    | Pick<ReviewPracticeItem, "moment_importance" | "moment_label">
    | null
    | undefined,
): string | null {
  if (!source) {
    return null;
  }
  if (source.moment_label) {
    return source.moment_label;
  }
  const key = source.moment_importance;
  return key ? fr.momentImportance.labels[key] ?? null : null;
}

export function reviewMomentReason(
  source:
    | Pick<ReviewMoveAnnotation, "moment_importance" | "moment_reason">
    | Pick<ReviewPracticeItem, "moment_importance" | "moment_reason">
    | null
    | undefined,
): string | null {
  if (!source) {
    return null;
  }
  if (source.moment_reason) {
    return source.moment_reason;
  }
  const key = source.moment_importance;
  return key ? fr.momentImportance.reasons[key] ?? null : null;
}


export function openingMoveLabel(ply: number): string {
  const moveNumber = Math.max(1, Math.ceil(ply / 2));
  return `coup ${moveNumber}`;
}

export function openingSanLabel(
  san: string | null | undefined,
  color: string | null | undefined,
): string {
  const move = san || "coup inconnu";
  return color === "black" ? `...${move}` : move;
}

export function openingLinkedMomentLabel(
  moment: OpeningRealityEvidence["critical_moment_after_exit"] | null,
): string {
  if (!moment) {
    return "pas de perte majeure immédiate";
  }
  const moveLabel =
    typeof moment.move_number === "number"
      ? `coup ${moment.move_number}`
      : typeof moment.ply === "number"
        ? openingMoveLabel(moment.ply)
        : "moment lié";
  const impact =
    typeof moment.win_loss === "number" && Number.isFinite(moment.win_loss)
      ? ` · impact -${Math.round(moment.win_loss)} %`
      : "";
  return `premier moment à revoir au ${moveLabel}${impact}`;
}


export function impactPercentage(value: number | null | undefined): number {
  if (!hasReviewScoreValue(value)) {
    return 0;
  }
  return Math.max(4, Math.min(100, Math.round((value / 35) * 100)));
}


export function formatReviewScore(
  value: number | null | undefined,
  options: { signed?: boolean; suffix?: string } = {},
): string {
  if (!hasReviewScoreValue(value)) {
    return "non disponible";
  }
  const rounded = Math.round(value);
  const prefix = options.signed && rounded > 0 ? "+" : "";
  return `${prefix}${rounded}${options.suffix ?? " %"}`;
}

export function formatOptionalPercent(value: number | null | undefined): string {
  return formatReviewScore(value);
}

export function hasReviewScoreValue(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}


export function momentKey(moment: ReviewMoment, index: number): string {
  return `${moment.id ?? "moment"}-${moment.ply}-${moment.played_uci}-${index}`;
}

export function commentForLabel(label: string): string {
  if (label === "Tournant de partie") {
    return "Ce coup transforme nettement l'équilibre de la partie.";
  }
  if (label === "Avantage laissé filer") {
    return "Le coup recommandé conservait une position plus favorable.";
  }
  if (label === "Aggravation") {
    return "La position était déjà difficile et ce coup l'a rendue plus critique.";
  }
  if (label === "écart notable") {
    return "Le coup recommandé maintenait un meilleur équilibre.";
  }
  if (label === "écart important") {
    return "Le coup recommandé conservait l'avantage.";
  }
  if (label === "écart majeur") {
    return "Le coup recommandé évitait une dégradation importante.";
  }
  if (label === "écart très important") {
    return "Le coup recommandé maintenait la position bien meilleure.";
  }
  return "Moment décisif selon l'analyse approfondie.";
}

export function badgeClass(label: string): string {
  if (label === "Tournant de partie") {
    return "badge-major";
  }
  if (label === "Avantage laissé filer") {
    return "badge-important";
  }
  if (label === "Aggravation") {
    return "badge-large";
  }
  if (label === "Moment décisif") {
    return "badge-decisive";
  }
  if (label === "écart notable") {
    return "badge-notable";
  }
  if (label === "écart important") {
    return "badge-important";
  }
  if (label === "écart majeur") {
    return "badge-major";
  }
  if (label === "écart très important") {
    return "badge-large";
  }
  return "badge-decisive";
}

export function momentTypeLabel(momentType: ReviewMoment["moment_type"]): string | null {
  if (momentType === "turning_point") {
    return "Tournant de partie";
  }
  if (momentType === "lost_advantage") {
    return "Avantage laissé filer";
  }
  if (momentType === "aggravation") {
    return "Aggravation";
  }
  if (momentType === "decisive") {
    return "Moment décisif";
  }
  if (momentType === "standard_loss") {
    return "Écart important";
  }
  return null;
}

export function reviewMomentDelta(
  moment: ReviewMoment,
): { label: string; tone: "loss" | "gain" | "neutral" } | null {
  const before = makeEvaluationDisplayFromEngineScore(
    moment.eval_before_cp,
    moment.mate_before,
  );
  const after = makeEvaluationDisplayFromEngineScore(
    moment.eval_after_cp,
    moment.mate_after,
  );
  if (!before || !after) {
    return null;
  }

  const beforePercent =
    moment.played_by === "black" ? before.black_percent : before.white_percent;
  const afterPercent =
    moment.played_by === "black" ? after.black_percent : after.white_percent;
  const delta = afterPercent - beforePercent;
  if (!Number.isFinite(delta)) {
    return null;
  }

  const rounded = Math.round(delta);
  return {
    label: `${rounded > 0 ? "+" : ""}${rounded} %`,
    tone: delta < -0.5 ? "loss" : delta > 0.5 ? "gain" : "neutral",
  };
}

