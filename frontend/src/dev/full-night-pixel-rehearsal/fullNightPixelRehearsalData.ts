export type FullNightIterationId =
  | "iteration1"
  | "iteration2"
  | "iteration3"
  | "iteration4"
  | "iteration5"
  | "iteration6"
  | "iteration7"
  | "iteration8";

export type FullNightDeltaKind =
  | "chamber"
  | "feedback"
  | "sigil"
  | "memory"
  | "pressure"
  | "combination"
  | "micro_flow"
  | "progress";

export type FullNightRehearsalIteration = {
  id: FullNightIterationId;
  number: number;
  objective: string;
  label: string;
  selectedBy: string;
  utility: number;
  result: string;
  useful: boolean;
  doctorVerdict: "PASS" | "PARTIAL";
  screenshot: string;
  scoreDelta: string;
  kind: FullNightDeltaKind;
};

export const fullNightIterations: FullNightRehearsalIteration[] = [
  {
    id: "iteration1",
    number: 1,
    objective: "A20AW_REFINE_SACRED_BOARD_CHAMBER_PRODUCTION_CANDIDATE",
    label: "Sacred Board Chamber production candidate",
    selectedBy: "OMEGA utility engine",
    utility: 18.4,
    result: "Pixel delta 1: product-grade board chamber with stricter frame hierarchy.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "screenshots/iteration_1_chamber_candidate.png",
    scoreDelta: "+0.03 visual production",
    kind: "chamber",
  },
  {
    id: "iteration2",
    number: 2,
    objective: "A20AW_REFINE_DECISION_FEEDBACK_LANGUAGE_PRODUCTION_CANDIDATE",
    label: "Decision Feedback Language production candidate",
    selectedBy: "OMEGA utility engine",
    utility: 18.2,
    result: "Pixel delta 2: no-spoiler, success, miss, and replay feedback states.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "screenshots/iteration_2_feedback_candidate.png",
    scoreDelta: "+0.03 visual production",
    kind: "feedback",
  },
  {
    id: "iteration3",
    number: 3,
    objective: "A20AW_BUILD_SIGNATURE_COMBINATION_SCENE",
    label: "Signature combination scene",
    selectedBy: "OMEGA utility engine",
    utility: 17.8,
    result: "Pixel delta 3: chamber, feedback, sigil, and memory elements in one scene.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "screenshots/iteration_3_signature_combination_scene.png",
    scoreDelta: "+0.03 North Star coherence",
    kind: "combination",
  },
  {
    id: "iteration4",
    number: 4,
    objective: "A20AW_BUILD_NORTH_STAR_REVIEW_MICRO_FLOW",
    label: "North Star Review micro-flow",
    selectedBy: "OMEGA utility engine",
    utility: 17.5,
    result: "Pixel delta 4: observe -> try -> feedback -> memory flow with signature language.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "screenshots/iteration_4_north_star_review_micro_flow.png",
    scoreDelta: "+0.04 autonomy proof",
    kind: "micro_flow",
  },
  {
    id: "iteration5",
    number: 5,
    objective: "A20AW_BUILD_CRITICAL_MOMENT_SIGIL_VARIANTS",
    label: "Critical Moment Sigil variants",
    selectedBy: "OMEGA utility engine",
    utility: 17.1,
    result: "Pixel delta 5: three procedural sigil directions for critical moments.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "screenshots/iteration_5_critical_moment_sigil.png",
    scoreDelta: "+0.02 art direction",
    kind: "sigil",
  },
  {
    id: "iteration6",
    number: 6,
    objective: "A20AW_BUILD_MEMORY_CABINET_VARIANTS",
    label: "Memory Cabinet variants",
    selectedBy: "OMEGA utility engine",
    utility: 16.7,
    result: "Pixel delta 6: memory/return cards that avoid literal furniture.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "screenshots/iteration_6_memory_cabinet.png",
    scoreDelta: "+0.02 learning loop",
    kind: "memory",
  },
  {
    id: "iteration7",
    number: 7,
    objective: "A20AW_BUILD_DECISION_PRESSURE_FIELD_VARIANTS",
    label: "Decision Pressure Field variants",
    selectedBy: "OMEGA utility engine",
    utility: 16.5,
    result: "Pixel delta 7: peripheral pressure fields without eval-bar spoilers.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "screenshots/iteration_7_decision_pressure_field.png",
    scoreDelta: "+0.02 board-adjacent safety",
    kind: "pressure",
  },
  {
    id: "iteration8",
    number: 8,
    objective: "A20AW_BUILD_PIXEL_REHEARSAL_PROGRESS_BOARD",
    label: "Pixel rehearsal progress board",
    selectedBy: "OMEGA utility engine",
    utility: 15.8,
    result: "Pixel delta 8: final night output board with deltas, verdicts, and next decision.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "screenshots/iteration_8_progress_board.png",
    scoreDelta: "+0.03 night readiness",
    kind: "progress",
  },
];

export const fullNightPixelRehearsalData = {
  route: "/app?fullNightPixelRehearsal=1",
  isolatedRoutePrefix: "/app?fullNightPixelRehearsal=",
  missionId: "A20AW",
  title: "Full Night Pixel Rehearsal",
  summary:
    "OMEGA ran an 8-iteration, no-live-web, no-user full-night pixel rehearsal candidate.",
  configuration: {
    maxIterations: 8,
    maxRuntimeMinutes: 480,
    liveWeb: "disabled",
    userIntervention: "forbidden",
    minimumPixelDeltas: 5,
    usefulPixelDeltas: 8,
  },
  score: {
    previousOverall: 19.35,
    newOverall: 19.5,
    visualProduction: "18.8 -> 19.0",
    autonomy: "19.2 -> 19.5",
    nightReadiness: "19.2 -> 19.5",
    candidateStatus: "19.5 candidate, rehearsal only",
  },
  omegaDecision: {
    primaryBottleneck: "full_night_pixel_proof",
    activeMandate: "pixel_mandate",
    rejectedLanes: ["live_web", "gmail", "ntfy", "pure_docs", "new_framework"],
    nextObjective: "A20AX_FULL_NIGHT_REAL_RUN",
  },
  currentBestDirection:
    "A board-safe chamber core, serious post-attempt feedback language, and memory/sigil support objects.",
  nightReadinessVerdict: "NIGHT_READY",
  recommendedMission: "A20AX_FULL_NIGHT_REAL_RUN",
};

export function getFullNightIteration(id: FullNightIterationId): FullNightRehearsalIteration {
  return fullNightIterations.find((iteration) => iteration.id === id) ?? fullNightIterations[0];
}
