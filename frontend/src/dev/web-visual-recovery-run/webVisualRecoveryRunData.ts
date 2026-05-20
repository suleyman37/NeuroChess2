export const webVisualRecoveryRunDeltaIds = ["delta1", "delta2"] as const;

export type WebVisualRecoveryRunDeltaId = (typeof webVisualRecoveryRunDeltaIds)[number];

export type WebVisualRecoveryRunDelta = {
  id: WebVisualRecoveryRunDeltaId;
  title: string;
  objective: string;
  result: string;
  doctorVerdict: "PASS";
  supervisorSignal: string;
  visualRole: "recovery_rail" | "packet_board";
};

export const webVisualRecoveryRunDeltas: WebVisualRecoveryRunDelta[] = [
  {
    id: "delta1",
    title: "Screenshot recovery rail",
    objective: "WEB_VISUAL_RECOVERY_RULE_VISUAL_RAIL",
    result:
      "A stuck web action now becomes a visible recovery event: screenshot, observation, revised action, then bounded lane parking if needed.",
    doctorVerdict: "PASS",
    supervisorSignal: "ChatGPT and Gemini are checked in separate windows before any verdict.",
    visualRole: "recovery_rail",
  },
  {
    id: "delta2",
    title: "Dual supervisor auction board",
    objective: "CHATGPT_GEMINI_PACKET_COMPARISON_SURFACE",
    result:
      "OMEGA keeps final authority while ChatGPT strategic packets and Gemini visual packets are compared as advisory inputs.",
    doctorVerdict: "PASS",
    supervisorSignal: "Gemini visual packet is used only when image attachment is visibly confirmed.",
    visualRole: "packet_board",
  },
];

export const webVisualRecoveryEvents = [
  {
    service: "chatgpt",
    action: "Decision Packet send",
    failure: "First packet state was ambiguous.",
    visible: "Composer and current discussion are visible in the dedicated ChatGPT window on port 9222.",
    revised: "Refocus the visible composer, send one bounded retry, then park if packet count stays weak.",
    result: "success",
  },
  {
    service: "gemini",
    action: "Visual packet upload",
    failure: "Upload control was not trusted from selectors alone.",
    visible: "Gemini is visible in its own browser profile on port 9223 with plus/import controls near the composer.",
    revised: "Use only the visible upload affordance, confirm attachment preview, then send the visual prompt.",
    result: "success",
  },
] as const;

export const webVisualRecoveryRunData = {
  missionId: "A20BG",
  route: "/app?webVisualRecoveryRun=1",
  isolatedRoutePrefix: "/app?webVisualRecoveryRun=",
  title: "Web Visual Recovery Live Supervision",
  summary:
    "A bounded live-supervision surface for the new rule: try once, screenshot the current service window, reason from visible UI, revise once, then park and use OMEGA fallback.",
  chatgpt: {
    cdpPort: 9222,
    attempts: 4,
    successfulDecisionPackets: 2,
    laneStatus: "strategic supervisor ready",
    ajRotation: "current label A, threshold 50, URLs redacted",
  },
  gemini: {
    cdpPort: 9223,
    attempts: 2,
    visualDecisionPackets: 1,
    laneStatus: "visual critic ready if attachment is confirmed",
  },
  omega: {
    role: "local decision engine",
    result: "2 useful DEV-only pixel deltas",
    fallback: "available",
  },
  missionDoctor: {
    verdict: "PASS",
    summary: "Visible pixel work, bounded web lanes, no V1 behavior change.",
  },
  recommendedMission: "A20BH_TRUE_OVERNIGHT_WITH_VISUAL_RECOVERY_RULE",
};

export function getWebVisualRecoveryRunDelta(
  id: WebVisualRecoveryRunDeltaId,
): WebVisualRecoveryRunDelta {
  return webVisualRecoveryRunDeltas.find((delta) => delta.id === id) ?? webVisualRecoveryRunDeltas[0];
}
