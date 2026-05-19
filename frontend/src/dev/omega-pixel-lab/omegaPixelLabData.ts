export type OmegaCandidate = {
  id: string;
  family: string;
  utility: number;
  reason: string;
};

export type OmegaSignatureStatus = {
  id: string;
  status: string;
  marker: string;
};

export const omegaPixelLabData = {
  route: "/app?omegaPixelLab=1",
  currentBottleneck: {
    primary: "autonomous_loop",
    secondary: ["visual_production_below_18_5", "night_readiness_below_19"],
    recommendedLane: "pixel_production",
    pixelMandateActive: true,
  },
  candidates: [
    {
      id: "A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS",
      family: "SIGNATURE_COMPONENTS",
      utility: 15,
      reason: "Best blend of pixel value, proof strength, and current score bottleneck.",
    },
    {
      id: "A20AU_LIMITED_AUTONOMOUS_PIXEL_REHEARSAL",
      family: "NIGHT_MODE_READINESS",
      utility: 8,
      reason: "Strong night-readiness lift, but better after one selected refinement contract.",
    },
    {
      id: "A20AU_IMPORT_HUMAN_TASTE_RESULTS_AND_FINALIZE",
      family: "HUMAN_TASTE_CALIBRATION",
      utility: 0,
      reason: "Useful only when real owner or crowd results exist.",
    },
  ] satisfies OmegaCandidate[],
  selectedMission: {
    id: "A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS",
    label: "Refine provisional Variant B winners",
    proof: "visible DEV route + external screenshot + browser smoke",
  },
  signatureFive: [
    { id: "sacred_board_chamber", status: "STATUS_2_TRIPLED", marker: "TASTE_PACKET_READY" },
    { id: "decision_feedback_language", status: "STATUS_2_TRIPLED", marker: "TASTE_PACKET_READY" },
    { id: "critical_moment_sigil", status: "STATUS_1_PROBED", marker: "SELECTED_FOR_LATER_VARIANTS" },
    { id: "decision_pressure_field", status: "STATUS_1_PROBED", marker: "SELECTED_FOR_LATER_VARIANTS" },
    { id: "memory_cabinet", status: "STATUS_1_PROBED", marker: "SELECTED_NEEDS_VARIANTS" },
  ] satisfies OmegaSignatureStatus[],
  topTwo: ["sacred_board_chamber", "decision_feedback_language"],
  provisionalWinners: {
    sacred_board_chamber: "B",
    decision_feedback_language: "B",
  },
  nextAction: "A20AV_LIMITED_AUTONOMOUS_PIXEL_REHEARSAL",
};
