import type { OpeningRealityEvidence, ReviewMoveAnnotation, ReviewPracticeItem, ReviewPracticeSummary, ReviewResponse, ReviewSections } from "../../api/client";
import { buildPovOptions, openingRealityConfidenceLabel, reviewColorLabel, reviewScoreConfidenceLabel } from "./reviewLabels";
import {
  formatHeadlineScore,
  formatImpact,
  hasReviewScoreValue,
  openingLinkedMomentLabel,
  openingMoveLabel,
  pvContrastLinePreview,
  reviewAnnotationHasAnyPvLine,
  reviewAnnotationHasPlayedPvLine,
  reviewAnnotationHasSolutionPvLine,
} from "./reviewUtils";
import type {
  GameStoryEvent,
  OpeningRealityView,
  ReviewCockpitIndicator,
  ReviewLessonStep,
  ReviewLessonStepState,
  ReviewLineComparisonView,
  ReviewPov,
  ReviewPovContext,
  ReviewPovTargetColor,
  ReviewPracticeSummaryView,
  ReviewPublicLessonStep,
  ReviewScoreMetricView,
  ReviewSectionKey,
  ReviewSolutionRevealViewState,
  ReviewTryMoveViewState,
} from "./reviewTypes";

export function reviewIsCompleted(review: ReviewResponse | null): boolean {
  const requiredPositions = review?.required_position_count ?? 0;
  const completedPositions =
    review?.completed_position_count ?? review?.deep_done_count ?? 0;
  return (
    review?.status === "done" &&
    (requiredPositions <= 0 || completedPositions >= requiredPositions) &&
    review.review_analysis_state !== "partial" &&
    review.review_analysis_state !== "incomplete"
  );
}


export function reviewPovContext(
  review: ReviewResponse | null,
  selectedPov: ReviewPov,
): ReviewPovContext {
  const userColor = normalizedReviewUserColor(review);
  const options: Array<{ value: ReviewPov; label: string }> = userColor
    ? [
        { value: "user", label: "Moi" },
        { value: "white", label: "Blancs" },
        { value: "black", label: "Noirs" },
        { value: "both", label: "Les deux" },
      ]
    : [
        { value: "white", label: "Blancs" },
        { value: "black", label: "Noirs" },
        { value: "both", label: "Les deux" },
      ];
  const normalizedPov =
    selectedPov === "user" && !userColor ? "white" : selectedPov;
  const targetColor =
    normalizedPov === "user"
      ? userColor ?? "both"
      : normalizedPov === "white" || normalizedPov === "black"
        ? normalizedPov
        : "both";
  return {
    selectedPov: normalizedPov,
    userColor,
    targetColor,
    isUserPov: normalizedPov === "user" && Boolean(userColor),
    options,
  };
}

export function normalizedReviewUserColor(
  review: ReviewResponse | null,
): "white" | "black" | null {
  const value = String(review?.user_color ?? "").toLowerCase();
  return value === "white" || value === "black" ? value : null;
}

export function filteredReviewSections(
  review: ReviewResponse | null,
  targetColor: ReviewPovTargetColor,
): ReviewSections {
  const empty: ReviewSections = {
    to_review: [],
    strong_moves: [],
    missed_opportunities: [],
    all: [],
  };
  if (!review?.review_sections) {
    return empty;
  }
  if (targetColor === "both") {
    return {
      to_review: review.review_sections.to_review ?? [],
      strong_moves: review.review_sections.strong_moves ?? [],
      missed_opportunities: review.review_sections.missed_opportunities ?? [],
      all: review.review_sections.all ?? review.move_annotations ?? [],
    };
  }
  return {
    to_review: filterAnnotationsByColor(review.review_sections.to_review, targetColor),
    strong_moves: filterAnnotationsByColor(review.review_sections.strong_moves, targetColor),
    missed_opportunities: filterAnnotationsByColor(
      review.review_sections.missed_opportunities,
      targetColor,
    ),
    all: filterAnnotationsByColor(
      review.review_sections.all ?? review.move_annotations,
      targetColor,
    ),
  };
}

export function filterAnnotationsByColor(
  annotations: ReviewMoveAnnotation[] | undefined,
  color: "white" | "black",
): ReviewMoveAnnotation[] {
  return (annotations ?? []).filter(
    (annotation) => normalizedAnnotationColor(annotation) === color,
  );
}

export function normalizedAnnotationColor(
  annotation: ReviewMoveAnnotation,
): "white" | "black" | null {
  const value = String(annotation.color ?? annotation.side ?? "").toLowerCase();
  return value === "white" || value === "black" ? value : null;
}

export function countPracticeEligibleItems(sections: ReviewSections): number {
  const seen = new Set<number>();
  for (const annotation of sections.all ?? []) {
    if (isPracticeEligibleAnnotation(annotation)) {
      seen.add(annotation.ply);
    }
  }
  return seen.size;
}

export function reviewCockpitPriorities(sections: ReviewSections): ReviewMoveAnnotation[] {
  const source = sections.to_review.length
    ? sections.to_review
    : sections.missed_opportunities.length
      ? sections.missed_opportunities
      : sections.all;
  return source
    .slice()
    .sort((left, right) => {
      const leftRank = left.coach_priority_rank ?? 999;
      const rightRank = right.coach_priority_rank ?? 999;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return Number(right.win_loss ?? 0) - Number(left.win_loss ?? 0);
    })
    .slice(0, 3);
}

export function reviewCockpitIndicators(
  review: ReviewResponse,
  sections: ReviewSections,
): ReviewCockpitIndicator[] {
  const annotations = sections.all ?? [];
  return [
    reviewCockpitOpeningIndicator(review),
    reviewCockpitCountIndicator({
      key: "tactical",
      label: "Tactique",
      count: annotations.filter(isTacticalCockpitMoment).length,
      maxLoss: maxAnnotationLoss(annotations.filter(isTacticalCockpitMoment)),
      fragileLabel: "Fragile",
      detailZero: "aucune alerte tactique majeure",
      detailOne: "1 alerte tactique",
      detailMany: "alertes tactiques",
      criticalAt: 3,
    }),
    reviewCockpitCountIndicator({
      key: "conversion",
      label: "Conversion",
      count: annotations.filter(isConversionCockpitMoment).length,
      maxLoss: maxAnnotationLoss(annotations.filter(isConversionCockpitMoment)),
      fragileLabel: "Fragile",
      detailZero: "positions favorables bien tenues",
      detailOne: "1 conversion à revoir",
      detailMany: "conversions à revoir",
      criticalAt: 2,
    }),
    reviewCockpitCountIndicator({
      key: "defense",
      label: "Défense",
      count: annotations.filter(isDefenseCockpitMoment).length,
      maxLoss: maxAnnotationLoss(annotations.filter(isDefenseCockpitMoment)),
      fragileLabel: "Fragile",
      detailZero: "ressources défensives globalement trouvées",
      detailOne: "1 ressource défensive manquée",
      detailMany: "ressources défensives manquées",
      criticalAt: 2,
    }),
  ];
}

export function reviewCockpitOpeningIndicator(review: ReviewResponse): ReviewCockpitIndicator {
  const evidence = review.opening_reality_evidence;
  if (!evidence) {
    return {
      key: "opening",
      label: "Ouverture",
      statusLabel: "Inconnue",
      detail: "aucune donnée d'ouverture dans ce payload",
      tone: "unknown",
    };
  }
  if (evidence.status === "not_applicable_from_position") {
    return {
      key: "opening",
      label: "Ouverture",
      statusLabel: "Non applicable",
      detail: "position initiale spéciale",
      tone: "neutral",
    };
  }
  const linkedMoment = evidence.critical_moment_after_exit ?? null;
  if (linkedMoment) {
    const loss = Number(linkedMoment.win_loss ?? 0);
    return {
      key: "opening",
      label: "Ouverture",
      statusLabel: loss >= 12 ? "Fragile" : "À surveiller",
      detail: openingLinkedMomentLabel(linkedMoment),
      tone: loss >= 12 ? "fragile" : "watch",
    };
  }
  const exitPly = evidence.exit_ply ?? evidence.out_of_book_ply ?? null;
  if (typeof exitPly === "number") {
    return {
      key: "opening",
      label: "Ouverture",
      statusLabel: "Stable",
      detail: `sortie au ${openingMoveLabel(exitPly)}`,
      tone: "good",
    };
  }
  if (evidence.available) {
    return {
      key: "opening",
      label: "Ouverture",
      statusLabel: "Stable",
      detail: evidence.opening_name ?? "diagnostic disponible",
      tone: "good",
    };
  }
  return {
    key: "opening",
    label: "Ouverture",
    statusLabel: "Inconnue",
    detail: evidence.summary ?? "données insuffisantes",
    tone: "unknown",
  };
}

export function reviewCockpitCountIndicator({
  key,
  label,
  count,
  maxLoss,
  fragileLabel,
  detailZero,
  detailOne,
  detailMany,
  criticalAt,
}: {
  key: "tactical" | "conversion" | "defense";
  label: string;
  count: number;
  maxLoss: number;
  fragileLabel: string;
  detailZero: string;
  detailOne: string;
  detailMany: string;
  criticalAt: number;
}): ReviewCockpitIndicator {
  if (count <= 0) {
    return {
      key,
      label,
      statusLabel: "Bonne",
      detail: detailZero,
      tone: "good",
    };
  }
  const critical = count >= criticalAt || maxLoss >= 25;
  return {
    key,
    label,
    statusLabel: critical ? "Critique" : fragileLabel,
    detail: count === 1 ? detailOne : `${count} ${detailMany}`,
    tone: critical ? "critical" : "fragile",
  };
}

export function isTacticalCockpitMoment(annotation: ReviewMoveAnnotation): boolean {
  const tags = new Set(annotation.tags ?? []);
  return (
    annotation.pedagogical_explanation?.error_type === "tactical" ||
    tags.has("missed_opportunity") ||
    annotation.primary_category === "critical" ||
    annotation.primary_category === "decisive"
  );
}

export function isConversionCockpitMoment(annotation: ReviewMoveAnnotation): boolean {
  const tags = new Set(annotation.tags ?? []);
  const playerBefore =
    annotation.player_win_percent_before ?? annotation.player_percent_before ?? null;
  return (
    annotation.pedagogical_explanation?.error_type === "conversion" ||
    tags.has("conversion_issue") ||
    (Number(playerBefore ?? 0) >= 75 && Number(annotation.win_loss ?? 0) >= 10)
  );
}

export function isDefenseCockpitMoment(annotation: ReviewMoveAnnotation): boolean {
  const tags = new Set(annotation.tags ?? []);
  const playerBefore =
    annotation.player_win_percent_before ?? annotation.player_percent_before ?? null;
  return (
    annotation.pedagogical_explanation?.error_type === "defensive" ||
    tags.has("defensive_resource_missed") ||
    (Number(playerBefore ?? 100) <= 35 &&
      (Number(annotation.missed_gain ?? 0) >= 8 || Number(annotation.win_loss ?? 0) >= 8))
  );
}

export function maxAnnotationLoss(annotations: ReviewMoveAnnotation[]): number {
  return annotations.reduce(
    (maxLoss, annotation) => Math.max(maxLoss, Number(annotation.win_loss ?? 0)),
    0,
  );
}

export function reviewCockpitTakeaways(
  indicators: ReviewCockpitIndicator[],
  review: ReviewResponse,
  sections: ReviewSections,
): string[] {
  const byKey = new Map(indicators.map((indicator) => [indicator.key, indicator]));
  const takeaways: string[] = [];
  const tactical = byKey.get("tactical");
  const conversion = byKey.get("conversion");
  const defense = byKey.get("defense");
  const opening = byKey.get("opening");
  if (indicatorIsAlert(tactical)) {
    takeaways.push("Plusieurs opportunités tactiques ont été manquées.");
  }
  if (indicatorIsAlert(conversion)) {
    takeaways.push("La conversion des positions favorables a coûté cher.");
  }
  if (indicatorIsAlert(defense)) {
    takeaways.push("Les ressources défensives sont un axe de travail prioritaire.");
  }
  if (opening && ["watch", "fragile", "critical"].includes(opening.tone)) {
    takeaways.push("La sortie d'ouverture mérite un repère plus clair.");
  }
  if (takeaways.length === 0) {
    takeaways.push("Peu de problèmes majeurs détectés.");
  }
  if (sections.to_review.length > 0 && takeaways.length < 3) {
    takeaways.push("Le travail prioritaire : réessayer les positions critiques de cette partie.");
  }
  if (takeaways.length < 3) {
    takeaways.push(reviewSummaryForPov(review, reviewPovContext(review, "both"), filteredReviewSections(review, "both")));
  }
  return takeaways.slice(0, 3);
}

export function indicatorIsAlert(indicator: ReviewCockpitIndicator | undefined): boolean {
  return Boolean(
    indicator && ["watch", "fragile", "critical"].includes(indicator.tone),
  );
}

export function gameStoryTimeline(
  review: ReviewResponse,
  sections: ReviewSections,
): GameStoryEvent[] {
  const events: GameStoryEvent[] = [];
  const seen = new Set<string>();
  const evidence = review.opening_reality_evidence ?? null;

  function add(event: GameStoryEvent) {
    if (seen.has(event.id)) {
      return;
    }
    seen.add(event.id);
    events.push(event);
  }

  if (evidence?.opening_name || evidence?.eco || evidence?.available) {
    add({
      id: "opening-detected",
      label: "Ouverture",
      moveLabel: shortCockpitText(evidence.eco ?? evidence.opening_name ?? "détectée", 18),
      impactLabel: evidence.confidence ? openingRealityConfidenceLabel(evidence.confidence) : "info",
      tone: "info",
      focus: "lab",
    });
  }

  const exitPly = evidence?.exit_ply ?? evidence?.out_of_book_ply ?? null;
  if (typeof exitPly === "number") {
    add({
      id: "opening-exit",
      label: "Sortie",
      moveLabel: openingMoveLabel(exitPly),
      impactLabel: "hors livre",
      tone: evidence?.critical_moment_after_exit ? "warning" : "info",
      focus: "lab",
      openingEvidence: evidence ?? undefined,
      showOpeningExit: Boolean(evidence?.fen_before_exit ?? evidence?.out_of_book_fen),
    });
  }

  const firstPriority = sections.to_review[0] ?? null;
  if (firstPriority) {
    add(gameStoryEventFromAnnotation("first-priority", "Moment #1", firstPriority));
  }

  const turningPoint = sections.all
    .slice()
    .sort((left, right) => Number(right.win_loss ?? 0) - Number(left.win_loss ?? 0))[0];
  if (turningPoint) {
    add(gameStoryEventFromAnnotation("turning-point", "Tournant", turningPoint));
  }

  const conversionMoment = sections.all.find(isConversionCockpitMoment);
  if (conversionMoment) {
    add(gameStoryEventFromAnnotation("conversion", "Conversion", conversionMoment));
  }

  const strongMove = sections.strong_moves[0] ?? null;
  if (strongMove) {
    add(gameStoryEventFromAnnotation("strong-move", "Coup fort", strongMove, "positive"));
  }

  add({
    id: "game-end",
    label: "Fin",
    moveLabel: "bilan",
    impactLabel: comparisonLabelForPov(review, reviewPovContext(review, "both")),
    tone: "neutral",
    focus: "summary",
  });

  return events.slice(0, 6);
}

export function gameStoryEventFromAnnotation(
  id: string,
  label: string,
  annotation: ReviewMoveAnnotation,
  forcedTone?: GameStoryEvent["tone"],
): GameStoryEvent {
  return {
    id: `${id}-${annotation.ply}`,
    label,
    moveLabel: `Coup ${annotation.move_number}`,
    impactLabel: formatImpact(annotation.win_loss),
    tone:
      forcedTone ??
      (Number(annotation.win_loss ?? 0) >= 15
        ? "critical"
        : Number(annotation.win_loss ?? 0) >= 7
          ? "warning"
          : "neutral"),
    focus: "learn",
    annotation,
  };
}

export function shortCockpitText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export function isPracticeEligibleAnnotation(annotation: ReviewMoveAnnotation): boolean {
  const tags = new Set(annotation.tags ?? []);
  return (
    Boolean(annotation.try_move_supported) &&
    Boolean(annotation.fen_before) &&
    Boolean(annotation.best_move_uci) &&
    (["critical", "decisive", "to_review", "inexact"].includes(
      annotation.primary_category,
    ) ||
      tags.has("missed_opportunity") ||
      tags.has("conversion_issue") ||
      tags.has("defensive_resource_missed") ||
      tags.has("persistent_loss") ||
      tags.has("cluster"))
  );
}

export function practiceHintForItem(item: ReviewPracticeItem): string {
  const errorType = item.pedagogical_explanation?.error_type;
  const tags = new Set(item.tags ?? []);
  if (errorType === "tactical" || tags.has("missed_opportunity")) {
    return "cherche une ressource tactique.";
  }
  if (errorType === "conversion" || tags.has("conversion_issue")) {
    return "cherche un coup qui limite le contre-jeu.";
  }
  if (errorType === "defensive" || tags.has("defensive_resource_missed")) {
    return "cherche une ressource défensive.";
  }
  if (errorType === "cluster") {
    return "cherche d'abord un coup solide qui stabilise la position.";
  }
  return "cherche un plan qui améliore tes pièces.";
}

export function practiceHintForAnnotation(annotation: ReviewMoveAnnotation): string {
  const errorType = annotation.pedagogical_explanation?.error_type;
  const tags = new Set(annotation.tags ?? []);
  if (errorType === "tactical" || tags.has("missed_opportunity")) {
    return "Cherche d'abord les échecs, captures et menaces.";
  }
  if (errorType === "conversion" || tags.has("conversion_issue")) {
    return "Cherche un coup qui limite le contre-jeu.";
  }
  if (errorType === "defensive" || tags.has("defensive_resource_missed")) {
    return "Cherche une ressource défensive.";
  }
  if (errorType === "cluster" || tags.has("cluster")) {
    return "Cherche d'abord un coup solide qui stabilise la position.";
  }
  return "Cherche un plan qui améliore tes pièces.";
}

export function hiddenCoachObjective(
  annotation: ReviewMoveAnnotation,
  explanation: ReviewMoveAnnotation["pedagogical_explanation"],
): string {
  const errorType = explanation?.error_type;
  if (errorType === "tactical") {
    return "Tactique à trouver : observe la position avant de révéler la solution.";
  }
  if (errorType === "conversion") {
    return "Conversion : cherche le coup qui garde le contrôle de la position.";
  }
  if (errorType === "defensive") {
    return "Défense : cherche comment limiter les menaces adverses.";
  }
  if (errorType === "cluster") {
    return "Enchaînement d'erreurs : cherche d'abord à stabiliser la position.";
  }
  if (errorType === "strong_find") {
    return "Coup fort à retrouver : essaie d'identifier l'idée clé.";
  }
  return annotation.impact_label
    ? `Ce moment a eu un impact ${annotation.impact_label.toLowerCase()} sur la partie.`
    : "Ce moment a influencé la partie : cherche le meilleur coup avant de révéler la réponse.";
}

export function practiceItemAnnotationLabel(item: ReviewPracticeItem): ReviewMoveAnnotation {
  return {
    ply: item.ply,
    move_number: item.move_number ?? Math.ceil(item.ply / 2),
    color: item.color,
    side: item.color,
    san: item.san ?? null,
    uci: item.uci ?? item.best_move_uci,
    fen_before: item.fen_before,
    fen_after: item.fen_after ?? item.fen_before,
    primary_category: item.primary_category,
    category_label: item.category_label ?? item.primary_category,
    tags: item.tags ?? [],
    tag_labels: item.tag_labels ?? [],
    win_loss: item.win_loss ?? null,
    move_accuracy: item.move_accuracy ?? null,
    criticality_score: null,
    best_move_uci: item.best_move_uci,
    best_move_san: item.best_move_san ?? null,
    acceptable_moves: item.acceptable_moves ?? [],
    pv_line: item.pv_line ?? [],
    pv_line_available: item.pv_line_available,
    pv_line_message: item.pv_line_message,
    evidence_available: true,
    pedagogical_explanation: item.pedagogical_explanation ?? null,
    coach_priority_rank: item.coach_priority_rank ?? null,
    impact_label: item.impact_label ?? null,
    move_quality_label: item.move_quality_label ?? null,
    coach_card_title: item.coach_card_title ?? null,
    compact_label: item.compact_label ?? null,
  };
}

export function selectedCoachAnnotationForReview(
  review: ReviewResponse | null,
  selectedCoachPly: number | null,
  selectedMovePly: number | null,
  activeSection: ReviewSectionKey,
  targetColor: ReviewPovTargetColor,
): ReviewMoveAnnotation | null {
  if (!reviewIsCompleted(review)) {
    return null;
  }
  const sections = filteredReviewSections(review, targetColor);
  const all = sections.all;
  if (selectedCoachPly !== null) {
    const selected = all.find((annotation) => annotation.ply === selectedCoachPly);
    if (selected) {
      return selected;
    }
  }
  if (selectedMovePly !== null) {
    const selected = all.find((annotation) => annotation.ply === selectedMovePly);
    if (selected) {
      return selected;
    }
  }
  const sectionRows = sections[activeSection] ?? [];
  return (
    sectionRows[0] ??
    sections.to_review?.[0] ??
    sections.missed_opportunities?.[0] ??
    sections.strong_moves?.[0] ??
    all[0] ??
    null
  );
}

export function annotationIndex(
  review: ReviewResponse | null,
  annotation: ReviewMoveAnnotation | null,
): number {
  if (!review || !annotation) {
    return 0;
  }
  const index = (review.move_annotations ?? []).findIndex(
    (candidate) => candidate.ply === annotation.ply && candidate.uci === annotation.uci,
  );
  return index >= 0 ? index : 0;
}

export function headlineScoreForReview(
  review: ReviewResponse,
  povContext?: ReviewPovContext,
): number | null | undefined {
  if (!povContext) {
    return (
      review.user_headline_neurochess_score ??
      review.headline_neurochess_score ??
      review.white_headline_neurochess_score ??
      review.black_headline_neurochess_score
    );
  }
  if (povContext.isUserPov) {
    return review.user_headline_neurochess_score ?? review.headline_neurochess_score;
  }
  if (povContext.targetColor === "white") {
    return review.white_headline_neurochess_score;
  }
  if (povContext.targetColor === "black") {
    return review.black_headline_neurochess_score;
  }
  return undefined;
}

export function publicNeuroScoreForReview(
  review: ReviewResponse,
  povContext?: ReviewPovContext,
): number | null | undefined {
  if (!povContext) {
    return (
      review.user_public_neuro_score ??
      review.public_neuro_score ??
      review.user_lichess_like_accuracy ??
      review.white_public_neuro_score ??
      review.white_lichess_like_accuracy ??
      review.black_public_neuro_score ??
      review.black_lichess_like_accuracy ??
      review.user_review_score ??
      review.white_review_score ??
      review.black_review_score
    );
  }
  if (povContext.isUserPov) {
    return userPublicScore(review);
  }
  if (povContext.targetColor === "white") {
    return publicScoreForColor(review, "white");
  }
  if (povContext.targetColor === "black") {
    return publicScoreForColor(review, "black");
  }
  return undefined;
}

function rawCoachNeuroScoreForReview(
  review: ReviewResponse,
  povContext?: ReviewPovContext,
): number | null | undefined {
  if (!povContext) {
    return (
      review.user_coach_neuro_score ??
      review.coach_neuro_score ??
      review.user_headline_neurochess_score ??
      review.headline_neurochess_score ??
      review.white_coach_neuro_score ??
      review.white_headline_neurochess_score ??
      review.black_coach_neuro_score ??
      review.black_headline_neurochess_score
    );
  }
  if (povContext.isUserPov) {
    return userCoachScore(review);
  }
  if (povContext.targetColor === "white") {
    return coachScoreForColor(review, "white");
  }
  if (povContext.targetColor === "black") {
    return coachScoreForColor(review, "black");
  }
  return undefined;
}

export function coachNeuroScoreForReview(
  review: ReviewResponse,
  povContext?: ReviewPovContext,
): number | null | undefined {
  return rawCoachNeuroScoreForReview(review, povContext) ?? referencePrecisionForReview(review, povContext);
}

export function referencePrecisionForReview(
  review: ReviewResponse,
  povContext?: ReviewPovContext,
): number | null | undefined {
  return publicNeuroScoreForReview(review, povContext);
}

export function coachScoreUsesReferenceFallback(
  review: ReviewResponse,
  povContext?: ReviewPovContext,
): boolean {
  return (
    !hasReviewScoreValue(rawCoachNeuroScoreForReview(review, povContext)) &&
    hasReviewScoreValue(referencePrecisionForReview(review, povContext))
  );
}

export function fallbackReviewSummary(review: ReviewResponse): string {
  return publicSummarySentence(
    coachNeuroScoreForReview(review),
    referencePrecisionForReview(review),
    review.review_sections ?? { to_review: [], strong_moves: [], missed_opportunities: [], all: [] },
  );
}


export function publicScoreLabelForPov(povContext: ReviewPovContext): string {
  if (povContext.isUserPov) {
    return "Score de précision";
  }
  if (povContext.targetColor === "white") {
    return "Score de précision - Blancs";
  }
  if (povContext.targetColor === "black") {
    return "Score de précision - Noirs";
  }
  return "Scores de précision";
}

export function coachScoreLabelForPov(
  povContext: ReviewPovContext,
  referenceFallback = false,
): string {
  if (referenceFallback) {
    return "Score indicatif — basé sur la précision de référence";
  }
  if (povContext.targetColor === "white") {
    return "Score coach - Blancs";
  }
  if (povContext.targetColor === "black") {
    return "Score coach - Noirs";
  }
  if (povContext.isUserPov) {
    return "Score coach";
  }
  return "Scores coach";
}

export function reviewSummaryForPov(
  review: ReviewResponse,
  povContext: ReviewPovContext,
  sections: ReviewSections,
): string {
  if (povContext.targetColor === "both") {
    const white = coachScoreForColor(review, "white") ?? publicScoreForColor(review, "white");
    const black = coachScoreForColor(review, "black") ?? publicScoreForColor(review, "black");
    if (hasReviewScoreValue(white) && hasReviewScoreValue(black)) {
      if (Math.abs(white - black) < 4) {
        return "Les deux camps ont eu un score coach assez proche.";
      }
      return white > black
        ? "Les Blancs ont mieux limité les moments critiques."
        : "Les Noirs ont mieux limité les moments critiques.";
    }
    return "Sélectionne Blancs ou Noirs pour voir les priorités d'un joueur.";
  }

  const colorLabel = reviewColorLabel(povContext.targetColor);
  const subject = `Les ${colorLabel}`;
  const coachScore = coachNeuroScoreForReview(review, povContext);
  const publicScore = referencePrecisionForReview(review, povContext);
  const tags = tagCountsForAnnotations(sections.to_review);
  const criticalCount = criticalOrDecisiveCount(sections.to_review);

  if ((tags.get("conversion_issue") ?? 0) >= 2) {
    return `${subject} ont obtenu de bonnes positions, mais la conversion a coûté cher.`;
  }
  if ((tags.get("defensive_resource_missed") ?? 0) >= 2) {
    return `Les ressources défensives des ${colorLabel.toLowerCase()} sont un axe prioritaire.`;
  }
  if ((tags.get("missed_opportunity") ?? 0) >= 2) {
    return `${subject} ont manqué plusieurs opportunités tactiques.`;
  }
  if ((tags.get("cluster") ?? 0) >= 2) {
    return `${subject} ont souffert après plusieurs moments groupés.`;
  }
  if (review.opening_reality_evidence?.critical_moment_after_exit) {
    return `Un problème apparaît après la sortie d'ouverture des ${colorLabel.toLowerCase()}.`;
  }
  if (
    hasReviewScoreValue(publicScore) &&
    publicScore >= 80 &&
    hasReviewScoreValue(coachScore) &&
    coachScore < 70
  ) {
    return "La précision moyenne est correcte, mais certains moments critiques coûtent cher.";
  }
  if (hasReviewScoreValue(coachScore) && coachScore >= 80 && criticalCount <= 1) {
    return `${subject} ont joué une partie solide : peu d'erreurs importantes détectées.`;
  }
  if (hasReviewScoreValue(coachScore) && coachScore < 60) {
    return `${subject} ont plusieurs coups importants à revoir.`;
  }
  if (sections.to_review.length > 0) {
    return "Quelques moments prioritaires expliquent l'essentiel de la Review.";
  }
  return `${subject} n'ont pas de gros point d'alerte dans cette Review.`;
}

export function tagCountsForAnnotations(annotations: ReviewMoveAnnotation[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const annotation of annotations) {
    for (const tag of annotation.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}

function criticalOrDecisiveCount(annotations: ReviewMoveAnnotation[]): number {
  return annotations.filter((annotation) => {
    const category = String(annotation.primary_category ?? "").toLowerCase();
    return (
      category === "critical" ||
      category === "decisive" ||
      Number(annotation.win_loss ?? 0) >= 15
    );
  }).length;
}

function publicSummarySentence(
  coachScore: number | null | undefined,
  publicScore: number | null | undefined,
  sections: ReviewSections,
): string {
  const tags = tagCountsForAnnotations(sections.to_review ?? []);
  const criticalCount = criticalOrDecisiveCount(sections.to_review ?? []);
  if ((tags.get("conversion_issue") ?? 0) >= 2) {
    return "La conversion des positions favorables a coûté cher.";
  }
  if ((tags.get("defensive_resource_missed") ?? 0) >= 2) {
    return "Les ressources défensives sont un axe prioritaire.";
  }
  if ((tags.get("missed_opportunity") ?? 0) >= 2) {
    return "Plusieurs opportunités tactiques ont été manquées.";
  }
  if (
    hasReviewScoreValue(publicScore) &&
    publicScore >= 80 &&
    hasReviewScoreValue(coachScore) &&
    coachScore < 70
  ) {
    return "La précision moyenne est correcte, mais certains moments critiques coûtent cher.";
  }
  if (hasReviewScoreValue(coachScore) && coachScore >= 80 && criticalCount <= 1) {
    return "Partie solide : peu d'erreurs importantes détectées.";
  }
  if (hasReviewScoreValue(coachScore) && coachScore < 60) {
    return "Partie difficile : plusieurs coups importants sont à revoir.";
  }
  if ((sections.to_review ?? []).length > 0) {
    return "Quelques moments prioritaires expliquent l'essentiel de la Review.";
  }
  return "Partie stable : la Review ne détecte pas de gros point d'alerte.";
}

export function comparisonLabelForPov(
  review: ReviewResponse,
  povContext: ReviewPovContext,
): string {
  if (povContext.isUserPov) {
    return `Toi ${formatHeadlineScore(userCoachScore(review) ?? userPublicScore(review))} · Adversaire ${formatHeadlineScore(opponentCoachScore(review) ?? opponentPublicScore(review))}`;
  }
  if (povContext.targetColor === "white") {
    return `Blancs ${formatHeadlineScore(coachScoreForColor(review, "white") ?? publicScoreForColor(review, "white"))} · Noirs ${formatHeadlineScore(coachScoreForColor(review, "black") ?? publicScoreForColor(review, "black"))}`;
  }
  if (povContext.targetColor === "black") {
    return `Noirs ${formatHeadlineScore(coachScoreForColor(review, "black") ?? publicScoreForColor(review, "black"))} · Blancs ${formatHeadlineScore(coachScoreForColor(review, "white") ?? publicScoreForColor(review, "white"))}`;
  }
  return `Blancs ${formatHeadlineScore(coachScoreForColor(review, "white") ?? publicScoreForColor(review, "white"))} · Noirs ${formatHeadlineScore(coachScoreForColor(review, "black") ?? publicScoreForColor(review, "black"))}`;
}

export function referencePrecisionLabelForPov(
  review: ReviewResponse,
  povContext: ReviewPovContext,
): string {
  if (povContext.isUserPov) {
    return `Précision de référence : ${formatHeadlineScore(userPublicScore(review))} %`;
  }
  if (povContext.targetColor === "white") {
    return `Précision de référence : ${formatHeadlineScore(publicScoreForColor(review, "white"))} %`;
  }
  if (povContext.targetColor === "black") {
    return `Précision de référence : ${formatHeadlineScore(publicScoreForColor(review, "black"))} %`;
  }
  return `Précision référence : Blancs ${formatHeadlineScore(publicScoreForColor(review, "white"))} · Noirs ${formatHeadlineScore(publicScoreForColor(review, "black"))}`;
}

export function scoreDetailsForPov(
  review: ReviewResponse,
  povContext: ReviewPovContext,
): ReviewScoreMetricView[] {
  if (povContext.isUserPov) {
    return [
      {
        label: "NeuroScore coach",
        value: userCoachScore(review) ?? userPublicScore(review),
      },
      {
        label: "Précision de référence",
        value: userPublicScore(review),
      },
      {
        label: "Adversaire coach",
        value: opponentCoachScore(review) ?? opponentPublicScore(review),
      },
    ];
  }
  if (povContext.targetColor === "white" || povContext.targetColor === "black") {
    const color = povContext.targetColor;
    const opponent = color === "white" ? "black" : "white";
    return [
      {
        label: `${reviewColorLabel(color)} NeuroScore coach`,
        value: coachScoreForColor(review, color) ?? publicScoreForColor(review, color),
      },
      {
        label: `${reviewColorLabel(color)} précision de référence`,
        value: publicScoreForColor(review, color),
      },
      {
        label: `${reviewColorLabel(opponent)} coach`,
        value: coachScoreForColor(review, opponent) ?? publicScoreForColor(review, opponent),
      },
      {
        label: `${reviewColorLabel(opponent)} précision de référence`,
        value: publicScoreForColor(review, opponent),
      },
    ];
  }
  return [
    { label: "Blancs NeuroScore coach", value: coachScoreForColor(review, "white") ?? publicScoreForColor(review, "white") },
    { label: "Noirs NeuroScore coach", value: coachScoreForColor(review, "black") ?? publicScoreForColor(review, "black") },
    { label: "Blancs précision de référence", value: publicScoreForColor(review, "white") },
    { label: "Noirs précision de référence", value: publicScoreForColor(review, "black") },
  ];
}

export function scoreAuditDetailsForPov(
  review: ReviewResponse,
  povContext: ReviewPovContext,
): ReviewScoreMetricView[] {
  if (povContext.isUserPov) {
    return [
      {
        label: "Score coach legacy",
        value: review.user_headline_neurochess_score ?? review.headline_neurochess_score,
      },
      { label: "Score diagnostic interne", value: review.user_neuro_score },
      {
        label: "Écart diagnostique interne",
        value: review.user_diagnostic_gap,
        signed: true,
        suffix: " pts",
      },
      { label: "Adversaire diagnostic interne", value: review.opponent_neuro_score },
    ];
  }
  if (povContext.targetColor === "white" || povContext.targetColor === "black") {
    const color = povContext.targetColor;
    return [
      {
        label: `${reviewColorLabel(color)} score coach legacy`,
        value: headlineScoreForReview(review, povContext),
      },
      {
        label: `${reviewColorLabel(color)} diagnostic interne`,
        value: neuroScoreForColor(review, color),
      },
      {
        label: `${reviewColorLabel(color)} écart diagnostique interne`,
        value: diagnosticGapForColor(review, color),
        signed: true,
        suffix: " pts",
      },
    ];
  }
  return [
    { label: "Blancs score coach legacy", value: review.white_headline_neurochess_score },
    { label: "Blancs diagnostic interne", value: neuroScoreForColor(review, "white") },
    {
      label: "Blancs écart diagnostique interne",
      value: diagnosticGapForColor(review, "white"),
      signed: true,
      suffix: " pts",
    },
    { label: "Noirs score coach legacy", value: review.black_headline_neurochess_score },
    { label: "Noirs diagnostic interne", value: neuroScoreForColor(review, "black") },
    {
      label: "Noirs écart diagnostique interne",
      value: diagnosticGapForColor(review, "black"),
      signed: true,
      suffix: " pts",
    },
  ];
}

export function qualitativeGameLabelForPov(
  review: ReviewResponse,
  povContext: ReviewPovContext,
  sections: ReviewSections,
): string {
  if (povContext.targetColor === "both") {
    return "Comparaison des deux camps";
  }
  const score = coachNeuroScoreForReview(review, povContext);
  const publicScore = referencePrecisionForReview(review, povContext);
  const tags = tagCountsForAnnotations(sections.to_review);
  const criticalCount = criticalOrDecisiveCount(sections.to_review);
  if (!hasReviewScoreValue(score)) {
    return review.qualitative_game_label ?? "Partie à analyser";
  }
  if (criticalCount >= 3 || (tags.get("cluster") ?? 0) >= 2) {
    return "Partie à bascule";
  }
  if ((tags.get("missed_opportunity") ?? 0) >= 2 || (tags.get("tactical") ?? 0) >= 2) {
    return "Partie tactique";
  }
  if ((tags.get("conversion_issue") ?? 0) >= 2) {
    return "Partie mal convertie";
  }
  if ((tags.get("defensive_resource_missed") ?? 0) >= 2) {
    return "Partie défensive difficile";
  }
  if (hasReviewScoreValue(publicScore) && publicScore >= 80 && score < 70) {
    return "Partie à bascule";
  }
  if (score >= 80 && criticalCount <= 1) {
    return "Partie solide";
  }
  if (score >= 65) {
    return "Partie irrégulière";
  }
  return "Partie fragile";
}

export function lichessScoreForColor(
  review: ReviewResponse,
  color: "white" | "black",
): number | null | undefined {
  return color === "white"
    ? review.white_lichess_like_accuracy ?? review.white_review_score
    : review.black_lichess_like_accuracy ?? review.black_review_score;
}

export function publicScoreForColor(
  review: ReviewResponse,
  color: "white" | "black",
): number | null | undefined {
  return color === "white"
    ? review.white_public_neuro_score ?? review.white_lichess_like_accuracy ?? review.white_review_score
    : review.black_public_neuro_score ?? review.black_lichess_like_accuracy ?? review.black_review_score;
}

export function coachScoreForColor(
  review: ReviewResponse,
  color: "white" | "black",
): number | null | undefined {
  return color === "white"
    ? review.white_coach_neuro_score ?? review.white_headline_neurochess_score
    : review.black_coach_neuro_score ?? review.black_headline_neurochess_score;
}

function userPublicScore(review: ReviewResponse): number | null | undefined {
  return (
    review.user_public_neuro_score ??
    review.public_neuro_score ??
    review.user_lichess_like_accuracy ??
    review.user_review_score
  );
}

function userCoachScore(review: ReviewResponse): number | null | undefined {
  return (
    review.user_coach_neuro_score ??
    review.coach_neuro_score ??
    review.user_headline_neurochess_score ??
    review.headline_neurochess_score
  );
}

function opponentPublicScore(review: ReviewResponse): number | null | undefined {
  return (
    review.opponent_public_neuro_score ??
    review.opponent_lichess_like_accuracy ??
    review.opponent_review_score
  );
}

function opponentCoachScore(review: ReviewResponse): number | null | undefined {
  return (
    review.opponent_coach_neuro_score ??
    review.opponent_headline_neurochess_score
  );
}

export function neuroScoreForColor(
  review: ReviewResponse,
  color: "white" | "black",
): number | null | undefined {
  return color === "white" ? review.white_neuro_score : review.black_neuro_score;
}

export function diagnosticGapForColor(
  review: ReviewResponse,
  color: "white" | "black",
): number | null | undefined {
  return color === "white" ? review.white_diagnostic_gap : review.black_diagnostic_gap;
}

export function reviewCompactAnalysisLabel(review: ReviewResponse): string {
  const profile = review.review_analysis_profile ?? review.review_analysis_quality ?? "standard";
  const done = review.completed_position_count ?? review.deep_done_count ?? 0;
  const total = review.required_position_count ?? 0;
  return `Analyse : ${profile} · ${done}/${total} positions`;
}

export function categoryTone(category: string): "positive" | "neutral" | "warning" | "danger" | "book" {
  if (category === "book") {
    return "book";
  }
  if (["best", "excellent", "very_good"].includes(category)) {
    return "positive";
  }
  if (["good", "playable"].includes(category)) {
    return "neutral";
  }
  if (["critical", "decisive"].includes(category)) {
    return "danger";
  }
  return "warning";
}

export function coachTone(
  annotation: ReviewMoveAnnotation,
  errorType: string | null | undefined,
): "positive" | "neutral" | "warning" | "danger" | "book" | "conversion" | "defense" {
  if (errorType === "strong_find") {
    return "positive";
  }
  if (errorType === "conversion") {
    return "conversion";
  }
  if (errorType === "defensive") {
    return "defense";
  }
  if (errorType === "cluster" || errorType === "tactical") {
    return "danger";
  }
  return categoryTone(annotation.primary_category);
}


export function humanReason(annotation: ReviewMoveAnnotation): string {
  const tags = annotation.tags ?? [];
  if (tags.includes("missed_opportunity")) {
    return "une opportunité claire a été manquée dans cette position.";
  }
  if (tags.includes("conversion_issue")) {
    return "une bonne position est devenue plus difficile à convertir.";
  }
  if (tags.includes("defensive_resource_missed")) {
    return "un meilleur coup donnait davantage de ressources défensives.";
  }
  if (tags.includes("persistent_loss")) {
    return "la perte est restée visible dans la suite de la partie.";
  }
  if (tags.includes("cluster")) {
    return "ce coup arrive dans une séquence déjà fragile.";
  }
  if (tags.includes("strong_find")) {
    return "tu as trouvé un bon coup dans une position exigeante.";
  }
  if (annotation.primary_category === "critical" || annotation.primary_category === "decisive") {
    return "ce coup a nettement donné plus de chances à l'adversaire.";
  }
  return annotation.reason ?? "ce coup mérite d'être revu dans son contexte.";
}

export function coachTextForPov(
  text: string | null | undefined,
  povContext: ReviewPovContext,
  annotation: ReviewMoveAnnotation,
): string | null | undefined {
  if (!text || povContext.isUserPov) {
    return text;
  }
  const colorLabel = reviewColorLabel(annotation.color);
  const subject = `Les ${colorLabel}`;
  const moveSubject = `Le coup des ${colorLabel.toLowerCase()}`;
  return text
    .replace(/\bTu as\b/g, `${subject} ont`)
    .replace(/\btu as\b/g, `${subject} ont`)
    .replace(/\bTu avais\b/g, `${subject} avaient`)
    .replace(/\btu avais\b/g, `${subject} avaient`)
    .replace(/\bTon coup\b/g, moveSubject)
    .replace(/\bton coup\b/g, moveSubject.toLowerCase())
    .replace(/\bTes chances\b/g, `Les chances des ${colorLabel.toLowerCase()}`)
    .replace(/\btes chances\b/g, `les chances des ${colorLabel.toLowerCase()}`)
    .replace(/\btu es\b/g, `${subject} sont`)
    .replace(/\btu\b/g, subject)
    .replace(/\bton\b/g, `le coup des ${colorLabel.toLowerCase()}`)
    .replace(/\bta\b/g, `la décision des ${colorLabel.toLowerCase()}`);
}


export const filterSectionsByPov = filteredReviewSections;
export const buildPriorityMoments = reviewCockpitPriorities;
export const buildCockpitIndicators = reviewCockpitIndicators;
export const buildCockpitIndicatorsView = reviewCockpitIndicators;
export const buildThreeTakeaways = reviewCockpitTakeaways;


export function buildReviewScoreViewModel(
  review: ReviewResponse,
  povContext: ReviewPovContext,
  filteredSections: ReviewSections,
): {
  headline: number | null | undefined;
  headlineLabel: string;
  headlineDisplay: string;
  summarySentence: string;
  scoreDetails: ReviewScoreMetricView[];
  scoreAuditDetails: ReviewScoreMetricView[];
  qualitativeLabel: string;
  comparisonLabel: string;
  confidenceLabel: string;
  compactAnalysisLabel: string;
  metricsNeedRebuild: boolean;
  referencePrecisionLabel: string;
} {
  const headline = coachNeuroScoreForReview(review, povContext);
  const usesReferenceFallback = coachScoreUsesReferenceFallback(review, povContext);
  return {
    headline,
    headlineLabel: coachScoreLabelForPov(povContext, usesReferenceFallback),
    headlineDisplay:
      povContext.targetColor === "both"
        ? comparisonLabelForPov(review, povContext)
        : formatHeadlineScore(headline),
    summarySentence: reviewSummaryForPov(review, povContext, filteredSections),
    scoreDetails: scoreDetailsForPov(review, povContext),
    scoreAuditDetails: scoreAuditDetailsForPov(review, povContext),
    qualitativeLabel: qualitativeGameLabelForPov(review, povContext, filteredSections),
    comparisonLabel: comparisonLabelForPov(review, povContext),
    confidenceLabel: reviewScoreConfidenceLabel(review.review_score_confidence),
    compactAnalysisLabel: reviewCompactAnalysisLabel(review),
    metricsNeedRebuild: reviewMetricsNeedRebuild(review),
    referencePrecisionLabel: referencePrecisionLabelForPov(review, povContext),
  };
}

export function buildLessonStepState(
  annotation: ReviewMoveAnnotation,
  lessonStep: ReviewLessonStep,
  tryMoveState: ReviewTryMoveViewState | null,
  solutionRevealState: ReviewSolutionRevealViewState | null,
): ReviewLessonStepState {
  const publicStep = getPublicLessonStep(
    lessonStep,
    solutionRevealState,
    tryMoveState,
    annotation,
  );
  const tryActiveForAnnotation =
    tryMoveState?.active && tryMoveState.annotationPly === annotation.ply;
  const revealMode =
    solutionRevealState?.ply === annotation.ply
      ? solutionRevealState.state
      : "hidden";
  const hasPlayedMoveOnly =
    lessonStep === "played" || revealMode === "played_move_shown";
  const canShowSolutionData =
    publicStep === "correction" ||
    publicStep === "training" ||
    lessonStep === "solution" ||
    lessonStep === "compare" ||
    lessonStep === "takeaway" ||
    revealMode === "attempted" ||
    revealMode === "solution_revealed" ||
    revealMode === "pv_line" ||
    Boolean(tryActiveForAnnotation && tryMoveState?.solutionRevealed);
  const canShowLineComparison = lessonStep === "compare" || revealMode === "pv_line";
  const hintVisible =
    lessonStep === "try" && revealMode === "hint_shown";
  return {
    publicStep,
    revealMode,
    hasPlayedMoveOnly,
    canShowSolutionData,
    canShowLineComparison,
    hintVisible,
    canShowAnyPvLine: reviewAnnotationHasAnyPvLine(annotation),
  };
}

export type ReviewCorrectionFeedbackView = {
  accepted: boolean;
  acceptedSource: "backend" | "best_match" | "accepted_move" | null;
  hasCurrentAttempt: boolean;
  attemptResult: string | null;
  isSuccessAttempt: boolean;
  isAcceptedAttempt: boolean;
  needsRebuild: boolean;
  showMissedBest: boolean;
  showHistoricalMoveDiagnostics: boolean;
  showAttemptSpecificFeedback: boolean;
  showSuccessHistoricalContext: boolean;
  showHistoricalContext: boolean;
  showRecoveredGain: boolean;
  recoveredGainPoints: number | null;
  shouldShowRetry: boolean;
  shouldShowCorrection: boolean;
  shouldShowWhyItWorks: boolean;
  shouldShowLine: boolean;
  primaryCta: "continue" | "show_correction";
  secondaryCtas: Array<"retry" | "show_correction" | "show_why" | "show_line">;
  visibleTagLabels: string[];
  categoryLabel: string;
  categoryIsNegative: boolean;
};

const ACCEPTED_TRY_MOVE_RESULTS = new Set(["best", "very_good", "acceptable"]);

export function buildReviewCorrectionFeedbackView(
  annotation: ReviewMoveAnnotation,
  displayedPlayedMove: string | null | undefined,
  tryMoveState: ReviewTryMoveViewState | null,
): ReviewCorrectionFeedbackView {
  const tryActiveForAnnotation =
    tryMoveState?.active && tryMoveState.annotationPly === annotation.ply;
  const tryFeedbackResult =
    tryActiveForAnnotation && tryMoveState?.feedback
      ? String(tryMoveState.feedback.result ?? "")
      : null;
  const acceptedSource = correctionAcceptedSource(
    annotation,
    displayedPlayedMove,
    tryActiveForAnnotation ? tryMoveState : null,
    tryFeedbackResult,
  );
  const accepted = acceptedSource !== null;
  const needsRebuild = tryFeedbackResult === "needs_rebuild";
  const hasCurrentAttempt = Boolean(tryActiveForAnnotation && tryMoveState?.feedback);
  const showHistoricalMoveDiagnostics = !hasCurrentAttempt && !accepted && !needsRebuild;
  const showAttemptSpecificFeedback = hasCurrentAttempt && !accepted && !needsRebuild;
  const shouldShowLine = accepted || !hasCurrentAttempt;
  const recoveredGainPoints = recoveredGainPointsFromWinLoss(annotation.win_loss);
  const rawTags = annotation.tag_labels?.length
    ? annotation.tag_labels
    : annotation.tags;
  return {
    accepted,
    acceptedSource,
    hasCurrentAttempt,
    attemptResult: tryFeedbackResult,
    isSuccessAttempt: accepted,
    isAcceptedAttempt: accepted,
    needsRebuild,
    showMissedBest: !accepted && !needsRebuild,
    showHistoricalMoveDiagnostics,
    showAttemptSpecificFeedback,
    showSuccessHistoricalContext: accepted,
    showHistoricalContext: accepted,
    showRecoveredGain: accepted && recoveredGainPoints !== null,
    recoveredGainPoints,
    shouldShowRetry: !accepted && !needsRebuild,
    shouldShowCorrection: !accepted,
    shouldShowWhyItWorks: accepted,
    shouldShowLine,
    primaryCta: accepted ? "continue" : "show_correction",
    secondaryCtas: accepted
      ? ["show_why", "show_line"]
      : needsRebuild
        ? []
        : shouldShowLine
          ? ["retry", "show_correction", "show_line"]
          : ["retry", "show_correction"],
    visibleTagLabels: accepted
      ? rawTags.filter((tag) => !isNegativeCorrectionLabel(tag))
      : rawTags,
    categoryLabel: annotation.category_label,
    categoryIsNegative: accepted && isNegativeCorrectionLabel(annotation.category_label),
  };
}

export function recoveredGainPointsFromWinLoss(
  value: number | string | null | undefined,
): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return Math.round(numeric);
}

function correctionAcceptedSource(
  annotation: ReviewMoveAnnotation,
  displayedPlayedMove: string | null | undefined,
  tryMoveState: ReviewTryMoveViewState | null,
  tryFeedbackResult: string | null,
): ReviewCorrectionFeedbackView["acceptedSource"] {
  if (tryFeedbackResult && ACCEPTED_TRY_MOVE_RESULTS.has(tryFeedbackResult)) {
    return "backend";
  }

  const attemptMoveCandidates =
    tryMoveState?.attemptedUci || tryMoveState?.attemptedSan
      ? [tryMoveState.attemptedUci, tryMoveState.attemptedSan, displayedPlayedMove]
      : null;
  const userMoveCandidates =
    attemptMoveCandidates ?? [displayedPlayedMove, annotation.uci, annotation.san];
  const bestMoveCandidates = [annotation.best_move_uci, annotation.best_move_san];
  if (moveCandidateSetsIntersect(userMoveCandidates, bestMoveCandidates)) {
    return "best_match";
  }

  const acceptedMoveCandidates = (annotation.acceptable_moves ?? []).flatMap((move) => [
    move.uci,
    move.san,
  ]);
  if (moveCandidateSetsIntersect(userMoveCandidates, acceptedMoveCandidates)) {
    return "accepted_move";
  }

  return null;
}

function moveCandidateSetsIntersect(
  leftCandidates: Array<string | null | undefined>,
  rightCandidates: Array<string | null | undefined>,
): boolean {
  const left = moveComparisonKeys(leftCandidates);
  const right = moveComparisonKeys(rightCandidates);
  return [...left].some((key) => right.has(key));
}

function moveComparisonKeys(
  candidates: Array<string | null | undefined>,
): Set<string> {
  const keys = new Set<string>();
  for (const candidate of candidates) {
    const key = normalizeReviewMoveForComparison(candidate);
    if (key) {
      keys.add(key);
    }
  }
  return keys;
}

export function normalizeReviewMoveForComparison(
  value: string | null | undefined,
): string | null {
  const normalized = String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?]+/g, "")
    .replace(/[+#]+$/g, "")
    .replace(/\s+/g, "")
    .replace(/0-0/gi, "o-o")
    .toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function isNegativeCorrectionLabel(value: string | null | undefined): boolean {
  const normalized = normalizeReviewMoveForComparison(value)?.replace(/[._-]+/g, "") ?? "";
  return (
    normalized.includes("opportunitemanquee") ||
    normalized.includes("missedopportunity") ||
    normalized.includes("ressourcedefensivemanquee") ||
    normalized.includes("defensiveresourcemissed") ||
    normalized.includes("probleme")
  );
}

export function getPublicLessonStep(
  lessonStep: ReviewLessonStep,
  solutionRevealState: ReviewSolutionRevealViewState | null,
  attemptState: ReviewTryMoveViewState | null,
  annotation?: ReviewMoveAnnotation | null,
): ReviewPublicLessonStep {
  const revealMatches =
    !annotation || solutionRevealState?.ply === annotation.ply;
  const attemptMatches =
    !annotation || attemptState?.annotationPly === annotation.ply;
  const revealMode = revealMatches ? solutionRevealState?.state ?? "hidden" : "hidden";

  if (lessonStep === "takeaway") {
    return "training";
  }
  if (
    lessonStep === "played" ||
    lessonStep === "solution" ||
    lessonStep === "compare" ||
    revealMode === "attempted" ||
    revealMode === "played_move_shown" ||
    revealMode === "solution_revealed" ||
    revealMode === "pv_line" ||
    Boolean(attemptMatches && attemptState?.feedback?.show_best_move) ||
    Boolean(attemptMatches && attemptState?.solutionRevealed)
  ) {
    return "correction";
  }
  return "challenge";
}

export function buildLineComparisonView(
  annotation: ReviewMoveAnnotation,
  contrastCoach: NonNullable<ReviewMoveAnnotation["contrast_coach_explanation"]>,
  explanation: ReviewMoveAnnotation["pedagogical_explanation"],
  povContext: ReviewPovContext,
): ReviewLineComparisonView {
  const evidence = annotation.pv_contrast_evidence;
  const playedBranch = evidence?.played_branch;
  const bestBranch = evidence?.best_branch;
  const playedMove = annotation.san ?? annotation.uci ?? "Coup jou? non disponible";
  const solutionMove =
    annotation.best_move_san ?? annotation.best_move_uci ?? "Solution indisponible";
  const opponentReply =
    playedBranch?.opponent_best_reply_san ??
    playedBranch?.opponent_best_reply_uci ??
    null;
  const playedLinePreview =
    contrastCoach.played_line_preview || pvContrastLinePreview(playedBranch?.pv);
  const solutionLinePreview =
    contrastCoach.best_line_preview ||
    pvContrastLinePreview(bestBranch?.pv) ||
    pvContrastLinePreview(annotation.pv_line);
  const playedSummary =
    coachTextForPov(
      contrastCoach.what_happened_after_played,
      povContext,
      annotation,
    ) ??
    (opponentReply
      ? `Après le coup joué, l'adversaire peut répondre activement par ${opponentReply}.`
      : "Réponse adverse non disponible.");
  const solutionSummary =
    coachTextForPov(
      contrastCoach.why_solution_is_better,
      povContext,
      annotation,
    ) ??
    publicMainDifferenceText(contrastCoach, explanation) ??
    "La solution limite mieux les réponses adverses.";
  return {
    playedMove,
    solutionMove,
    playedLinePreview,
    solutionLinePreview,
    playedLineAvailable: reviewAnnotationHasPlayedPvLine(annotation),
    solutionLineAvailable: reviewAnnotationHasSolutionPvLine(annotation),
    playedSummary,
    solutionSummary,
    mainDifference: publicMainDifferenceText(contrastCoach, explanation),
  };
}

export function buildPracticeSummaryView(
  summary: ReviewPracticeSummary | null | undefined,
  itemCountFallback: number,
): ReviewPracticeSummaryView {
  const bestCount = summary?.best_count ?? summary?.correct_count ?? 0;
  const veryGoodCount = summary?.very_good_count ?? 0;
  const acceptableCount = summary?.acceptable_count ?? 0;
  const wrongCount = summary?.wrong_count ?? 0;
  const illegalCount = summary?.illegal_count ?? 0;
  const revealedCount = summary?.revealed_count ?? 0;
  const skippedCount = summary?.skipped_count ?? 0;
  const reviewCount = wrongCount + illegalCount + revealedCount + skippedCount;
  const solvedCount = bestCount + veryGoodCount;
  const itemCount = summary?.item_count ?? itemCountFallback;
  return { bestCount, veryGoodCount, acceptableCount, wrongCount, illegalCount, revealedCount, skippedCount, reviewCount, solvedCount, itemCount };
}

export function buildOpeningRealityView(evidence: OpeningRealityEvidence | null): OpeningRealityView {
  const linkedMoment = evidence?.critical_moment_after_exit ?? null;
  return {
    linkedMoment,
    canReviewExit: Boolean(evidence?.fen_before_exit ?? evidence?.out_of_book_fen),
    canShowLinkedMoment: typeof linkedMoment?.ply === "number",
  };
}

export function publicMainDifferenceText(
  explanation: ReviewMoveAnnotation["contrast_coach_explanation"],
  pedagogicalExplanation?: ReviewMoveAnnotation["pedagogical_explanation"],
): string | null {
  if (!explanation) return null;
  const type = explanation.main_difference_type ?? "unknown";
  if (pedagogicalExplanation?.error_type === "tactical" && type !== "forcing" && type !== "king_safety" && type !== "unknown") {
    return `Le moment est tactique, et la différence dans la ligne concerne surtout ${mainDifferenceTopic(type)}.`;
  }
  return humanMainDifferenceSentence(type, explanation.main_difference);
}

export function humanMainDifferenceSentence(type: string | null | undefined, fallback?: string | null): string {
  switch (type) {
    case "forcing": return "Différence principale : la solution est plus forcing.";
    case "material": return "Différence principale : la ligne change le bilan matériel.";
    case "king_safety": return "Différence principale : la sécurité du roi.";
    case "initiative": return "Différence principale : l'initiative.";
    case "conversion": return "Différence principale : la conversion de l'avantage.";
    case "defense": return "Différence principale : la défense.";
    case "positional": return "Différence principale : le plan positionnel.";
    case "unknown":
    case null:
    case undefined:
      return fallback ?? "Différence difficile à classifier.";
    default:
      return fallback ?? "Différence difficile à classifier.";
  }
}

export function mainDifferenceTopic(type: string | null | undefined): string {
  switch (type) {
    case "material": return "le bilan matériel";
    case "king_safety": return "la sécurité du roi";
    case "initiative": return "l'initiative";
    case "conversion": return "la conversion de l'avantage";
    case "defense": return "la défense";
    case "positional": return "le plan positionnel";
    case "forcing": return "le caractère forcing de la solution";
    default: return "un élément difficile à classifier";
  }
}

export function reviewMetricsNeedRebuild(review: ReviewResponse): boolean {
  const statusIsCompleted = review.status === "done" || review.status === "completed";
  const coverageIsComplete =
    (review.coverage ?? 0) >= 1 ||
    (review.required_position_count !== undefined &&
      review.required_position_count > 0 &&
      (review.completed_position_count ?? review.deep_done_count ?? 0) >=
        review.required_position_count);
  const hasLegacyAccuracy =
    hasReviewScoreValue(review.user_lichess_like_accuracy ?? review.user_review_score) ||
    hasReviewScoreValue(review.opponent_lichess_like_accuracy ?? review.opponent_review_score) ||
    hasReviewScoreValue(review.white_lichess_like_accuracy ?? review.white_review_score) ||
    hasReviewScoreValue(review.black_lichess_like_accuracy ?? review.black_review_score);
  const missingNeuro =
    (!hasReviewScoreValue(review.user_neuro_score) &&
      hasReviewScoreValue(review.user_lichess_like_accuracy ?? review.user_review_score)) ||
    (!hasReviewScoreValue(review.opponent_neuro_score) &&
      hasReviewScoreValue(review.opponent_lichess_like_accuracy ?? review.opponent_review_score)) ||
    (!hasReviewScoreValue(review.white_neuro_score) &&
      hasReviewScoreValue(review.white_lichess_like_accuracy ?? review.white_review_score)) ||
    (!hasReviewScoreValue(review.black_neuro_score) &&
      hasReviewScoreValue(review.black_lichess_like_accuracy ?? review.black_review_score));
  return (
    statusIsCompleted &&
    coverageIsComplete &&
    hasLegacyAccuracy &&
    (missingNeuro ||
      review.score_availability?.neuro_score === "legacy_needs_rebuild")
  );
}

export function reviewScoreAvailabilityReason(review: ReviewResponse): string {
  const reason = review.score_availability?.reason;
  if (reason === "legacy_needs_rebuild") {
    return "Métriques héritées détectées : aucun calcul moteur ne sera relancé.";
  }
  if (reason === "insufficient_moves") {
    return "Trop peu de coups analysables pour calculer le score.";
  }
  if (reason === "missing_data" || reason === "missing_dependency") {
    return "Données de score incomplètes dans le payload actuel.";
  }
  return "Le recalcul utilise uniquement les analyses déjà disponibles.";
}

