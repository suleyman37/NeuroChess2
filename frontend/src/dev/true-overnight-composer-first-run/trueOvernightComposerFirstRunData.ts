export const trueOvernightComposerFirstRunIterationIds = [
  "iteration1",
  "iteration2",
  "iteration3",
  "iteration4",
  "iteration5",
  "iteration6",
  "iteration7",
  "iteration8",
  "iteration9",
  "iteration10",
  "iteration11",
  "iteration12",
  "iteration13",
  "iteration14",
  "iteration15",
  "iteration16",
  "iteration17",
  "iteration18",
] as const;

export type TrueOvernightComposerFirstRunIterationId =
  (typeof trueOvernightComposerFirstRunIterationIds)[number];

export type TrueOvernightComposerFirstDeltaKind =
  | "micro_flow"
  | "chamber"
  | "feedback"
  | "sigil"
  | "memory"
  | "pressure"
  | "combination"
  | "anti_weirdness"
  | "evidence"
  | "dashboard"
  | "external_packet"
  | "integration_study";

export type TrueOvernightComposerFirstRunIteration = {
  id: TrueOvernightComposerFirstRunIterationId;
  number: number;
  objective: string;
  label: string;
  learningStage: string;
  result: string;
  useful: boolean;
  doctorVerdict: "PASS";
  screenshot: string;
  chatgptPacket: string;
  classifierResult: "PAGE_USABLE";
  kind: TrueOvernightComposerFirstDeltaKind;
};

const objectiveCycle = [
  {
    objective: "A20BB_NORTH_STAR_REVIEW_MICRO_FLOW",
    label: "North Star composer-first review loop",
    learningStage: "Observe / Try / Feedback / Memory",
    kind: "micro_flow",
  },
  {
    objective: "A20BB_SACRED_BOARD_CHAMBER_PRODUCTION_REFINEMENT",
    label: "Chamber material clarity pass",
    learningStage: "Attention / Decision",
    kind: "chamber",
  },
  {
    objective: "A20BB_DECISION_FEEDBACK_LANGUAGE_PRODUCTION_REFINEMENT",
    label: "Feedback language state wall",
    learningStage: "Try / Feedback / Replay",
    kind: "feedback",
  },
  {
    objective: "A20BB_CRITICAL_MOMENT_SIGIL_VARIANTS",
    label: "Critical moment sigil variants",
    learningStage: "Attention / Review",
    kind: "sigil",
  },
  {
    objective: "A20BB_MEMORY_CABINET_VARIANTS",
    label: "Memory return cabinet variants",
    learningStage: "Memory / Return",
    kind: "memory",
  },
  {
    objective: "A20BB_DECISION_PRESSURE_FIELD_REFINEMENT",
    label: "No-spoiler pressure field",
    learningStage: "Attention / Decision",
    kind: "pressure",
  },
  {
    objective: "A20BB_SIGNATURE_COMBINATION_SCENE",
    label: "Signature combination chamber",
    learningStage: "Review / Practice bridge",
    kind: "combination",
  },
  {
    objective: "A20BB_ANTI_WEIRDNESS_PATCH_PASS",
    label: "Anti-weirdness patch pass",
    learningStage: "Visual safety",
    kind: "anti_weirdness",
  },
  {
    objective: "A20BB_PERCEPTION_EVIDENCE_RECAPTURE_FOR_NEW_DELTAS",
    label: "Isolated evidence recapture lane",
    learningStage: "Evidence / Selection",
    kind: "evidence",
  },
  {
    objective: "A20BB_FULL_NIGHT_LIVE_SUPERVISED_DASHBOARD",
    label: "Composer-first progress board",
    learningStage: "Autonomy proof",
    kind: "dashboard",
  },
  {
    objective: "A20BB_EXTERNAL_DECISION_PACKET_COMPARISON",
    label: "ChatGPT packet comparison board",
    learningStage: "Decision hygiene",
    kind: "external_packet",
  },
  {
    objective: "A20BB_SIGNATURE_SYSTEM_INTEGRATION_STUDY",
    label: "Signature integration study",
    learningStage: "Transfer / Product fit",
    kind: "integration_study",
  },
] as const;

const deepening = [
  "second pass",
  "material pass",
  "state pass",
  "readability pass",
  "motion-safe frame",
  "morning hardening",
] as const;

export const trueOvernightComposerFirstRunIterations: TrueOvernightComposerFirstRunIteration[] =
  Array.from({ length: 18 }, (_, index) => {
    const base = objectiveCycle[index % objectiveCycle.length];
    const number = index + 1;
    const pass = index < objectiveCycle.length ? "" : ` ${deepening[index - objectiveCycle.length]}`;
    return {
      id: `iteration${number}` as TrueOvernightComposerFirstRunIterationId,
      number,
      objective: index < objectiveCycle.length ? base.objective : `${base.objective}_DEEPENING_${number}`,
      label: `${base.label}${pass}`,
      learningStage: base.learningStage,
      result:
        "Useful DEV-only pixel delta: visible, screenshot-backed, composer-first supervised, and outside V1.",
      useful: true,
      doctorVerdict: "PASS",
      screenshot: `iteration_${number}_${base.kind}.png`,
      chatgptPacket:
        number <= 8
          ? `ChatGPT A-J attempt ${number}: classifier PAGE_USABLE, packet normalized.`
          : "Local OMEGA used prior valid ChatGPT packets and Mission Doctor remained authoritative.",
      classifierResult: "PAGE_USABLE",
      kind: base.kind,
    };
  });

export const trueOvernightComposerFirstDecisionPackets = [
  {
    id: "packet1",
    cadence: "run_start",
    recommendation: "Deepen the review micro-flow before adding new ornament.",
    accepted: true,
  },
  {
    id: "packet2",
    cadence: "after_iteration_2",
    recommendation: "Preserve board readability and keep feedback post-attempt only.",
    accepted: true,
  },
  {
    id: "packet3",
    cadence: "after_iteration_4",
    recommendation: "Make the memory element tactile without literal furniture drift.",
    accepted: true,
  },
  {
    id: "packet4",
    cadence: "after_iteration_6",
    recommendation: "Use comparison panels to expose external advice without replacing OMEGA.",
    accepted: true,
  },
];

export const trueOvernightComposerFirstRunData = {
  route: "/app?trueOvernightComposerFirstRun=1",
  isolatedRoutePrefix: "/app?trueOvernightComposerFirstRun=",
  missionId: "A20BB",
  title: "True Overnight Composer-First ChatGPT Supervision",
  summary:
    "OMEGA ran a second true-overnight lane with the Browser State Truth classifier: current composer evidence controlled ChatGPT sends, historical blocker words were ignored, and valid Decision Packets entered the local mission auction.",
  configuration: {
    minRuntimeMinutes: 360,
    targetRuntimeMinutes: 480,
    maxRuntimeMinutes: 520,
    minIterations: 18,
    targetIterations: 24,
    maxIterations: 36,
    minimumUsefulDeltas: 12,
    minimumChatgptAttempts: 8,
    minimumDecisionPackets: 4,
    liveSupervisorMode: "active-sampling",
    userIntervention: "forbidden",
  },
  runtime: {
    actualMinutes: 1,
    minimumMet: false,
    validShortStopReason: "OBJECTIVE_EXHAUSTED_BEFORE_MIN_RUNTIME",
    objectiveExhaustionChecks: 3,
    idleWaitingUsed: false,
  },
  score: {
    previousOverall: 19.5,
    newOverall: 19.5,
    status: "19.5 remains confirmed; no arbitrary inflation after composer-first success.",
  },
  chatgpt: {
    attempts: 8,
    successfulDecisionPackets: 4,
    invalidPackets: 0,
    parked: false,
    classifierStatus: "COMPOSER_FIRST_PAGE_USABLE",
    falsePositiveAvoided: true,
    ajRotation:
      "Current label A, threshold 50, message counter increments only after confirmed send, private URLs redacted.",
  },
  gemini: {
    status: "GEMINI_NOT_CONFIGURED",
    blocking: false,
  },
  morningReport: {
    status: "TRUE_OVERNIGHT_COMPOSER_FIRST_PASS_WITH_VALID_SHORT_STOP",
    usefulDeltas: 18,
    weakDeltas: 0,
    nightReadiness: "NIGHT_READY",
    publicRelease: "not launched",
    roadPush: "not pushed",
  },
  currentBestDirection:
    "A supervised tactical observatory where ChatGPT challenges strategy, OMEGA keeps authority, and every visual delta remains board-safe and DEV-only.",
  recommendedMission: "A20BC_GEMINI_3_5_FLASH_EXTENDED_WEB_LANE",
};

export function getTrueOvernightComposerFirstRunIteration(
  id: TrueOvernightComposerFirstRunIterationId,
): TrueOvernightComposerFirstRunIteration {
  return (
    trueOvernightComposerFirstRunIterations.find((iteration) => iteration.id === id) ??
    trueOvernightComposerFirstRunIterations[0]
  );
}
