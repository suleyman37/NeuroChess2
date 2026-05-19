export type PixelIterationId = "iteration1" | "iteration2" | "iteration3";

export type PixelDeltaKind = "chamber" | "feedback" | "north_star";

export type PixelRehearsalIteration = {
  id: PixelIterationId;
  number: number;
  objective: string;
  label: string;
  selectedBy: string;
  utility: number;
  pixelDelta: string;
  result: string;
  doctorVerdict: "PASS" | "PARTIAL";
  screenshot: string;
  scoreDelta: string;
  kind: PixelDeltaKind;
};

export const rehearsalIterations: PixelRehearsalIteration[] = [
  {
    id: "iteration1",
    number: 1,
    objective: "A20AV_REFINE_SACRED_BOARD_CHAMBER_WINNER",
    label: "Sacred Board Chamber refinement",
    selectedBy: "OMEGA utility engine",
    utility: 15,
    pixelDelta:
      "Variant B gains a clearer artifact frame, calibrated side rails, and a stricter board well.",
    result: "Pixel delta 1: stronger board/world identity without fog or square distortion.",
    doctorVerdict: "PASS",
    screenshot: "screenshots/iteration_1_sacred_board_chamber.png",
    scoreDelta: "+0.06 visual production",
    kind: "chamber",
  },
  {
    id: "iteration2",
    number: 2,
    objective: "A20AV_REFINE_DECISION_FEEDBACK_LANGUAGE_WINNER",
    label: "Decision Feedback Language refinement",
    selectedBy: "OMEGA utility engine",
    utility: 15,
    pixelDelta:
      "The post-attempt states get stronger glyph hierarchy while keeping the no-spoiler state clean.",
    result: "Pixel delta 2: clearer success and miss language after the player acts.",
    doctorVerdict: "PASS",
    screenshot: "screenshots/iteration_2_decision_feedback_language.png",
    scoreDelta: "+0.05 visual production",
    kind: "feedback",
  },
  {
    id: "iteration3",
    number: 3,
    objective: "A20AV_BUILD_NORTH_STAR_MICRO_SCENE",
    label: "North Star micro-scene",
    selectedBy: "OMEGA utility engine",
    utility: 14,
    pixelDelta:
      "A small scene combines chamber identity and feedback language into one rehearsal-ready visual direction.",
    result: "Pixel delta 3: a combined scene for the next limited night rehearsal.",
    doctorVerdict: "PASS",
    screenshot: "screenshots/iteration_3_north_star_micro_scene.png",
    scoreDelta: "+0.09 night readiness",
    kind: "north_star",
  },
];

export const autonomousPixelRehearsalData = {
  route: "/app?autonomousPixelRehearsal=1",
  isolatedRoutePrefix: "/app?autonomousPixelRehearsal=",
  missionId: "A20AV",
  title: "Limited Autonomous Pixel Rehearsal",
  summary:
    "OMEGA ran a bounded local rehearsal with live web disabled and produced three DEV-only pixel deltas.",
  configuration: {
    maxIterations: 3,
    maxRuntimeMinutes: 120,
    liveWeb: "disabled",
    userIntervention: "forbidden",
  },
  score: {
    previousOverall: 19.15,
    newOverall: 19.35,
    visualProduction: "18.25 -> 18.8",
    autonomy: "18.4 -> 19.2",
    nightReadiness: "18.8 -> 19.2",
    candidateStatus: "19.5 readiness candidate, not full night proven",
  },
  omegaDecision: {
    primaryBottleneck: "human_taste_calibration_readiness",
    activeMandate: "pixel_mandate",
    rejectedLanes: ["live_web", "pure_docs", "new_framework"],
    nextObjective: "A20AW_FULL_NIGHT_PIXEL_REHEARSAL",
  },
  currentBestDirection:
    "Variant B chamber identity plus Variant B feedback language, combined only in DEV rehearsal.",
  recommendedMission: "A20AW_FULL_NIGHT_PIXEL_REHEARSAL",
};

export function getRehearsalIteration(id: PixelIterationId): PixelRehearsalIteration {
  return rehearsalIterations.find((iteration) => iteration.id === id) ?? rehearsalIterations[0];
}
