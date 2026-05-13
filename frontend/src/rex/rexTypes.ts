export type RexSurfaceId = "qg" | "parties" | "forge" | "arene" | "profil";

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

export type RexSurfaceCopy = {
  id: RexSurfaceId;
  navLabel: string;
  testId: string;
  eyebrow: string;
  question: string;
  promise: string;
  emptyTitle: string;
  emptyBody: string;
  ctaLabel: string;
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
