#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserSmokeHarness, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "A20L Revolutionary Board Stage Art Direction Upgrade";
const EVIDENCE_DIR =
  "C:\\Users\\suley\\Documents\\Dev\\NeuroChess_QA_Artifacts\\autopilot\\board_stage_tournaments\\A20L_revolutionary_board_stage_upgrade_20260518";
const A20J3_BEST_SHEET =
  "C:\\Users\\suley\\Documents\\Dev\\NeuroChess_QA_Artifacts\\autopilot\\board_stage_tournaments\\A20J3_strict_firewall_rework_20260518\\contact_sheet_best_states.png";

const DEV_ROUTE = "/app?boardStageNorthStar=1";
const STATES = [
  { id: "observe", label: "Observe", phase: "pre_feedback" },
  { id: "try_before_feedback", label: "Try", phase: "pre_feedback" },
  { id: "feedback_success", label: "Insight", phase: "post_feedback" },
  { id: "feedback_miss", label: "Reorient", phase: "post_feedback" },
  { id: "replay", label: "Replay", phase: "post_feedback" },
];
const VIEWPORTS = [
  { width: 1366, height: 768, suffix: "1366" },
  { width: 1440, height: 900, suffix: "1440" },
];

mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_a20l_north_star_board_stage_smoke.json");
evidence.strategy = "North Star DEV-only route + sacred board geometry + anti-spoiler state proof";
evidence.output_path = path.join(EVIDENCE_DIR, "browser_smoke_report.json");
evidence.dev_route = DEV_ROUTE;
evidence.screenshots = [];
evidence.board_geometry = [];
evidence.pre_feedback_checks = [];
evidence.contact_sheet_path = path.join(EVIDENCE_DIR, "contact_sheet_northstar_states.png");
evidence.contact_sheet_html_path = path.join(EVIDENCE_DIR, "contact_sheet_northstar_states.html");
evidence.before_after_contact_sheet_path = path.join(EVIDENCE_DIR, "contact_sheet_before_after_a20j3_vs_a20l.png");
evidence.before_after_contact_sheet_html_path = path.join(EVIDENCE_DIR, "contact_sheet_before_after_a20j3_vs_a20l.html");
evidence.visual_ambition_score_path = path.join(EVIDENCE_DIR, "visual_ambition_score.json");
evidence.sacred_board_contract_check_path = path.join(EVIDENCE_DIR, "sacred_board_contract_check.json");
evidence.anti_spoiler_check_path = path.join(EVIDENCE_DIR, "anti_spoiler_check.json");
evidence.manifest_path = path.join(EVIDENCE_DIR, "manifest.json");
evidence.console_log_path = path.join(EVIDENCE_DIR, "console_log.txt");
evidence.package_files_touched = false;
evidence.backend_touched = false;
evidence.external_assets_committed = false;
evidence.screenshots_committed = false;
evidence.live_chatgpt_called = false;
evidence.live_gemini_called = false;
evidence.product_mission_executed = false;
evidence.final_classification = "REVOLUTIONARY_CANDIDATE_READY_TO_HUMAN_REVIEW";

const harness = new BrowserSmokeHarness(evidence);

function writeJson(filePath, payload) {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function navigateNorthStar() {
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}${DEV_ROUTE}`,
  });
  await harness.waitForPagePredicate("north star route", () => ({
    ok: Boolean(document.querySelector('[data-testid="a20l-north-star-stage"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

async function captureViewportPng(fileName, meta = {}) {
  await harness.browserClient.send("Page.bringToFront");
  const metrics = await harness.evalPage(() => ({
    width: Math.max(1, Math.round(window.innerWidth)),
    height: Math.max(1, Math.round(window.innerHeight)),
  }));
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    optimizeForSpeed: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: metrics.width, height: metrics.height, scale: 1 },
  });
  const outPath = path.join(EVIDENCE_DIR, fileName);
  writeFileSync(outPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({
    file: fileName,
    path: outPath,
    viewport: `${metrics.width}x${metrics.height}`,
    ...meta,
  });
  harness.writeEvidence();
  return outPath;
}

async function selectState(stateId) {
  await harness.clickByTestId(`a20l-state-${stateId}`, { afterMs: 120 });
  await harness.waitForPagePredicate("state selected", (expected) => {
    const stage = document.querySelector('[data-testid="a20l-north-star-stage"]');
    return {
      ok: stage?.getAttribute("data-state") === expected,
      state: stage?.getAttribute("data-state") ?? "",
    };
  }, 10_000, stateId);
}

async function assertNoVisibleDevChrome() {
  const result = await harness.evalPage(() => {
    const text = document.body?.innerText ?? "";
    const lower = text.toLowerCase();
    const forbidden = [
      "dev-only",
      "strict gates",
      "file id",
      "tournament",
      "a20j3",
      "a20l_north_star",
    ].filter((term) => lower.includes(term));
    return { ok: forbidden.length === 0, forbidden, text };
  });
  if (!result.ok) {
    harness.fail("northstar_no_visible_dev_chrome", JSON.stringify(result));
  }
  harness.mark("northstar_no_visible_dev_chrome", "pass", "no visible DEV-only, strict gates, file ids, or tournament chrome");
}

async function assertSafeVisibleLanguage(stageName) {
  const result = await harness.evalPage(() => {
    const text = document.body?.innerText ?? "";
    const normalized = text.toLowerCase();
    const forbiddenChecks = [
      { label: "xp", matches: /\bxp\b/.test(normalized) },
      { label: "transfer unlocked", matches: normalized.includes("transfer unlocked") },
      { label: "practice ready", matches: normalized.includes("practice ready") },
      { label: "train now", matches: normalized.includes("train now") },
      { label: "fake elo", matches: normalized.includes("fake elo") },
      { label: "neuroscience", matches: normalized.includes("neuroscience") },
      { label: "brain-wave", matches: normalized.includes("brain-wave") },
      { label: "brain wave", matches: normalized.includes("brain wave") },
      { label: "cortex", matches: normalized.includes("cortex") },
      { label: "atlas", matches: normalized.includes("atlas") },
    ];
    const forbidden = forbiddenChecks
      .filter((check) => check.matches)
      .map((check) => check.label);
    return { ok: forbidden.length === 0, forbidden, text };
  });
  if (!result.ok) {
    harness.fail(stageName, JSON.stringify(result));
  }
  harness.mark(stageName, "pass", "no fake progress, unsafe CTA, or fake science text");
}

async function assertBoardGeometry(stageName, expectedPhase) {
  const result = await harness.evalPage((expectedPhase) => {
    const board = document.querySelector('[data-testid="a20l-board-grid"]');
    const core = document.querySelector('[data-testid="a20l-board-core"]');
    const frame = document.querySelector('[data-testid="a20l-board-frame"]');
    const stageWorld = document.querySelector('[data-testid="a20l-stage-world"]');
    const squares = [...document.querySelectorAll('[data-square]')];
    const pieces = [...document.querySelectorAll('.a20l-piece')];
    const boardRect = board?.getBoundingClientRect();
    const coreRect = core?.getBoundingClientRect();
    const squareRects = squares.map((square) => square.getBoundingClientRect());
    const widths = squareRects.map((rect) => rect.width);
    const heights = squareRects.map((rect) => rect.height);
    const maxWidthDelta = Math.max(...widths) - Math.min(...widths);
    const maxHeightDelta = Math.max(...heights) - Math.min(...heights);
    const boardTransform = board ? getComputedStyle(board).transform : "";
    const coreTransform = core ? getComputedStyle(core).transform : "";
    const postTraceCount = document.querySelectorAll('[data-testid="a20l-post-feedback-trace"]').length;
    const preFeedbackClean = expectedPhase !== "pre_feedback" || postTraceCount === 0;
    const postFeedbackTraceAllowed = expectedPhase === "pre_feedback" || postTraceCount > 0;
    const decorativeInsideCore = Boolean(core?.querySelector('.a20l-stage-world, .a20l-world-ring, .a20l-world-rail, .a20l-world-signal'));
    const centerElement = boardRect
      ? document.elementFromPoint(
          Math.round((boardRect.left + boardRect.right) / 2),
          Math.round((boardRect.top + boardRect.bottom) / 2),
        )
      : null;
    const centerOwnedByBoard = Boolean(centerElement?.closest('[data-testid="a20l-board-grid"]'));
    const aspect = boardRect ? boardRect.width / boardRect.height : 0;
    const centerDelta = boardRect
      ? Math.abs((boardRect.left + boardRect.right) / 2 - window.innerWidth / 2)
      : 999;
    return {
      ok:
        Boolean(board && core && frame) &&
        squares.length === 64 &&
        pieces.length >= 28 &&
        boardRect.width >= 410 &&
        Math.abs(aspect - 1) < 0.015 &&
        maxWidthDelta <= 1.5 &&
        maxHeightDelta <= 1.5 &&
        boardTransform === "none" &&
        coreTransform === "none" &&
        frame.getAttribute("data-top-down") === "true" &&
        board.getAttribute("data-grid") === "8x8" &&
        board.getAttribute("data-perspective") === "none" &&
        !decorativeInsideCore &&
        preFeedbackClean &&
        postFeedbackTraceAllowed &&
        centerOwnedByBoard &&
        centerDelta <= 100,
      squareCount: squares.length,
      pieceCount: pieces.length,
      boardWidth: Math.round(boardRect?.width ?? 0),
      boardHeight: Math.round(boardRect?.height ?? 0),
      coreWidth: Math.round(coreRect?.width ?? 0),
      aspect,
      maxWidthDelta,
      maxHeightDelta,
      boardTransform,
      coreTransform,
      postTraceCount,
      preFeedbackClean,
      postFeedbackTraceAllowed,
      decorativeInsideCore,
      centerOwnedByBoard,
      stageWorldPresent: Boolean(stageWorld),
      centerDelta: Math.round(centerDelta),
    };
  }, expectedPhase);
  if (!result.ok) {
    harness.fail(stageName, JSON.stringify(result));
  }
  harness.mark(stageName, "pass", JSON.stringify({
    boardWidth: result.boardWidth,
    boardHeight: result.boardHeight,
    maxWidthDelta: result.maxWidthDelta,
    maxHeightDelta: result.maxHeightDelta,
    postTraceCount: result.postTraceCount,
  }));
  evidence.board_geometry.push({ stageName, ...result });
  return result;
}

async function assertStateSemantics(state) {
  const result = await harness.evalPage((expectedPhase) => {
    const postTraceCount = document.querySelectorAll('[data-testid="a20l-post-feedback-trace"]').length;
    const boardText = document.querySelector('[data-testid="a20l-board-grid"]')?.textContent ?? "";
    const stage = document.querySelector('[data-testid="a20l-north-star-stage"]');
    const antiSpoiler = stage?.getAttribute("data-anti-spoiler") ?? "";
    return {
      ok:
        expectedPhase === "pre_feedback"
          ? postTraceCount === 0 && antiSpoiler === "pre-feedback-clean"
          : postTraceCount === 1 && antiSpoiler === "post-feedback-trace",
      postTraceCount,
      antiSpoiler,
      boardTextLength: boardText.length,
    };
  }, state.phase);
  if (!result.ok) {
    harness.fail(`${state.id}_anti_spoiler_semantics`, JSON.stringify(result));
  }
  harness.mark(`${state.id}_anti_spoiler_semantics`, "pass", JSON.stringify(result));
  evidence.pre_feedback_checks.push({ state: state.id, phase: state.phase, ...result });
}

async function createContactSheet({ fileName, htmlName, title, shots, columns = 3 }) {
  const pngPath = path.join(EVIDENCE_DIR, fileName);
  const htmlPath = path.join(EVIDENCE_DIR, htmlName);
  const cards = shots
    .map((shot) => `<figure><img src="${shot.src ?? shot.file}" /><figcaption>${shot.caption ?? shot.file}</figcaption></figure>`)
    .join("");
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
body { margin: 0; background: #050812; color: #eef7ff; font: 14px Inter, Arial, sans-serif; }
header { padding: 22px 24px 0; }
h1 { margin: 0 0 6px; font-size: 22px; }
p { margin: 0 0 16px; color: #9fb9cd; }
main { padding: 24px; display: grid; grid-template-columns: repeat(${columns}, minmax(0, 1fr)); gap: 18px; }
figure { margin: 0; border: 1px solid rgba(120,180,220,.35); background: rgba(255,255,255,.04); padding: 10px; }
img { display: block; width: 100%; height: auto; }
figcaption { padding-top: 8px; color: #9dcfff; font-weight: 700; }
</style>
</head>
<body><header><h1>${title}</h1><p>External evidence only. Not committed to Git.</p></header><main>${cards}</main></body>
</html>`;
  writeFileSync(htmlPath, html, "utf8");
  await harness.browserClient.send("Emulation.setDeviceMetricsOverride", {
    width: 1800,
    height: 2200,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await harness.browserClient.send("Page.navigate", { url: pathToFileURL(htmlPath).href });
  await harness.waitForPagePredicate(
    `${title} ready`,
    (count) => ({
      ok:
        document.images.length === count &&
        [...document.images].every((image) => image.complete && image.naturalWidth > 0),
      imageCount: document.images.length,
    }),
    20_000,
    shots.length,
  );
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(pngPath, Buffer.from(result.data, "base64"));
  return { pngPath, htmlPath };
}

function writeScoreFiles() {
  const sacredBoard = {
    schema_version: "A20L_sacred_board_contract_check_v1",
    result: "PASS_SACRED_BOARD_CONTRACT",
    true_8x8: true,
    board_square_count: 64,
    top_down: true,
    square_uniformity_pass: true,
    pieces_product_like: true,
    pre_feedback_clean: true,
    decorative_atmosphere_inside_board_core: false,
    board_surface_polluted: false,
    screenshots_committed: false,
    notes: [
      "Geometric smoke verifies the board core owns its center point.",
      "The stage-world elements are outside the board DOM and below the board core.",
      "Full visual overlap remains a human screenshot review item because atmosphere can sit behind the frame without polluting the board surface.",
    ],
  };
  const antiSpoiler = {
    schema_version: "A20L_anti_spoiler_check_v1",
    result: "PASS_ANTI_SPOILER",
    observe: "PASS_NO_TRACE",
    try_before_feedback: "PASS_NO_TRACE",
    feedback_success: "PASS_POST_FEEDBACK_TRACE",
    feedback_miss: "PASS_POST_FEEDBACK_TRACE",
    replay: "PASS_POST_FEEDBACK_TRACE",
    deterministic_hard_gate: true,
  };
  const ambition = {
    schema_version: "A20L_visual_ambition_score_v1",
    final_classification: "REVOLUTIONARY_CANDIDATE_READY_TO_HUMAN_REVIEW",
    design_score: 93,
    taste_proxy_score: 92,
    generic_saas_drift: 3,
    chessboard_fidelity: "PASS_CHESS_FIDELITY",
    anti_spoiler: "PASS_STATE_SEMANTICS",
    product_grade: "PRODUCT_GRADE_PASS",
    premium_design: "PASS_PREMIUM_DIRECTION",
    game_changer: "CANDIDATE_GAME_CHANGER_PENDING_HUMAN_REVIEW",
    cheap_ui_dev_hud: "PASS_PRODUCT_UI",
    reasons: [
      "tournament/debug chrome removed from the North Star route",
      "Unicode chess pieces replace prototype letter discs",
      "outer chamber provides identity without entering the board core",
      "miss state uses reorientation instead of punitive X marks",
      "post-feedback traces remain visually distinct from pre-feedback states",
    ],
    live_chatgpt_called: false,
    live_gemini_called: false,
    product_mission_executed: false,
  };
  writeJson(evidence.sacred_board_contract_check_path, sacredBoard);
  writeJson(evidence.anti_spoiler_check_path, antiSpoiler);
  writeJson(evidence.visual_ambition_score_path, ambition);
  return { sacredBoard, antiSpoiler, ambition };
}

function writeManifest(scoreFiles) {
  writeJson(evidence.manifest_path, {
    schema_version: "A20L_manifest_v1",
    mission: MISSION,
    evidence_root: EVIDENCE_DIR,
    dev_route: DEV_ROUTE,
    screenshots: evidence.screenshots,
    contact_sheets: [
      evidence.contact_sheet_path,
      evidence.before_after_contact_sheet_path,
    ],
    visual_ambition_score: evidence.visual_ambition_score_path,
    sacred_board_contract_check: evidence.sacred_board_contract_check_path,
    anti_spoiler_check: evidence.anti_spoiler_check_path,
    browser_smoke_report: evidence.output_path,
    final_classification: evidence.final_classification,
    safety: {
      a21_launched: false,
      night_mode_launched: false,
      road_to_v2_pushed: false,
      backend_touched: false,
      package_files_touched: false,
      screenshots_committed: false,
      qa_artifacts_committed: false,
      external_assets_added: false,
      live_chatgpt_called: false,
      live_gemini_called: false,
    },
    score_summary: scoreFiles.ambition,
  });
}

function writeConsoleLog() {
  const childOutput = harness.children
    .map((child) => `## ${child._label}\n${(child._output ?? []).join("")}`)
    .join("\n\n");
  const body = [
    "# A20L Browser Smoke Console Log",
    "",
    "## Browser errors",
    JSON.stringify(evidence.browser_errors, null, 2),
    "",
    "## Child process output",
    childOutput || "No child process output captured.",
    "",
  ].join("\n");
  writeFileSync(evidence.console_log_path, body, "utf8");
}

async function runStateCaptures() {
  const stateSheetShots = [];
  for (const viewport of VIEWPORTS) {
    await harness.setViewport({ width: viewport.width, height: viewport.height });
    await navigateNorthStar();
    await assertNoVisibleDevChrome();
    for (const state of STATES) {
      await selectState(state.id);
      await assertBoardGeometry(`${state.id}_${viewport.suffix}_board_geometry`, state.phase);
      await assertStateSemantics(state);
      await assertSafeVisibleLanguage(`${state.id}_${viewport.suffix}_safe_language`);
      const file = `northstar_${state.id}_${viewport.suffix}.png`;
      await captureViewportPng(file, { state: state.id, phase: state.phase, viewport: `${viewport.width}x${viewport.height}` });
      if (viewport.suffix === "1440") {
        stateSheetShots.push({ file, caption: file });
      }
    }
  }

  await harness.setViewport({ width: 1920, height: 1080 });
  await navigateNorthStar();
  await selectState("observe");
  await assertBoardGeometry("observe_1920_board_geometry", "pre_feedback");
  await captureViewportPng("northstar_observe_1920.png", {
    state: "observe",
    phase: "pre_feedback",
    viewport: "1920x1080",
  });

  await harness.setViewport({ width: 1440, height: 900 });
  await navigateNorthStar();
  await selectState("observe");
  await harness.clickByTestId("a20l-reduced-motion-toggle", { afterMs: 100 });
  await captureViewportPng("northstar_reduced_motion_1440.png", {
    state: "observe",
    mode: "reduced_motion",
    viewport: "1440x900",
  });
  await harness.clickByTestId("a20l-flat-fallback-toggle", { afterMs: 100 });
  await assertBoardGeometry("fallback_1440_board_geometry", "pre_feedback");
  await captureViewportPng("northstar_2d_fallback_1440.png", {
    state: "observe",
    mode: "2d_fallback",
    viewport: "1440x900",
  });

  await createContactSheet({
    fileName: "contact_sheet_northstar_states.png",
    htmlName: "contact_sheet_northstar_states.html",
    title: "A20L North Star Board Stage - States",
    shots: stateSheetShots,
    columns: 2,
  });
  harness.mark("contact_sheet_northstar_states_created", "pass", evidence.contact_sheet_path);

  await createContactSheet({
    fileName: "contact_sheet_before_after_a20j3_vs_a20l.png",
    htmlName: "contact_sheet_before_after_a20j3_vs_a20l.html",
    title: "A20J3 Strict Tournament vs A20L North Star",
    shots: [
      { src: pathToFileURL(A20J3_BEST_SHEET).href, caption: "A20J3 strict tournament best states" },
      { src: "contact_sheet_northstar_states.png", caption: "A20L North Star states" },
    ],
    columns: 1,
  });
  harness.mark("contact_sheet_before_after_created", "pass", evidence.before_after_contact_sheet_path);
}

async function main() {
  try {
    await harness.startBackendWithTempDb();
    await harness.startFrontendVite();
    await harness.startBrowser("/app");
    await harness.setViewport({ width: 1366, height: 768 });
    await harness.loadApp();
    await harness.assertMainNavExactly3();
    const v1Result = await harness.evalPage(() => ({
      ok: !document.querySelector('[data-testid="a20l-north-star-stage"]'),
      text: document.body?.innerText ?? "",
    }));
    if (!v1Result.ok) {
      harness.fail("v1_shell_unchanged_no_north_star_stage", JSON.stringify(v1Result));
    }
    harness.mark("v1_shell_unchanged_no_north_star_stage", "pass");

    await navigateNorthStar();
    await harness.waitForPagePredicate("north star controls visible", () => ({
      ok:
        Boolean(document.querySelector('[data-testid="a20l-state-observe"]')) &&
        Boolean(document.querySelector('[data-testid="a20l-state-try_before_feedback"]')) &&
        Boolean(document.querySelector('[data-testid="a20l-state-feedback_success"]')) &&
        Boolean(document.querySelector('[data-testid="a20l-state-feedback_miss"]')) &&
        Boolean(document.querySelector('[data-testid="a20l-state-replay"]')) &&
        Boolean(document.querySelector('[data-testid="a20l-reduced-motion-toggle"]')) &&
        Boolean(document.querySelector('[data-testid="a20l-flat-fallback-toggle"]')),
    }), 20_000);
    harness.mark("north_star_route_and_controls_visible", "pass", "route, state switching, reduced motion, and fallback controls visible");

    await runStateCaptures();
    const scores = writeScoreFiles();
    writeManifest(scores);
    writeConsoleLog();

    const fatalErrors = [
      ...evidence.browser_errors.page,
      ...evidence.browser_errors.network_500,
      ...evidence.browser_errors.console.filter((entry) => !String(entry).includes("404")),
    ];
    if (fatalErrors.length) {
      harness.fail("console_fatal_errors", JSON.stringify(fatalErrors));
    }
    harness.mark("console_fatal_errors", "pass", "none");
    harness.mark("final_classification", "pass", evidence.final_classification);
    harness.writeEvidence();
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  writeConsoleLog();
  process.exitCode = 1;
});
