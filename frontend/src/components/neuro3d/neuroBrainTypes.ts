export type BrainDomainKey =
  | "opening"
  | "tactical"
  | "plan"
  | "conversion"
  | "defense";

export type BrainDomainMetric = {
  key: BrainDomainKey;
  label: string;
  score: number;
  statusLabel?: string;
  summary?: string;
  priority?: boolean;
};

export type NeuroMonitorBrainData = {
  overallScore: number;
  overallLabel?: string;
  summary?: string;
  priorityDomain?: BrainDomainKey;
  recommendedExerciseLabel?: string;
  domains: BrainDomainMetric[];
};

export type BrainDomainVisual = BrainDomainMetric & {
  color: string;
  fill: string;
  glow: string;
  pulse: number;
  activity: number;
  status: string;
  position: {
    x: number;
    y: number;
    rx: number;
    ry: number;
    rotate: number;
  };
};

export const BRAIN_DOMAIN_ORDER: BrainDomainKey[] = [
  "opening",
  "tactical",
  "plan",
  "conversion",
  "defense",
];

export const demoNeuroMonitorBrainData: NeuroMonitorBrainData = {
  overallScore: 58,
  overallLabel: "NeuroChess",
  summary: "Démo visuelle : la carte met en avant les zones de décision à stabiliser.",
  priorityDomain: "tactical",
  recommendedExerciseLabel: "3 positions tactiques",
  domains: [
    {
      key: "opening",
      label: "Ouverture",
      score: 42,
      summary: "Repères de sortie encore instables.",
    },
    {
      key: "tactical",
      label: "Tactique",
      score: 28,
      summary: "Priorité : motifs forcing à revoir.",
      priority: true,
    },
    {
      key: "plan",
      label: "Plan (exploratoire)",
      score: 58,
      statusLabel: "Profil en construction",
      summary: "Signal de plan non calibré en V1.",
    },
    {
      key: "conversion",
      label: "Conversion",
      score: 74,
      summary: "Bon contrôle des positions favorables.",
    },
    {
      key: "defense",
      label: "Défense",
      score: 68,
      summary: "Ressources défensives globalement solides.",
    },
  ],
};
