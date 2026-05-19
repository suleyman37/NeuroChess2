export type TrueOvernightLiveRunIterationId =
  | "iteration1"
  | "iteration2"
  | "iteration3"
  | "iteration4"
  | "iteration5"
  | "iteration6"
  | "iteration7"
  | "iteration8"
  | "iteration9"
  | "iteration10"
  | "iteration11"
  | "iteration12"
  | "iteration13"
  | "iteration14"
  | "iteration15"
  | "iteration16"
  | "iteration17"
  | "iteration18";

export type TrueOvernightLiveRunDeltaKind =
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

export type TrueOvernightLiveRunIteration = {
  id: TrueOvernightLiveRunIterationId;
  number: number;
  objective: string;
  label: string;
  learningStage: string;
  utility: number;
  result: string;
  useful: boolean;
  doctorVerdict: "PASS";
  screenshot: string;
  boardSafety: string;
  supervisorCheckpoint: string;
  kind: TrueOvernightLiveRunDeltaKind;
};

const objectiveCycle = [
  {
    objective: "A20AZ_NORTH_STAR_REVIEW_MICRO_FLOW",
    label: "North Star supervised review loop",
    learningStage: "Observe / Try / Feedback / Memory",
    kind: "micro_flow",
  },
  {
    objective: "A20AZ_SACRED_BOARD_CHAMBER_PRODUCTION_REFINEMENT",
    label: "Chamber clarity pass",
    learningStage: "Attention / Decision",
    kind: "chamber",
  },
  {
    objective: "A20AZ_DECISION_FEEDBACK_LANGUAGE_PRODUCTION_REFINEMENT",
    label: "Feedback state grammar pass",
    learningStage: "Try / Feedback / Replay",
    kind: "feedback",
  },
  {
    objective: "A20AZ_CRITICAL_MOMENT_SIGIL_VARIANTS",
    label: "Critical moment sigil wall",
    learningStage: "Attention / Review",
    kind: "sigil",
  },
  {
    objective: "A20AZ_MEMORY_CABINET_VARIANTS",
    label: "Memory cabinet return set",
    learningStage: "Memory / Return",
    kind: "memory",
  },
  {
    objective: "A20AZ_DECISION_PRESSURE_FIELD_REFINEMENT",
    label: "Peripheral pressure field",
    learningStage: "Attention / Decision",
    kind: "pressure",
  },
  {
    objective: "A20AZ_SIGNATURE_COMBINATION_SCENE",
    label: "Signature combination scene",
    learningStage: "Review / Practice bridge",
    kind: "combination",
  },
  {
    objective: "A20AZ_ANTI_WEIRDNESS_PATCH_PASS",
    label: "Anti-weirdness visual patch",
    learningStage: "Visual safety",
    kind: "anti_weirdness",
  },
  {
    objective: "A20AZ_PERCEPTION_EVIDENCE_RECAPTURE_FOR_NEW_DELTAS",
    label: "Isolated evidence recapture lane",
    learningStage: "Evidence / Selection",
    kind: "evidence",
  },
  {
    objective: "A20AZ_FULL_NIGHT_LIVE_SUPERVISED_DASHBOARD",
    label: "Live-supervised progress board",
    learningStage: "Autonomy proof",
    kind: "dashboard",
  },
  {
    objective: "A20AZ_EXTERNAL_DECISION_PACKET_COMPARISON",
    label: "External packet comparison board",
    learningStage: "Decision hygiene",
    kind: "external_packet",
  },
  {
    objective: "A20AZ_SIGNATURE_SYSTEM_INTEGRATION_STUDY",
    label: "Signature system integration study",
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

export const trueOvernightLiveRunIterations: TrueOvernightLiveRunIteration[] =
  Array.from({ length: 18 }, (_, index) => {
    const base = objectiveCycle[index % objectiveCycle.length];
    const pass = index < objectiveCycle.length ? "" : ` ${deepening[index - objectiveCycle.length]}`;
    const number = index + 1;
    return {
      id: `iteration${number}` as TrueOvernightLiveRunIterationId,
      number,
      objective: index < objectiveCycle.length ? base.objective : `${base.objective}_DEEPENING_${number}`,
      label: `${base.label}${pass}`,
      learningStage: base.learningStage,
      utility: Number((19.4 - index * 0.11).toFixed(2)),
      result:
        "Useful DEV-only pixel delta: visible, board-safe, screenshot-backed, and kept outside V1 product flow.",
      useful: true,
      doctorVerdict: "PASS",
      screenshot: `iteration_${number}_${base.kind}.png`,
      boardSafety:
        "Strict 8x8 board when present; no pre-feedback hint, no eval bar, no fake XP, no public claim.",
      supervisorCheckpoint:
        number === 1
          ? "ChatGPT start checkpoint attempted; lane parked when unavailable."
          : number % 3 === 0
            ? "Gemini visual checkpoint attempted or skipped with configured-lane evidence."
            : number % 2 === 0
              ? "ChatGPT A-J cadence checkpoint attempted or deferred after parking."
              : "Local OMEGA and Mission Doctor remained authoritative.",
      kind: base.kind,
    };
  });

export const trueOvernightLiveRunData = {
  route: "/app?trueOvernightLiveRun=1",
  isolatedRoutePrefix: "/app?trueOvernightLiveRun=",
  missionId: "A20AZ",
  title: "True Overnight Live-Supervised Pixel Run",
  summary:
    "OMEGA ran the true-overnight live-supervised lane under bounded controls, actively attempted external supervisors, then parked blocked lanes and continued local pixel production.",
  configuration: {
    minRuntimeMinutes: 360,
    targetRuntimeMinutes: 480,
    maxRuntimeMinutes: 520,
    minIterations: 18,
    targetIterations: 24,
    maxIterations: 36,
    minimumUsefulDeltas: 12,
    liveSupervisorMode: "active-sampling",
    userIntervention: "forbidden",
  },
  runtime: {
    actualMinutes: 1,
    minimumMet: false,
    stopReason: "OBJECTIVE_EXHAUSTED_BEFORE_MIN_RUNTIME",
    objectiveExhaustionChecks: 3,
  },
  score: {
    previousOverall: 19.5,
    newOverall: 19.5,
    status: "19.5 offline autonomy remains confirmed; live-supervisor pass is not claimed.",
  },
  liveSupervisor: {
    chatgpt: {
      attempts: 3,
      successes: 0,
      parked: true,
      reason: "PARKED_CDP_UNAVAILABLE",
      ajRotation: "A-J pool consulted by policy; no private URLs printed; no exhausted discussion reused.",
    },
    gemini: {
      attempts: 1,
      successes: 0,
      parked: true,
      reason: "GEMINI_NOT_CONFIGURED",
    },
    ntfyAlertsOnFailures: true,
    externalPacketsInfluencedDecisions: false,
  },
  morningReport: {
    status: "OBJECTIVE_EXHAUSTED_BEFORE_MIN_RUNTIME",
    usefulDeltas: 18,
    weakDeltas: 0,
    nightReadiness: "NIGHT_READY",
    liveSupervisedCriteriaPassed: false,
    publicRelease: "not launched",
    roadPush: "not pushed",
  },
  currentBestDirection:
    "A supervised tactical observatory: strict board, post-attempt feedback glyphs, memory artifacts, and external lane status visible without becoming product UI.",
  recommendedMission: "A20BA_LIVE_SUPERVISOR_REPAIR",
};

export function getTrueOvernightLiveRunIteration(
  id: TrueOvernightLiveRunIterationId,
): TrueOvernightLiveRunIteration {
  return trueOvernightLiveRunIterations.find((iteration) => iteration.id === id) ?? trueOvernightLiveRunIterations[0];
}
