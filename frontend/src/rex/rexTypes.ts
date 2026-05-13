export type RexSurfaceId = "qg" | "parties" | "forge" | "arene" | "profil";

export type RexSurfaceTone = "mission" | "source" | "forge" | "arena" | "profile";

export type RexVisualKind =
  | "mission-log"
  | "source-flow"
  | "forge-rings"
  | "arena-lanes"
  | "profile-map";

export type RexPreviewCard = {
  title: string;
  body: string;
  status: string;
};

export type RexMetricPreview = {
  label: string;
  value: string;
  note: string;
};

export type RexSignalPreview = {
  label: string;
  value: string;
};

export type RexSurfaceCopy = {
  id: RexSurfaceId;
  tone: RexSurfaceTone;
  visualKind: RexVisualKind;
  navLabel: string;
  testId: string;
  eyebrow: string;
  question: string;
  promise: string;
  commandTitle: string;
  commandBody: string;
  emptyTitle: string;
  emptyBody: string;
  ctaLabel: string;
  signals: RexSignalPreview[];
  flow: string[];
  cards: RexPreviewCard[];
  metrics: RexMetricPreview[];
  forbidden: string[];
};

export const REX_SURFACE_IDS: RexSurfaceId[] = [
  "qg",
  "parties",
  "forge",
  "arene",
  "profil",
];
