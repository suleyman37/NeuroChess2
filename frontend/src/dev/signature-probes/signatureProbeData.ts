export type SignatureProbeId =
  | "sacred_board_chamber"
  | "piece_identity_system"
  | "decision_feedback_language"
  | "critical_moment_sigil"
  | "verdict_wax_seal"
  | "aftermath_timeline"
  | "memory_cabinet"
  | "piece_breath"
  | "position_resonance"
  | "decision_pressure_field";

export type SignatureProbe = {
  id: SignatureProbeId;
  title: string;
  stage: string;
  intent: string;
  factualContribution: string;
  antiPattern: string;
  decorativeRisk: 0 | 1 | 2 | 3;
  boardReadabilityRisk: 0 | 1 | 2 | 3;
  accent: string;
  secondary: string;
};

export const signatureProbes: SignatureProbe[] = [
  {
    id: "sacred_board_chamber",
    title: "Sacred Board Chamber",
    stage: "Review focus",
    intent: "A strict board core held by a richer surrounding room.",
    factualContribution: "Separates legal-square reading from atmosphere.",
    antiPattern: "Do not distort, tilt, glow, or cover playable squares.",
    decorativeRisk: 1,
    boardReadabilityRisk: 0,
    accent: "hsl(168 72% 58%)",
    secondary: "hsl(42 78% 62%)",
  },
  {
    id: "piece_identity_system",
    title: "Piece Identity System",
    stage: "Position reading",
    intent: "Three restrained piece languages that stay legible at board scale.",
    factualContribution: "Tests whether identity can feel owned without hurting recognition.",
    antiPattern: "No ornamental pieces that require relearning chess shapes.",
    decorativeRisk: 2,
    boardReadabilityRisk: 1,
    accent: "hsl(202 80% 64%)",
    secondary: "hsl(8 78% 66%)",
  },
  {
    id: "decision_feedback_language",
    title: "Decision Feedback Language",
    stage: "Post-attempt feedback",
    intent: "Feedback traces appear only after the learner commits.",
    factualContribution: "Keeps pre-feedback states free of hints.",
    antiPattern: "No destination arrows before an attempt is graded.",
    decorativeRisk: 1,
    boardReadabilityRisk: 1,
    accent: "hsl(132 68% 58%)",
    secondary: "hsl(254 72% 72%)",
  },
  {
    id: "critical_moment_sigil",
    title: "Critical Moment Sigil",
    stage: "Moment selection",
    intent: "A procedural mark for why this position deserves attention.",
    factualContribution: "Turns importance into a readable badge, not a hidden formula.",
    antiPattern: "Do not expose raw criticality or engine internals.",
    decorativeRisk: 2,
    boardReadabilityRisk: 0,
    accent: "hsl(322 74% 66%)",
    secondary: "hsl(184 72% 58%)",
  },
  {
    id: "verdict_wax_seal",
    title: "Verdict Wax Seal",
    stage: "Feedback verdict",
    intent: "A compact post-feedback verdict that feels tactile and calm.",
    factualContribution: "Makes result state memorable without gamified noise.",
    antiPattern: "No fake rank, reward currency, or exaggerated celebration.",
    decorativeRisk: 2,
    boardReadabilityRisk: 0,
    accent: "hsl(352 76% 62%)",
    secondary: "hsl(44 72% 63%)",
  },
  {
    id: "aftermath_timeline",
    title: "Aftermath Timeline",
    stage: "Review reflection",
    intent: "A match timeline with scars where decisions changed the game.",
    factualContribution: "Connects one training moment to game consequence.",
    antiPattern: "No spoiler-rich eval bar before the player has worked.",
    decorativeRisk: 1,
    boardReadabilityRisk: 0,
    accent: "hsl(26 82% 62%)",
    secondary: "hsl(216 80% 66%)",
  },
  {
    id: "memory_cabinet",
    title: "Memory Cabinet",
    stage: "Revision",
    intent: "A compact cabinet abstraction for remembered patterns.",
    factualContribution: "Gives revision items a stable visual home.",
    antiPattern: "No literal furniture scene or nostalgia-first decoration.",
    decorativeRisk: 2,
    boardReadabilityRisk: 0,
    accent: "hsl(286 60% 68%)",
    secondary: "hsl(150 58% 58%)",
  },
  {
    id: "piece_breath",
    title: "Piece Breath",
    stage: "Quiet attention",
    intent: "Subtle CSS-only motion that makes pieces feel alive after focus.",
    factualContribution: "Tests motion as attention support, not a hint system.",
    antiPattern: "No moving target, hover lure, or pre-move suggestion.",
    decorativeRisk: 3,
    boardReadabilityRisk: 1,
    accent: "hsl(184 70% 62%)",
    secondary: "hsl(58 76% 62%)",
  },
  {
    id: "position_resonance",
    title: "Position Resonance",
    stage: "Transfer",
    intent: "A subtle link between two similar positions after feedback.",
    factualContribution: "Shows transferable structure without claiming mastery.",
    antiPattern: "No transfer score or fake certainty before calibration.",
    decorativeRisk: 2,
    boardReadabilityRisk: 1,
    accent: "hsl(232 78% 70%)",
    secondary: "hsl(160 68% 60%)",
  },
  {
    id: "decision_pressure_field",
    title: "Decision Pressure Field",
    stage: "Attempt pressure",
    intent: "Peripheral pressure outside the board, with no eval-bar spoiler.",
    factualContribution: "Makes difficulty felt while protecting the answer.",
    antiPattern: "No green/red engine bar or best-move implication.",
    decorativeRisk: 2,
    boardReadabilityRisk: 1,
    accent: "hsl(14 84% 64%)",
    secondary: "hsl(196 76% 64%)",
  },
];
