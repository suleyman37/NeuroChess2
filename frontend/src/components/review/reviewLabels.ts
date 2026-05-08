import type { ReviewMoveAnnotation } from "../../api/client";
import { fr } from "../../i18n";
import type { ReviewFocusKey, ReviewLessonStep, ReviewPov, ReviewPublicLessonStep, ReviewSectionKey } from "./reviewTypes";

export const REVIEW_SECTION_TABS: Array<{
  key: ReviewSectionKey;
  label: string;
  emptyLabel: string;
}> = [
  { key: "to_review", label: "À revoir", emptyLabel: "Aucun coup prioritaire à revoir." },
  { key: "strong_moves", label: "Coups forts", emptyLabel: "Aucun coup fort détecté." },
  { key: "missed_opportunities", label: "Opportunités", emptyLabel: "Aucune opportunité manquée détectée." },
  { key: "all", label: "Tous", emptyLabel: "Aucun coup annoté disponible." },
];

export const REVIEW_FOCUS_TABS: Array<{ key: ReviewFocusKey; label: string }> = [
  { key: "summary", label: fr.review.focusSummary },
  { key: "learn", label: fr.review.focusLearn },
  { key: "practice", label: fr.review.focusPractice },
  { key: "lab", label: fr.review.focusExplorer },
];

export const REVIEW_LESSON_STEPS: Array<{ key: ReviewLessonStep; label: string }> = [
  { key: "observe", label: "Observer" },
  { key: "try", label: "Essayer" },
  { key: "played", label: "Coup joué" },
  { key: "solution", label: "Solution" },
  { key: "compare", label: "Comparer" },
  { key: "takeaway", label: "À retenir" },
];

export const REVIEW_PUBLIC_LESSON_STEPS: Array<{
  key: ReviewPublicLessonStep;
  label: string;
}> = [
  { key: "challenge", label: "Défi" },
  { key: "correction", label: "Correction" },
  { key: "training", label: "Entraînement" },
];

export function buildPovOptions(userColor: "white" | "black" | null): Array<{ value: ReviewPov; label: string }> {
  return userColor
    ? [
        { value: "user", label: fr.review.pov.me },
        { value: "white", label: fr.review.pov.white },
        { value: "black", label: fr.review.pov.black },
        { value: "both", label: fr.review.pov.both },
      ]
    : [
        { value: "white", label: fr.review.pov.white },
        { value: "black", label: fr.review.pov.black },
        { value: "both", label: fr.review.pov.both },
      ];
}

export function reviewColorLabel(color: string | null | undefined): string {
  return color === "black" ? "Noirs" : "Blancs";
}

export function errorTypeLabel(errorType: string | null | undefined, annotation: ReviewMoveAnnotation): string {
  switch (errorType) {
    case "tactical": return "Tactique manquée";
    case "positional": return "Plan positionnel";
    case "conversion": return "Conversion";
    case "defensive": return "Défense";
    case "cluster": return "Enchaînement d'erreurs";
    case "opening_transition": return "Sortie du livre";
    case "strong_find": return "Coup fort";
    default: return annotation.category_label ?? "À revoir";
  }
}

export function lessonTypeLabel(errorType: string | null | undefined): string {
  switch (errorType) {
    case "tactical": return "Tactique";
    case "conversion": return "Conversion";
    case "defensive": return "Défense";
    default: return "Plan";
  }
}

export function impactLabelFromLoss(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "non mesuré";
  if (value < 2) return "négligeable";
  if (value < 7) return "léger";
  if (value < 15) return "important";
  if (value < 30) return "très important";
  return "critique";
}

export function openingRealityConfidenceLabel(confidence: string | null | undefined): string {
  if (confidence === "high") return "confiance élevée";
  if (confidence === "medium") return "confiance moyenne";
  if (confidence === "low") return "confiance basse";
  return "diagnostic léger";
}

export function moveQualityLabel(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "non disponible";
  if (value >= 95) return "Excellente";
  if (value >= 85) return "Très bonne";
  if (value >= 70) return "Correcte";
  if (value >= 50) return "Moyenne";
  if (value >= 30) return "Faible";
  return "Très faible";
}

export function reviewScoreConfidenceLabel(confidence: string | null): string {
  if (confidence === "high") return "élevée";
  if (confidence === "medium") return "moyenne";
  if (confidence === "low") return "indicative";
  return "non disponible";
}

export const MAIN_DIFFERENCE_TYPE_LABELS: Record<string, string> = {
  forcing: "forcing",
  material: "bilan matériel",
  king_safety: "sécurité du roi",
  initiative: "initiative",
  conversion: "conversion de l'avantage",
  defense: "défense",
  positional: "plan positionnel",
  unknown: "différence non classifiée",
};

export const PRACTICE_FALLBACK_MESSAGES = {
  noSession: "Aucune session enregistrée pour cette Review.",
  loadingMessage: "Chargement...",
  completed: "Session terminée.",
};

export const OPENING_FALLBACK_MESSAGES = {
  unavailable: "Données d'ouverture insuffisantes pour établir un diagnostic fiable.",
  available: "Diagnostic d'ouverture disponible.",
  noLinkedMoment: "Pas de gros problème détecté juste après la sortie.",
};
