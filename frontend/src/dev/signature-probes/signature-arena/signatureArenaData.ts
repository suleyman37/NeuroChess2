export type SignatureArenaSignatureId =
  | "sacred_board_chamber"
  | "decision_feedback_language";

export type SignatureArenaVariantId = "A" | "B" | "C";

export type SignatureArenaVariant = {
  signatureId: SignatureArenaSignatureId;
  variantId: SignatureArenaVariantId;
  componentName: string;
  variantName: string;
  route: string;
  stage: string;
  concept: string;
  learningContribution: string;
  boardSafety: string;
  riskNote: string;
  antiPatternAvoided: string;
  boardVisible: true;
  accent: string;
  secondary: string;
  material: string;
  preliminaryScore: number;
  scores: {
    visualIdentity: number;
    boardSafety: number;
    learningLoop: number;
    antiGeneric: number;
    feasibility: number;
    memoryImpact: number;
    integrationRisk: number;
  };
};

export const signatureArenaSignatureIds: SignatureArenaSignatureId[] = [
  "sacred_board_chamber",
  "decision_feedback_language",
];

export const signatureArenaVariantIds: SignatureArenaVariantId[] = ["A", "B", "C"];

export const selectedSignatureFive = [
  "sacred_board_chamber",
  "decision_feedback_language",
  "critical_moment_sigil",
  "decision_pressure_field",
  "memory_cabinet",
];

export const signatureArenaVariants: SignatureArenaVariant[] = [
  {
    signatureId: "sacred_board_chamber",
    variantId: "A",
    componentName: "Sacred Board Chamber",
    variantName: "Premium Clarity",
    route: "/app?signature=sacred_board_chamber&variant=A",
    stage: "Attention / Decision",
    concept: "A quiet lacquer chamber keeps the board dominant and the frame calm.",
    learningContribution: "Makes the current decision surface unmistakable without adding hint semantics.",
    boardSafety: "The board is strict 8x8; all chamber material sits outside the squares.",
    riskNote: "Lowest risk, slightly less ownable than the stronger variants.",
    antiPatternAvoided: "No fog, no tilted board, no move arrows, no generic dashboard shell.",
    boardVisible: true,
    accent: "hsl(168 72% 58%)",
    secondary: "hsl(42 78% 62%)",
    material: "brushed obsidian and warm brass rails",
    preliminaryScore: 4.42,
    scores: {
      visualIdentity: 4.1,
      boardSafety: 5,
      learningLoop: 4.4,
      antiGeneric: 4.1,
      feasibility: 4.9,
      memoryImpact: 3.9,
      integrationRisk: 4.7,
    },
  },
  {
    signatureId: "sacred_board_chamber",
    variantId: "B",
    componentName: "Sacred Board Chamber",
    variantName: "Signature Identity",
    route: "/app?signature=sacred_board_chamber&variant=B",
    stage: "Attention / Decision",
    concept: "A stronger ritual frame gives the board a NeuroChess artifact identity.",
    learningContribution: "Turns focus into a recognizable Review chamber while preserving legal-square clarity.",
    boardSafety: "Atmospheric ribs, anchors, and meters remain outside the playable grid.",
    riskNote: "Best balance of ownable identity and implementation safety.",
    antiPatternAvoided: "No sci-fi clutter, no square overlays, no pre-feedback solution cue.",
    boardVisible: true,
    accent: "hsl(172 76% 56%)",
    secondary: "hsl(35 86% 61%)",
    material: "dark glass, brass instrument ribs, and inked stone",
    preliminaryScore: 4.68,
    scores: {
      visualIdentity: 4.8,
      boardSafety: 4.8,
      learningLoop: 4.6,
      antiGeneric: 4.8,
      feasibility: 4.5,
      memoryImpact: 4.5,
      integrationRisk: 4.4,
    },
  },
  {
    signatureId: "sacred_board_chamber",
    variantId: "C",
    componentName: "Sacred Board Chamber",
    variantName: "Radical Candidate",
    route: "/app?signature=sacred_board_chamber&variant=C",
    stage: "Attention / Decision",
    concept: "A deep decision chamber with peripheral pressure gates and heavier stage depth.",
    learningContribution: "Creates a memorable state of entering a consequential decision.",
    boardSafety: "The board stays flat and clean; pressure forms stop at the chamber edge.",
    riskNote: "Highest visual upside, but needs restraint before production integration.",
    antiPatternAvoided: "No fog over squares, no fantasy board distortion, no gimmicky neon.",
    boardVisible: true,
    accent: "hsl(14 84% 64%)",
    secondary: "hsl(184 72% 58%)",
    material: "charcoal stage, pressure enamel, and cool mineral light",
    preliminaryScore: 4.31,
    scores: {
      visualIdentity: 5,
      boardSafety: 4.1,
      learningLoop: 4.5,
      antiGeneric: 4.9,
      feasibility: 3.7,
      memoryImpact: 4.8,
      integrationRisk: 3.4,
    },
  },
  {
    signatureId: "decision_feedback_language",
    variantId: "A",
    componentName: "Decision Feedback Language",
    variantName: "Premium Clarity",
    route: "/app?signature=decision_feedback_language&variant=A",
    stage: "Try / Feedback / Replay",
    concept: "Three plain post-attempt states use restrained markers and readable boards.",
    learningContribution: "Separates no-spoiler, success, and miss states with minimal visual burden.",
    boardSafety: "Before-attempt state is clean; traces appear only in post-feedback panels.",
    riskNote: "Most usable, but less memorable than the stronger glyph variant.",
    antiPatternAvoided: "No pre-attempt arrows, no humiliation, no XP, no reward badge.",
    boardVisible: true,
    accent: "hsl(132 68% 58%)",
    secondary: "hsl(42 78% 62%)",
    material: "paper-thin trace plates and calm verdict rails",
    preliminaryScore: 4.39,
    scores: {
      visualIdentity: 4,
      boardSafety: 4.9,
      learningLoop: 4.9,
      antiGeneric: 4,
      feasibility: 4.9,
      memoryImpact: 3.8,
      integrationRisk: 4.5,
    },
  },
  {
    signatureId: "decision_feedback_language",
    variantId: "B",
    componentName: "Decision Feedback Language",
    variantName: "Signature Identity",
    route: "/app?signature=decision_feedback_language&variant=B",
    stage: "Try / Feedback / Replay",
    concept: "A serious glyph language marks committed decisions with traces and verdict cells.",
    learningContribution: "Makes the Try -> Feedback transition visible and repeatable without spoiling the move.",
    boardSafety: "The no-spoiler lane is empty; success and miss traces are visibly after the attempt.",
    riskNote: "Best balance of NeuroChess identity, clarity, and real product usefulness.",
    antiPatternAvoided: "No green/red engine bar, no cheap celebration, no answer-before-try clue.",
    boardVisible: true,
    accent: "hsl(160 72% 58%)",
    secondary: "hsl(254 72% 72%)",
    material: "ink glyphs, thin luminous trace, and sealed feedback cells",
    preliminaryScore: 4.64,
    scores: {
      visualIdentity: 4.7,
      boardSafety: 4.6,
      learningLoop: 5,
      antiGeneric: 4.7,
      feasibility: 4.5,
      memoryImpact: 4.4,
      integrationRisk: 4.2,
    },
  },
  {
    signatureId: "decision_feedback_language",
    variantId: "C",
    componentName: "Decision Feedback Language",
    variantName: "Radical Candidate",
    route: "/app?signature=decision_feedback_language&variant=C",
    stage: "Try / Feedback / Replay",
    concept: "A ritual trace system combines sigil, seal, and move aftermath into one feedback moment.",
    learningContribution: "Turns feedback into a memorable replay object after the learner commits.",
    boardSafety: "The bolder ritual marks sit around or after the board, never before the attempt.",
    riskNote: "Memorable, but needs semantic pruning to avoid feeling decorative.",
    antiPatternAvoided: "No cartoon badge, no fake rank, no visual punishment, no pre-feedback solution.",
    boardVisible: true,
    accent: "hsl(322 74% 66%)",
    secondary: "hsl(184 72% 58%)",
    material: "ritual ink, etched feedback seal, and replay trace",
    preliminaryScore: 4.22,
    scores: {
      visualIdentity: 4.9,
      boardSafety: 4,
      learningLoop: 4.7,
      antiGeneric: 4.8,
      feasibility: 3.5,
      memoryImpact: 4.9,
      integrationRisk: 3.2,
    },
  },
];

export function getSignatureArenaVariant(
  signatureId: SignatureArenaSignatureId,
  variantId: SignatureArenaVariantId,
): SignatureArenaVariant {
  return (
    signatureArenaVariants.find(
      (variant) => variant.signatureId === signatureId && variant.variantId === variantId,
    ) ?? signatureArenaVariants[0]
  );
}
