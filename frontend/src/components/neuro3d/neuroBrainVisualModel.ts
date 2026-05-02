import {
  BRAIN_DOMAIN_ORDER,
  demoNeuroMonitorBrainData,
  type BrainDomainKey,
  type BrainDomainMetric,
  type BrainDomainVisual,
  type NeuroMonitorBrainData,
} from "./neuroBrainTypes";
import type { OpeningRealityEvidence, ReviewMoveAnnotation, ReviewResponse } from "../../api/client";

const DOMAIN_POSITIONS: Record<BrainDomainKey, BrainDomainVisual["position"]> = {
  opening: { x: 158, y: 126, rx: 78, ry: 58, rotate: -18 },
  tactical: { x: 286, y: 94, rx: 86, ry: 64, rotate: 12 },
  plan: { x: 385, y: 164, rx: 92, ry: 70, rotate: -6 },
  conversion: { x: 486, y: 118, rx: 82, ry: 58, rotate: 18 },
  defense: { x: 288, y: 244, rx: 104, ry: 58, rotate: 2 },
};

const DOMAIN_FALLBACK_LABELS: Record<BrainDomainKey, string> = {
  opening: "Ouverture",
  tactical: "Tactique",
  plan: "Plan (exploratoire)",
  conversion: "Conversion",
  defense: "Défense",
};

export function normalizeBrainData(
  data: NeuroMonitorBrainData | null | undefined,
): NeuroMonitorBrainData {
  const source = data ?? demoNeuroMonitorBrainData;
  const byKey = new Map(source.domains.map((domain) => [domain.key, domain]));
  const domains = BRAIN_DOMAIN_ORDER.map((key) =>
    normalizeDomainMetric(byKey.get(key), key),
  );
  return {
    ...source,
    overallScore: clampScore(source.overallScore),
    overallLabel: source.overallLabel ?? "NeuroChess",
    summary: source.summary ?? "Carte cognitive de démonstration.",
    domains,
  };
}

export function buildBrainDomainVisuals(data: NeuroMonitorBrainData): BrainDomainVisual[] {
  return BRAIN_DOMAIN_ORDER.map((key) => {
    const domain = data.domains.find((candidate) => candidate.key === key);
    const normalized = normalizeDomainMetric(domain, key);
    return {
      ...normalized,
      color: scoreToColor(normalized.score),
      fill: scoreToFill(normalized.score),
      glow: scoreToGlow(normalized.score),
      pulse: scoreToPulse(normalized.score),
      activity: scoreToActivity(normalized.score),
      status: normalized.statusLabel ?? scoreToStatus(normalized.score),
      position: DOMAIN_POSITIONS[key],
    };
  });
}

export function scoreToColor(score: number): string {
  const value = clampScore(score);
  if (value <= 20) {
    return "#ff3d66";
  }
  if (value <= 40) {
    return "#ff9f43";
  }
  if (value <= 60) {
    return "#f6d65b";
  }
  if (value <= 80) {
    return "#35f2a2";
  }
  return "#33d6ff";
}

export function scoreToStatus(score: number): string {
  const value = clampScore(score);
  if (value <= 20) {
    return "Critique";
  }
  if (value <= 40) {
    return "Prioritaire";
  }
  if (value <= 60) {
    return "Fragile";
  }
  if (value <= 80) {
    return "Stable";
  }
  return "Solide";
}

export function scoreToGlow(score: number): string {
  const value = clampScore(score);
  const intensity = value <= 40 ? 0.72 : value <= 60 ? 0.58 : 0.48;
  return `0 0 ${Math.round(16 + (100 - value) * 0.28)}px rgba(${scoreToRgb(
    value,
  )}, ${intensity})`;
}

export function scoreToPulse(score: number): number {
  const value = clampScore(score);
  if (value <= 20) {
    return 1.8;
  }
  if (value <= 40) {
    return 2.4;
  }
  if (value <= 60) {
    return 3.2;
  }
  if (value <= 80) {
    return 4.4;
  }
  return 5.4;
}

export function scoreToActivity(score: number): number {
  const value = clampScore(score);
  return Number((0.18 + (100 - value) / 100 * 0.72).toFixed(2));
}

export function clampScore(score: number | null | undefined): number {
  const value = Number(score ?? 0);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildNeuroMonitorBrainData(
  review: ReviewResponse | null | undefined,
  selectedAnnotation: ReviewMoveAnnotation | null,
  reviewFocusKey: string,
): NeuroMonitorBrainData | null {
  if (!review) {
    return null;
  }

  const annotations = reviewAnnotations(review, selectedAnnotation);
  const openingDomain = buildOpeningDomain(review.opening_reality_evidence ?? null);
  const domainStats: Record<BrainDomainKey, DomainBuildResult> = {
    opening: openingDomain,
    tactical: buildAnnotationDomain("tactical", annotations),
    plan: buildPlanDomain(),
    conversion: buildAnnotationDomain("conversion", annotations),
    defense: buildAnnotationDomain("defense", annotations),
  };
  const hasSignals =
    annotations.length > 0 || Boolean(review.opening_reality_evidence?.available);
  const priorityDomain =
    dominantThemeToDomain(extractDominantTheme(review)) ??
    weakestDomain(domainStats, hasSignals) ??
    "tactical";

  const domains = BRAIN_DOMAIN_ORDER.map((key) => ({
    ...domainStats[key].metric,
    priority: key === priorityDomain,
  }));

  return {
    overallScore: reviewOverallScore(review),
    overallLabel: "NeuroScore",
    summary: summaryForPriority(priorityDomain, domainStats[priorityDomain].metric.score),
    priorityDomain,
    recommendedExerciseLabel: recommendedExerciseLabel(priorityDomain),
    domains,
  };
}

export function findNeuroMonitorAnnotationForDomain(
  review: ReviewResponse | null | undefined,
  domain: BrainDomainKey,
  selectedAnnotation?: ReviewMoveAnnotation | null,
): ReviewMoveAnnotation | null {
  if (!review || domain === "opening") {
    return null;
  }
  if (selectedAnnotation && annotationMatchesBrainDomain(selectedAnnotation, domain)) {
    return selectedAnnotation;
  }
  return reviewAnnotations(review, null)
    .filter((annotation) => annotationMatchesBrainDomain(annotation, domain))
    .sort(compareAnnotationPriority)[0] ?? null;
}

function normalizeDomainMetric(
  metric: BrainDomainMetric | undefined,
  key: BrainDomainKey,
): BrainDomainMetric {
  const score = clampScore(metric?.score ?? 50);
  return {
    key,
    label: metric?.label ?? DOMAIN_FALLBACK_LABELS[key],
    score,
    statusLabel: metric?.statusLabel ?? scoreToStatus(score),
    summary: metric?.summary ?? "Signal de démonstration.",
    priority: Boolean(metric?.priority),
  };
}

type DomainBuildResult = {
  metric: BrainDomainMetric;
  totalLoss: number;
};

function reviewAnnotations(
  review: ReviewResponse,
  selectedAnnotation: ReviewMoveAnnotation | null,
): ReviewMoveAnnotation[] {
  const source = review.review_sections?.all ?? review.move_annotations ?? [];
  if (!selectedAnnotation) {
    return source;
  }
  const exists = source.some(
    (annotation) =>
      annotation.ply === selectedAnnotation.ply &&
      annotation.uci === selectedAnnotation.uci,
  );
  return exists ? source : [selectedAnnotation, ...source];
}

function buildOpeningDomain(evidence: OpeningRealityEvidence | null): DomainBuildResult {
  if (!evidence) {
    return {
      metric: {
        key: "opening",
        label: "Ouverture",
        score: 50,
        statusLabel: "À préciser",
        summary: "Données d'ouverture insuffisantes.",
      },
      totalLoss: 0,
    };
  }
  if (evidence.status === "not_applicable_from_position") {
    return {
      metric: {
        key: "opening",
        label: "Ouverture",
        score: 50,
        statusLabel: "Non applicable",
        summary: "Position initiale spéciale.",
      },
      totalLoss: 0,
    };
  }
  const linkedMoment = evidence.critical_moment_after_exit ?? null;
  if (linkedMoment) {
    const loss = positiveNumber(linkedMoment.win_loss);
    const score = clampScore(40 - Math.min(34, loss * 0.9));
    return {
      metric: {
        key: "opening",
        label: "Ouverture",
        score,
        statusLabel: scoreToStatus(score),
        summary: "La sortie d'ouverture est associée à un moment critique.",
      },
      totalLoss: loss,
    };
  }
  const exitPly = evidence.exit_ply ?? evidence.out_of_book_ply ?? null;
  if (typeof exitPly === "number") {
    return {
      metric: {
        key: "opening",
        label: "Ouverture",
        score: 70,
        statusLabel: "Stable",
        summary: `Sortie d'ouverture au coup ${Math.ceil(exitPly / 2)} sans alerte immédiate.`,
      },
      totalLoss: 0,
    };
  }
  return {
    metric: {
      key: "opening",
      label: "Ouverture",
      score: evidence.available ? 68 : 50,
      statusLabel: evidence.available ? "Stable" : "À préciser",
      summary: evidence.summary ?? "Diagnostic d'ouverture léger.",
    },
    totalLoss: 0,
  };
}

function buildAnnotationDomain(
  domain: Exclude<BrainDomainKey, "opening">,
  annotations: ReviewMoveAnnotation[],
): DomainBuildResult {
  const matches = annotations.filter((annotation) =>
    annotationMatchesBrainDomain(annotation, domain),
  );
  const penalty = matches.reduce(
    (sum, annotation) => sum + weightedAnnotationPenalty(annotation, domain),
    0,
  );
  const totalLoss = matches.reduce(
    (sum, annotation) => sum + positiveNumber(annotation.win_loss),
    0,
  );
  const score = clampScore(82 - penalty);
  return {
    metric: {
      key: domain,
      label: domainLabel(domain),
      score,
      statusLabel: scoreToStatus(score),
      summary: domainSummary(domain, matches.length, totalLoss),
    },
    totalLoss,
  };
}

function buildPlanDomain(): DomainBuildResult {
  return {
    metric: {
      key: "plan",
      label: "Plan (exploratoire)",
      score: 50,
      statusLabel: "Profil en construction",
      summary: "Signal de plan non calibré en V1.",
    },
    totalLoss: 0,
  };
}

function annotationMatchesBrainDomain(
  annotation: ReviewMoveAnnotation,
  domain: BrainDomainKey,
): boolean {
  const tags = new Set(annotation.tags ?? []);
  const errorType = annotation.pedagogical_explanation?.error_type ?? "";
  const primary = String(annotation.primary_category ?? "").toLowerCase();
  const category = String(annotation.category_label ?? "").toLowerCase();
  const before =
    annotation.player_win_percent_before ?? annotation.player_percent_before ?? null;
  if (domain === "tactical") {
    return (
      errorType === "tactical" ||
      tags.has("missed_opportunity") ||
      ((primary === "critical" || primary === "decisive") &&
        (tags.has("tactical") || category.includes("tact")))
    );
  }
  if (domain === "conversion") {
    return (
      errorType === "conversion" ||
      tags.has("conversion_issue") ||
      (Number(before ?? 0) >= 75 && positiveNumber(annotation.win_loss) >= 10)
    );
  }
  if (domain === "defense") {
    return (
      errorType === "defensive" ||
      tags.has("defensive_resource_missed") ||
      (Number(before ?? 100) <= 35 &&
        (positiveNumber(annotation.missed_gain) >= 8 ||
          positiveNumber(annotation.win_loss) >= 8))
    );
  }
  if (domain === "plan") {
    return (
      errorType === "positional" ||
      primary === "plan" ||
      primary === "positional" ||
      category.includes("plan") ||
      category.includes("position") ||
      (tags.has("persistent_loss") &&
        !annotationMatchesBrainDomain(annotation, "tactical") &&
        !annotationMatchesBrainDomain(annotation, "conversion"))
    );
  }
  return false;
}

function weightedAnnotationPenalty(
  annotation: ReviewMoveAnnotation,
  domain: Exclude<BrainDomainKey, "opening">,
): number {
  const loss = positiveNumber(annotation.win_loss);
  const missedGain = positiveNumber(annotation.missed_gain);
  const criticality = positiveNumber(annotation.criticality_score);
  const domainWeight =
    domain === "tactical" ? 1.3 : domain === "conversion" ? 1.12 : 1.0;
  const categoryBonus =
    annotation.primary_category === "critical" || annotation.primary_category === "decisive"
      ? 6
      : 0;
  return Math.min(
    48,
    5 + loss * domainWeight + missedGain * 0.35 + criticality * 0.05 + categoryBonus,
  );
}

function weakestDomain(
  domainStats: Record<BrainDomainKey, DomainBuildResult>,
  hasSignals: boolean,
): BrainDomainKey | null {
  if (!hasSignals) {
    return "tactical";
  }
  return BRAIN_DOMAIN_ORDER.filter((key) => key !== "plan").sort((left, right) => {
    const leftMetric = domainStats[left];
    const rightMetric = domainStats[right];
    if (leftMetric.metric.score !== rightMetric.metric.score) {
      return leftMetric.metric.score - rightMetric.metric.score;
    }
    return rightMetric.totalLoss - leftMetric.totalLoss;
  })[0] ?? null;
}

function reviewOverallScore(review: ReviewResponse): number {
  const score =
    review.user_coach_neuro_score ??
    review.coach_neuro_score ??
    review.user_headline_neurochess_score ??
    review.headline_neurochess_score ??
    averageNullable(review.white_coach_neuro_score, review.black_coach_neuro_score) ??
    averageNullable(review.white_headline_neurochess_score, review.black_headline_neurochess_score) ??
    review.user_public_neuro_score ??
    review.public_neuro_score ??
    review.user_lichess_like_accuracy ??
    review.user_review_score ??
    averageNullable(review.white_public_neuro_score, review.black_public_neuro_score) ??
    averageNullable(review.white_lichess_like_accuracy, review.black_lichess_like_accuracy) ??
    averageNullable(review.white_review_score, review.black_review_score) ??
    50;
  return clampScore(score);
}

function averageNullable(
  left: number | null | undefined,
  right: number | null | undefined,
): number | null {
  const values = [left, right].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function dominantThemeToDomain(theme: string | null): BrainDomainKey | null {
  const value = String(theme ?? "").toLowerCase();
  if (!value) {
    return null;
  }
  if (value.includes("opening")) {
    return "opening";
  }
  if (value.includes("tactic") || value.includes("missed")) {
    return "tactical";
  }
  if (value.includes("conversion")) {
    return "conversion";
  }
  if (value.includes("defen")) {
    return "defense";
  }
  return null;
}

function extractDominantTheme(review: ReviewResponse): string | null {
  const dynamicReview = review as unknown as Record<string, unknown>;
  const direct = dynamicReview.dominant_theme;
  if (typeof direct === "string") {
    return direct;
  }
  for (const key of ["practice_summary", "latest_practice_summary", "practiceSummary"]) {
    const value = dynamicReview[key];
    if (value && typeof value === "object") {
      const theme = (value as Record<string, unknown>).dominant_theme;
      if (typeof theme === "string") {
        return theme;
      }
    }
  }
  return null;
}

function recommendedExerciseLabel(domain: BrainDomainKey): string {
  switch (domain) {
    case "opening":
      return "1 sortie d'ouverture";
    case "plan":
      return "profil en construction";
    case "conversion":
      return "2 positions de conversion";
    case "defense":
      return "2 ressources défensives";
    case "tactical":
    default:
      return "3 positions tactiques";
  }
}

function summaryForPriority(domain: BrainDomainKey, score: number): string {
  if (score > 60) {
    return "La partie est globalement stable.";
  }
  switch (domain) {
    case "opening":
      return "La sortie d'ouverture mérite un repère plus clair.";
    case "conversion":
      return "La conversion des positions favorables a coûté cher.";
    case "defense":
      return "Les ressources défensives sont un axe prioritaire.";
    case "plan":
      return "Le profil de plan reste exploratoire.";
    case "tactical":
    default:
      return "Plusieurs opportunités tactiques ont été manquées.";
  }
}

function domainLabel(domain: Exclude<BrainDomainKey, "opening">): string {
  switch (domain) {
    case "tactical":
      return "Tactique";
    case "plan":
      return "Plan (exploratoire)";
    case "conversion":
      return "Conversion";
    case "defense":
      return "Défense";
  }
}

function domainSummary(
  domain: Exclude<BrainDomainKey, "opening">,
  count: number,
  totalLoss: number,
): string {
  if (count <= 0) {
    return "Aucune alerte majeure détectée.";
  }
  const lossLabel = totalLoss >= 20 ? "impact fort" : "impact modéré";
  switch (domain) {
    case "tactical":
      return `${count} opportunité${count > 1 ? "s" : ""} tactique${count > 1 ? "s" : ""} à revoir, ${lossLabel}.`;
    case "plan":
      return `${count} moment${count > 1 ? "s" : ""} de plan à clarifier, ${lossLabel}.`;
    case "conversion":
      return `${count} conversion${count > 1 ? "s" : ""} fragile${count > 1 ? "s" : ""}, ${lossLabel}.`;
    case "defense":
      return `${count} ressource${count > 1 ? "s" : ""} défensive${count > 1 ? "s" : ""} manquée${count > 1 ? "s" : ""}, ${lossLabel}.`;
  }
}

function compareAnnotationPriority(
  left: ReviewMoveAnnotation,
  right: ReviewMoveAnnotation,
): number {
  const leftRank = left.coach_priority_rank ?? 999;
  const rightRank = right.coach_priority_rank ?? 999;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  return positiveNumber(right.win_loss) - positiveNumber(left.win_loss);
}

function positiveNumber(value: number | null | undefined): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
}

function scoreToFill(score: number): string {
  const value = clampScore(score);
  return `rgba(${scoreToRgb(value)}, ${value <= 40 ? 0.3 : 0.2})`;
}

function scoreToRgb(score: number): string {
  const color = scoreToColor(score).replace("#", "");
  const r = Number.parseInt(color.slice(0, 2), 16);
  const g = Number.parseInt(color.slice(2, 4), 16);
  const b = Number.parseInt(color.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
