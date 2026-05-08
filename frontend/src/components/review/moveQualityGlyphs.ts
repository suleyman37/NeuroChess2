import { fr } from "../../i18n";

export type MoveQualityGlyphId =
  | "brilliant"
  | "critical_best"
  | "excellent"
  | "good"
  | "playable"
  | "imprecise"
  | "wrong"
  | "severe"
  | "illegal"
  | "unknown"
  | "rebuild_needed";

export type MoveQualityContext =
  | "attempt"
  | "exploration"
  | "historical"
  | "solution"
  | "line"
  | "summary";

export type MoveQualityTone =
  | "success"
  | "good"
  | "neutral"
  | "warning"
  | "danger"
  | "muted"
  | "info";

export type MoveQualityGlyphDefinition = {
  id: MoveQualityGlyphId;
  glyph: string;
  label: string;
  shortDescription: string;
  tone: MoveQualityTone;
  allowedContexts: MoveQualityContext[];
  sourceSemantics: string;
  userVisible: boolean;
};

export const MOVE_QUALITY_GLYPH_REGISTRY: Record<
  MoveQualityGlyphId,
  MoveQualityGlyphDefinition
> = {
  brilliant: {
    id: "brilliant",
    glyph: "!!",
    label: fr.moveQuality.brilliant.label,
    shortDescription: fr.moveQuality.brilliant.description,
    tone: "info",
    allowedContexts: ["summary"],
    sourceSemantics: "Future-only exceptional category; not actively mapped in V1.1.",
    userVisible: false,
  },
  critical_best: {
    id: "critical_best",
    glyph: "!",
    label: fr.moveQuality.criticalBest.label,
    shortDescription: fr.moveQuality.criticalBest.description,
    tone: "success",
    allowedContexts: ["attempt", "exploration", "historical", "solution", "line", "summary"],
    sourceSemantics: "Current attempt result is best, or historical category is best.",
    userVisible: true,
  },
  excellent: {
    id: "excellent",
    glyph: "!",
    label: fr.moveQuality.excellent.label,
    shortDescription: fr.moveQuality.excellent.description,
    tone: "success",
    allowedContexts: ["attempt", "exploration", "historical", "summary"],
    sourceSemantics: "Current attempt result is very_good, or historical category is excellent/very_good.",
    userVisible: true,
  },
  good: {
    id: "good",
    glyph: "✓",
    label: fr.moveQuality.good.label,
    shortDescription: fr.moveQuality.good.description,
    tone: "good",
    allowedContexts: ["attempt", "exploration", "historical", "summary"],
    sourceSemantics: "Current attempt result is acceptable, or historical category is good.",
    userVisible: true,
  },
  playable: {
    id: "playable",
    glyph: "=",
    label: fr.moveQuality.playable.label,
    shortDescription: fr.moveQuality.playable.description,
    tone: "neutral",
    allowedContexts: ["attempt", "exploration", "historical", "summary"],
    sourceSemantics: "Current attempt explicitly classifies as playable, or historical category is book/playable.",
    userVisible: true,
  },
  imprecise: {
    id: "imprecise",
    glyph: "?!",
    label: fr.moveQuality.imprecise.label,
    shortDescription: fr.moveQuality.imprecise.description,
    tone: "warning",
    allowedContexts: ["attempt", "exploration", "historical", "summary"],
    sourceSemantics: "Current attempt is explicitly imprecise, or historical category is inexact/to_review.",
    userVisible: true,
  },
  wrong: {
    id: "wrong",
    glyph: "?",
    label: fr.moveQuality.wrong.label,
    shortDescription: fr.moveQuality.wrong.description,
    tone: "danger",
    allowedContexts: ["attempt", "exploration"],
    sourceSemantics: "Current attempt result is wrong.",
    userVisible: true,
  },
  severe: {
    id: "severe",
    glyph: "??",
    label: fr.moveQuality.severe.label,
    shortDescription: fr.moveQuality.severe.description,
    tone: "danger",
    allowedContexts: ["historical", "summary"],
    sourceSemantics: "Historical category is critical/decisive; not inferred from raw metrics and not used for current attempts.",
    userVisible: true,
  },
  illegal: {
    id: "illegal",
    glyph: "×",
    label: fr.moveQuality.illegal.label,
    shortDescription: fr.moveQuality.illegal.description,
    tone: "warning",
    allowedContexts: ["attempt", "exploration"],
    sourceSemantics: "Current attempt result is illegal.",
    userVisible: true,
  },
  unknown: {
    id: "unknown",
    glyph: "•",
    label: fr.moveQuality.unknown.label,
    shortDescription: fr.moveQuality.unknown.description,
    tone: "muted",
    allowedContexts: ["attempt", "exploration", "historical", "summary"],
    sourceSemantics: "Fallback when no safe current classification is available.",
    userVisible: true,
  },
  rebuild_needed: {
    id: "rebuild_needed",
    glyph: "↻",
    label: fr.moveQuality.rebuildNeeded.label,
    shortDescription: fr.moveQuality.rebuildNeeded.description,
    tone: "info",
    allowedContexts: ["attempt", "exploration"],
    sourceSemantics: "Current attempt cannot be safely classified without Review rebuild.",
    userVisible: true,
  },
};

export function getMoveQualityGlyphDefinition(
  qualityId: MoveQualityGlyphId | null | undefined,
): MoveQualityGlyphDefinition {
  return MOVE_QUALITY_GLYPH_REGISTRY[qualityId ?? "unknown"] ??
    MOVE_QUALITY_GLYPH_REGISTRY.unknown;
}

export function getMoveQualityGlyphForAttemptResult(
  result: string | null | undefined,
): MoveQualityGlyphId {
  switch (String(result ?? "").trim().toLowerCase()) {
    case "best":
      return "critical_best";
    case "very_good":
      return "excellent";
    case "acceptable":
      return "good";
    case "playable":
      return "playable";
    case "imprecise":
      return "imprecise";
    case "wrong":
      return "wrong";
    case "illegal":
      return "illegal";
    case "needs_rebuild":
      return "rebuild_needed";
    default:
      return "unknown";
  }
}

export function getMoveQualityGlyphForHistoricalCategory(
  category: string | null | undefined,
): MoveQualityGlyphId {
  switch (String(category ?? "").trim().toLowerCase()) {
    case "best":
      return "critical_best";
    case "excellent":
    case "very_good":
      return "excellent";
    case "good":
      return "good";
    case "book":
    case "playable":
      return "playable";
    case "inexact":
    case "to_review":
      return "imprecise";
    case "critical":
    case "decisive":
      return "severe";
    default:
      return "unknown";
  }
}
