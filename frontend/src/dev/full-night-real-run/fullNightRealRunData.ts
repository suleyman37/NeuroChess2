export type FullNightRealRunIterationId =
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
  | "iteration12";

export type FullNightRealRunDeltaKind =
  | "north_star"
  | "chamber"
  | "feedback"
  | "sigil"
  | "memory"
  | "pressure"
  | "combination"
  | "anti_weirdness"
  | "dashboard"
  | "evidence"
  | "flow_second_pass"
  | "morning_board";

export type FullNightRealRunIteration = {
  id: FullNightRealRunIterationId;
  number: number;
  objective: string;
  label: string;
  learningStage: string;
  selectedBy: string;
  utility: number;
  result: string;
  useful: boolean;
  doctorVerdict: "PASS";
  screenshot: string;
  scoreDelta: string;
  boardSafety: string;
  kind: FullNightRealRunDeltaKind;
};

export const fullNightRealRunIterations: FullNightRealRunIteration[] = [
  {
    id: "iteration1",
    number: 1,
    objective: "A20AY_NORTH_STAR_REVIEW_MICRO_FLOW",
    label: "North Star review micro-flow",
    learningStage: "Observe -> Try -> Feedback -> Memory",
    selectedBy: "OMEGA utility engine",
    utility: 19.1,
    result: "Pixel delta 1: a full review loop scene that keeps the board central and the feedback post-attempt.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "iteration_1_north_star_review_micro_flow.png",
    scoreDelta: "19.5 confirmed proof",
    boardSafety: "strict 8x8 board; no pre-feedback hint",
    kind: "north_star",
  },
  {
    id: "iteration2",
    number: 2,
    objective: "A20AY_SACRED_BOARD_CHAMBER_PRODUCTION_REFINEMENT",
    label: "Sacred chamber production refinement",
    learningStage: "Attention / Decision",
    selectedBy: "OMEGA utility engine",
    utility: 18.9,
    result: "Pixel delta 2: a calmer product-grade chamber frame with richer side-world material.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "iteration_2_sacred_board_chamber_refinement.png",
    scoreDelta: "visual production confirmed",
    boardSafety: "atmosphere stays outside playable squares",
    kind: "chamber",
  },
  {
    id: "iteration3",
    number: 3,
    objective: "A20AY_DECISION_FEEDBACK_LANGUAGE_PRODUCTION_REFINEMENT",
    label: "Decision feedback language production refinement",
    learningStage: "Try / Feedback / Replay",
    selectedBy: "OMEGA utility engine",
    utility: 18.7,
    result: "Pixel delta 3: no-spoiler, success, miss, and replay states share one serious glyph grammar.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "iteration_3_decision_feedback_refinement.png",
    scoreDelta: "feedback language confirmed",
    boardSafety: "feedback marks appear only after attempt",
    kind: "feedback",
  },
  {
    id: "iteration4",
    number: 4,
    objective: "A20AY_CRITICAL_MOMENT_SIGIL_VARIANTS",
    label: "Critical moment sigil variants",
    learningStage: "Attention / Review",
    selectedBy: "OMEGA utility engine",
    utility: 18.4,
    result: "Pixel delta 4: three moment marks that feel specific without exposing raw criticality.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "iteration_4_critical_moment_sigil_variants.png",
    scoreDelta: "art direction proof",
    boardSafety: "sigils sit outside the board",
    kind: "sigil",
  },
  {
    id: "iteration5",
    number: 5,
    objective: "A20AY_MEMORY_CABINET_VARIANTS",
    label: "Memory cabinet variants",
    learningStage: "Memory / Return",
    selectedBy: "OMEGA utility engine",
    utility: 18.2,
    result: "Pixel delta 5: remembered patterns become compact evidence objects instead of generic cards.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "iteration_5_memory_cabinet_variants.png",
    scoreDelta: "memory loop proof",
    boardSafety: "memory objects do not alter legal squares",
    kind: "memory",
  },
  {
    id: "iteration6",
    number: 6,
    objective: "A20AY_DECISION_PRESSURE_FIELD_REFINEMENT",
    label: "Decision pressure field refinement",
    learningStage: "Attention / Decision",
    selectedBy: "OMEGA utility engine",
    utility: 18.0,
    result: "Pixel delta 6: peripheral pressure rails add urgency without becoming an eval bar.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "iteration_6_decision_pressure_field_refinement.png",
    scoreDelta: "board-adjacent safety proof",
    boardSafety: "no arrows, no color-coded best move, no outcome spoiler",
    kind: "pressure",
  },
  {
    id: "iteration7",
    number: 7,
    objective: "A20AY_SIGNATURE_COMBINATION_SCENE",
    label: "Signature combination scene",
    learningStage: "Review / Practice bridge",
    selectedBy: "OMEGA utility engine",
    utility: 17.8,
    result: "Pixel delta 7: chamber, feedback, sigil, memory, and pressure form a coherent visual system.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "iteration_7_signature_combination_scene.png",
    scoreDelta: "North Star coherence proof",
    boardSafety: "signature elements orbit the board instead of covering it",
    kind: "combination",
  },
  {
    id: "iteration8",
    number: 8,
    objective: "A20AY_ANTI_WEIRDNESS_PATCH_PASS",
    label: "Anti-weirdness patch pass",
    learningStage: "Visual safety",
    selectedBy: "OMEGA meta-drift guard",
    utility: 17.5,
    result: "Pixel delta 8: risky glow/noise is replaced with readable instrument material.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "iteration_8_anti_weirdness_patch_pass.png",
    scoreDelta: "weirdness risk reduced",
    boardSafety: "patch removes visual clutter from the board edge",
    kind: "anti_weirdness",
  },
  {
    id: "iteration9",
    number: 9,
    objective: "A20AY_FULL_NIGHT_REHEARSAL_DASHBOARD",
    label: "Full-night run progress board",
    learningStage: "Autonomy proof",
    selectedBy: "OMEGA utility engine",
    utility: 17.2,
    result: "Pixel delta 9: a DEV-only progress board summarizes objectives, proof, verdicts, and next action.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "iteration_9_full_night_progress_board.png",
    scoreDelta: "night report readiness proof",
    boardSafety: "dashboard is separate from product V1 flow",
    kind: "dashboard",
  },
  {
    id: "iteration10",
    number: 10,
    objective: "A20AY_PERCEPTION_EVIDENCE_RECAPTURE_FOR_NEW_DELTAS",
    label: "Perception evidence recap wall",
    learningStage: "Evidence / Selection",
    selectedBy: "OMEGA proof contract",
    utility: 16.9,
    result: "Pixel delta 10: an evidence wall makes screenshot paths and proof status visible without using contact sheets as primary evidence.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "iteration_10_perception_evidence_recap.png",
    scoreDelta: "evidence quality confirmed",
    boardSafety: "one delta per primary screenshot",
    kind: "evidence",
  },
  {
    id: "iteration11",
    number: 11,
    objective: "A20AY_NORTH_STAR_REVIEW_MICRO_FLOW_SECOND_PASS",
    label: "North Star flow second pass",
    learningStage: "Try / Replay / Memory",
    selectedBy: "OMEGA adaptation step",
    utility: 16.6,
    result: "Pixel delta 11: the loop adds a replay lane that remains clearly separate from pre-attempt hints.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "iteration_11_north_star_second_pass.png",
    scoreDelta: "loop clarity proof",
    boardSafety: "replay state is post-feedback only",
    kind: "flow_second_pass",
  },
  {
    id: "iteration12",
    number: 12,
    objective: "A20AY_MORNING_REPORT_PIXEL_BOARD",
    label: "Morning report pixel board",
    learningStage: "Handoff / Review",
    selectedBy: "OMEGA drain state",
    utility: 16.3,
    result: "Pixel delta 12: a visual handoff board closes the run with useful-delta count, screenshots, and go/no-go status.",
    useful: true,
    doctorVerdict: "PASS",
    screenshot: "iteration_12_morning_report_pixel_board.png",
    scoreDelta: "handoff proof",
    boardSafety: "no public release or product integration claim",
    kind: "morning_board",
  },
];

export const fullNightRealRunData = {
  route: "/app?fullNightRealRun=1",
  isolatedRoutePrefix: "/app?fullNightRealRun=",
  missionId: "A20AY",
  title: "Full Night Real Pixel Run",
  summary:
    "OMEGA completed a bounded, no-live-web, no-user full-night pixel run with DEV-only visual deltas.",
  configuration: {
    maxIterations: 12,
    maxRuntimeMinutes: 480,
    liveWeb: "disabled",
    userIntervention: "forbidden",
    minimumPixelDeltas: 6,
    usefulPixelDeltas: 12,
    stretchPixelDeltas: 10,
  },
  score: {
    previousOverall: 19.5,
    newOverall: 19.5,
    visualProduction: "19.0 confirmed",
    autonomy: "19.5 confirmed",
    nightReadiness: "19.5 confirmed",
    status: "19.5 confirmed by full-night real-run proof",
  },
  omegaDecision: {
    primaryBottleneck: "real_full_night_pixel_confirmation",
    activeMandate: "pixel_mandate_confirmed",
    rejectedLanes: ["live_web", "gmail", "ntfy_fixes", "pure_docs", "backend", "package"],
    nextObjective: "A20AZ_ROAD_TO_V2_MERGE_AUDIT_PLAN",
  },
  morningReport: {
    status: "GO_FOR_REVIEW",
    usefulDeltas: 12,
    weakDeltas: 0,
    nightReadiness: "NIGHT_READY",
    publicRelease: "not launched",
    roadPush: "not pushed",
  },
  currentBestDirection:
    "A strict central board in a tactical observatory, with serious post-attempt feedback and memory objects around it.",
  recommendedMission: "A20AZ_ROAD_TO_V2_MERGE_AUDIT_PLAN",
};

export function getFullNightRealRunIteration(
  id: FullNightRealRunIterationId,
): FullNightRealRunIteration {
  return fullNightRealRunIterations.find((iteration) => iteration.id === id) ?? fullNightRealRunIterations[0];
}
